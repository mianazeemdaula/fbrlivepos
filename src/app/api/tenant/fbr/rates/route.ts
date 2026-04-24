import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'
import { decryptCredential } from '@/lib/crypto/credentials'
import { SALE_TYPE_LIST } from '@/lib/di/sale-type-config'

const FBR_BASE = 'https://gw.fbr.gov.pk'

interface PRALRateEntry {
    ratE_ID: number
    ratE_DESC: string
    ratE_VALUE: number
}

// FBR province codes (from /pdi/v1/provinces)
const PROVINCE_CODE_MAP: Record<string, number> = {
    'PUNJAB': 7, 'SINDH': 8, 'BALOCHISTAN': 2,
    'KHYBER PAKHTUNKHWA': 6, 'KPK': 6,
    'CAPITAL TERRITORY': 5, 'ICT': 5, 'ISLAMABAD': 5,
    'AZAD JAMMU AND KASHMIR': 4, 'AJK': 4,
    'GILGIT BALTISTAN': 9, 'GB': 9,
}

async function resolveProvinceCode(sellerProvince: string | null): Promise<number> {
    if (!sellerProvince) return 7 // Default Punjab
    const upper = sellerProvince.trim().toUpperCase()
    // Try hardcoded map first (fast)
    if (PROVINCE_CODE_MAP[upper]) return PROVINCE_CODE_MAP[upper]
    const match = Object.entries(PROVINCE_CODE_MAP).find(([k]) => upper.includes(k) || k.includes(upper))
    if (match) return match[1]
    // Try DB
    try {
        const all = await prisma.dIProvince.findMany({ select: { code: true, description: true } })
        const row = all.find(p => p.description.toUpperCase().includes(upper) || upper.includes(p.description.toUpperCase()))
        if (row) return row.code
    } catch { /* ignore */ }
    return 7 // Default Punjab
}

function getFallbackRates(transTypeId: number): { id: number; desc: string; value: number }[] {
    const cfg = SALE_TYPE_LIST.find(c => c.transTypeId === transTypeId)
    if (!cfg) return []
    return cfg.fallbackRates.map((desc, i) => ({ id: -(i + 1), desc, value: 0 }))
}

export async function GET(req: NextRequest) {
    const { tenant } = await getTenantFromSession()

    const transTypeId = req.nextUrl.searchParams.get('transTypeId')
    const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().split('T')[0]
    const originationSupplier = req.nextUrl.searchParams.get('originationSupplier')

    if (!transTypeId) {
        return NextResponse.json({ error: 'transTypeId is required' }, { status: 400 })
    }

    const creds = await prisma.dICredentials.findUnique({ where: { tenantId: tenant.id } })
    if (!creds) {
        // No credentials — return fallback so the form still works
        return NextResponse.json({ rates: getFallbackRates(Number(transTypeId)), source: 'fallback' })
    }

    const tokenField = creds.environment === 'SANDBOX' ? creds.encryptedSandboxToken : creds.encryptedProductionToken
    if (!tokenField) {
        return NextResponse.json({ rates: getFallbackRates(Number(transTypeId)), source: 'fallback' })
    }

    const provinceCode = originationSupplier
        ? Number(originationSupplier)
        : await resolveProvinceCode(creds.sellerProvince)

    try {
        const token = decryptCredential(tokenField)
        const url =
            `${FBR_BASE}/pdi/v2/SaleTypeToRate` +
            `?date=${encodeURIComponent(date)}` +
            `&transTypeId=${encodeURIComponent(transTypeId)}` +
            `&originationSupplier=${provinceCode}`

        console.log(`[FBR-RATES] Fetching: ${url}`)

        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10_000),
        })

        if (res.status === 401) {
            console.warn('[FBR-RATES] Token unauthorized — using fallback rates')
            return NextResponse.json({ rates: getFallbackRates(Number(transTypeId)), source: 'fallback', warning: 'PRAL token unauthorized' })
        }

        if (!res.ok) {
            console.warn(`[FBR-RATES] PRAL API returned ${res.status} — using fallback rates`)
            return NextResponse.json({ rates: getFallbackRates(Number(transTypeId)), source: 'fallback', warning: `PRAL API returned ${res.status}` })
        }

        const data = (await res.json()) as PRALRateEntry[]
        const rates = Array.isArray(data) && data.length > 0
            ? data.map((r) => ({ id: r.ratE_ID, desc: r.ratE_DESC, value: r.ratE_VALUE }))
            : getFallbackRates(Number(transTypeId)) // API returned empty — use fallback

        return NextResponse.json({ rates, source: Array.isArray(data) && data.length > 0 ? 'pral' : 'fallback' })
    } catch (err) {
        console.warn('[FBR-RATES] Failed to reach PRAL — using fallback rates:', err)
        return NextResponse.json({ rates: getFallbackRates(Number(transTypeId)), source: 'fallback', warning: 'Failed to reach PRAL API' })
    }
}
