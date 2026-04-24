import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'
import { decryptCredential } from '@/lib/crypto/credentials'
import { SALE_TYPE_LIST } from '@/lib/di/sale-type-config'

const FBR_BASE = 'https://gw.fbr.gov.pk'

interface PRALSROItemEntry {
    srO_ITEM_ID: number
    srO_ITEM_DESC: string
}

/**
 * Return fallback SR# items for a given sro_id (negative = fallback SRO).
 * Looks up the matching SRO in SALE_TYPE_CONFIG.fallbackSROs.
 */
function getFallbackSRItems(sroId: number): { id: number; desc: string }[] {
    for (const cfg of SALE_TYPE_LIST) {
        const sro = cfg.fallbackSROs.find(s => s.id === sroId)
        if (sro) return sro.srItems
    }
    return []
}

export async function GET(req: NextRequest) {
    const { tenant } = await getTenantFromSession()
    const sroIdParam = req.nextUrl.searchParams.get('sro_id')
    const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().split('T')[0]
    const sroId = sroIdParam ? Number(sroIdParam) : null

    // Fallback path — negative sro_id means this is a local fallback SRO, not a real PRAL ID
    if (sroId !== null && sroId < 0) {
        const items = getFallbackSRItems(sroId)
        return NextResponse.json({ data: items, source: 'config_fallback' })
    }

    // Live FBR proxy path — cascade: SRO selected → fetch SR# items from PRAL
    if (sroId !== null && sroId > 0) {
        const creds = await prisma.dICredentials.findUnique({ where: { tenantId: tenant.id } })
        if (!creds) return NextResponse.json({ data: [], error: 'No DI credentials configured' })

        const tokenField = creds.environment === 'SANDBOX' ? creds.encryptedSandboxToken : creds.encryptedProductionToken
        if (!tokenField) return NextResponse.json({ data: [], error: 'No token configured' })

        try {
            const token = decryptCredential(tokenField)
            const url = `${FBR_BASE}/pdi/v2/SROItem?date=${encodeURIComponent(date)}&sro_id=${encodeURIComponent(sroId)}`
            console.log(`[FBR-SRO-ITEMS] Fetching: ${url}`)
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) })

            if (!res.ok) {
                console.warn(`[FBR-SRO-ITEMS] PRAL returned ${res.status} — returning empty`)
                return NextResponse.json({ data: [], source: 'pral_error', warning: `PRAL returned ${res.status}` })
            }

            const raw = (await res.json()) as PRALSROItemEntry[]
            const items = Array.isArray(raw) ? raw.map(i => ({ id: i.srO_ITEM_ID, desc: i.srO_ITEM_DESC })) : []
            return NextResponse.json({ data: items, source: 'pral' })
        } catch (err) {
            console.warn('[FBR-SRO-ITEMS] Failed to reach PRAL:', err)
            return NextResponse.json({ data: [], source: 'pral_error', warning: 'Failed to reach PRAL API' })
        }
    }

    // Legacy DB-backed path — no sro_id provided (search/autocomplete behaviour)
    const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
    const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 100)))
    const items = await prisma.dISROItem.findMany({
        where: q ? { OR: [{ description: { contains: q, mode: 'insensitive' } }] } : undefined,
        orderBy: [{ description: 'asc' }, { id: 'asc' }],
        take: limit,
        select: { id: true, description: true },
    })
    return NextResponse.json({ data: items, source: 'db' })
}
