import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'
import { decryptCredential } from '@/lib/crypto/credentials'
import { SALE_TYPE_CONFIG } from '@/lib/di/sale-type-config'

const FBR_BASE = 'https://gw.fbr.gov.pk'

interface PRALSROEntry {
    srO_ID: number
    srO_DESC: string
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
    if (!sellerProvince) return 7
    const upper = sellerProvince.trim().toUpperCase()
    if (PROVINCE_CODE_MAP[upper]) return PROVINCE_CODE_MAP[upper]
    const match = Object.entries(PROVINCE_CODE_MAP).find(([k]) => upper.includes(k) || k.includes(upper))
    if (match) return match[1]
    try {
        const all = await prisma.dIProvince.findMany({ select: { code: true, description: true } })
        const row = all.find(p => p.description.toUpperCase().includes(upper) || upper.includes(p.description.toUpperCase()))
        if (row) return row.code
    } catch { /* ignore */ }
    return 7
}

async function getDBFallbackSROs(): Promise<{ id: number; desc: string }[]> {
    try {
        const rows = await prisma.dISROSchedule.findMany({
            orderBy: { description: 'asc' },
            take: 200,
            select: { id: true, description: true },
        })
        return rows.map(r => ({ id: r.id, desc: r.description }))
    } catch {
        return []
    }
}

export async function GET(req: NextRequest) {
    const { tenant } = await getTenantFromSession()

    const rateId = req.nextUrl.searchParams.get('rate_id')
    const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().split('T')[0]
    const originationSupplierCsv = req.nextUrl.searchParams.get('origination_supplier_csv')
    const saleTypeId = req.nextUrl.searchParams.get('sale_type_id') ?? ''

    // Helper: config-based last resort fallback
    const configFallback = () => {
        const cfg = SALE_TYPE_CONFIG[saleTypeId]
        const sros = cfg?.fallbackSROs.map(s => ({ id: s.id, desc: s.desc })) ?? []
        return NextResponse.json({ sros, source: 'config_fallback' })
    }

    if (!rateId) {
        return configFallback()
    }

    const creds = await prisma.dICredentials.findUnique({ where: { tenantId: tenant.id } })

    if (!creds) {
        const sros = await getDBFallbackSROs()
        if (sros.length > 0) return NextResponse.json({ sros, source: 'db_fallback' })
        return configFallback()
    }

    const tokenField = creds.environment === 'SANDBOX' ? creds.encryptedSandboxToken : creds.encryptedProductionToken

    if (!tokenField) {
        const sros = await getDBFallbackSROs()
        if (sros.length > 0) return NextResponse.json({ sros, source: 'db_fallback' })
        return configFallback()
    }

    const provinceCode = originationSupplierCsv
        ? originationSupplierCsv
        : await resolveProvinceCode(creds.sellerProvince)

    try {
        const token = decryptCredential(tokenField)
        const url =
            `${FBR_BASE}/pdi/v1/SroSchedule` +
            `?rate_id=${encodeURIComponent(rateId)}` +
            `&date=${encodeURIComponent(date)}` +
            `&origination_supplier_csv=${provinceCode}`

        console.log(`[FBR-SRO-SCHEDULE] Fetching: ${url}`)

        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10_000),
        })

        if (!res.ok) {
            console.warn(`[FBR-SRO-SCHEDULE] PRAL returned ${res.status} — falling back to DB`)
            const sros = await getDBFallbackSROs()
            return NextResponse.json({ sros, source: 'db_fallback', warning: `PRAL returned ${res.status}` })
        }

        const data = (await res.json()) as PRALSROEntry[]

        if (Array.isArray(data) && data.length > 0) {
            const sros = data.map((s) => ({ id: s.srO_ID, desc: s.srO_DESC }))
            return NextResponse.json({ sros, source: 'pral' })
        }

        // Empty response — fall back to DB then config
        const sros = await getDBFallbackSROs()
        if (sros.length > 0) return NextResponse.json({ sros, source: 'db_fallback', warning: 'PRAL returned empty list' })
        return configFallback()

    } catch (err) {
        console.warn('[FBR-SRO-SCHEDULE] Failed to reach PRAL — falling back to DB/config:', err)
        const sros = await getDBFallbackSROs()
        if (sros.length > 0) return NextResponse.json({ sros, source: 'db_fallback', warning: 'Failed to reach PRAL API' })
        return configFallback()
    }
}
