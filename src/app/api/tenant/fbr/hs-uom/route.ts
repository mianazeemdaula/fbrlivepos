import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'
import { decryptCredential } from '@/lib/crypto/credentials'
import { getDefaultHSCode } from '@/lib/hscode'

const FBR_BASE = 'https://gw.fbr.gov.pk'

interface PRALUOMEntry {
    uoM_ID: number
    description: string
}

interface UOMOption {
    id: number
    description: string
}

function resolveEnvToken() {
    const raw = process.env.PRAL_PLATFORM_TOKEN
        ?? process.env.FBR_API_TOKEN
        ?? process.env.FBR_TOKEN
    const token = raw?.trim()
    return token ? token : null
}

/**
 * Fetch valid UOMs for an HS code from the FBR DI API.
 * Returns null when the lookup fails (no token, HTTP error, network error, or empty result).
 */
async function fetchUOMsFromPRAL(tenantId: string, hsCode: string, annexureId: number): Promise<UOMOption[] | null> {
    try {
        const creds = await prisma.dICredentials.findUnique({
            where: { tenantId },
        })
        const tokenField = creds
            ? (creds.environment === 'SANDBOX' ? creds.encryptedSandboxToken : creds.encryptedProductionToken)
            : null
        const token = tokenField ? decryptCredential(tokenField) : resolveEnvToken()

        if (!token) {
            console.warn('[HS-UOM] No DI credentials or environment token configured')
            return null
        }

        const url = `${FBR_BASE}/pdi/v2/HS_UOM?hs_code=${encodeURIComponent(hsCode)}&annexure_id=${annexureId}`
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: AbortSignal.timeout(10_000),
        })

        if (!res.ok) {
            console.error(`[HS-UOM] PRAL API returned ${res.status}:`, await res.text())
            return null
        }

        const data = (await res.json()) as PRALUOMEntry[]
        const uoms = Array.isArray(data)
            ? data.map((entry) => ({ id: entry.uoM_ID, description: entry.description }))
            : []

        return uoms.length > 0 ? uoms : null
    } catch (err) {
        console.error('[HS-UOM] Failed to fetch UOMs from PRAL:', err)
        return null
    }
}

/**
 * Align the DB HS code tables with the FBR response:
 * - DIUnitOfMeasure / DIHSCodeUOM hold exactly the UOMs FBR currently allows for this HS code
 * - HSCode.unit is corrected when it is not one of those UOMs
 */
async function syncHSCodeTables(hsCode: string, annexureId: number, uoms: UOMOption[]) {
    try {
        await prisma.$transaction(async (tx) => {
            for (const uom of uoms) {
                await tx.dIUnitOfMeasure.upsert({
                    where: { id: uom.id },
                    create: { id: uom.id, description: uom.description },
                    update: { description: uom.description },
                })

                await tx.dIHSCodeUOM.upsert({
                    where: {
                        hsCode_uomId_annexureId: {
                            hsCode,
                            uomId: uom.id,
                            annexureId,
                        },
                    },
                    create: {
                        hsCode,
                        uomId: uom.id,
                        uomDesc: uom.description,
                        annexureId,
                    },
                    update: {
                        uomDesc: uom.description,
                    },
                })
            }

            await tx.dIHSCodeUOM.deleteMany({
                where: {
                    hsCode,
                    annexureId,
                    uomId: { notIn: uoms.map((uom) => uom.id) },
                },
            })

            const hsRow = await tx.hSCode.findUnique({
                where: { code: hsCode },
                select: { unit: true },
            })
            const currentUnit = hsRow?.unit?.trim().toLowerCase()
            const unitIsValid = !!currentUnit
                && uoms.some((uom) => uom.description.trim().toLowerCase() === currentUnit)
            if (hsRow && !unitIsValid) {
                await tx.hSCode.update({
                    where: { code: hsCode },
                    data: { unit: uoms[0].description },
                })
            }
        })
    } catch (err) {
        // Sync is best-effort; the PRAL response is still returned to the caller.
        console.error('[HS-UOM] Failed to sync HS code tables:', err)
    }
}

/**
 * Fallback when FBR is unreachable: UOMs previously synced into DIHSCodeUOM,
 * otherwise the unit stored on the HSCode row.
 */
async function loadUOMsFromDatabase(hsCode: string, annexureId: number): Promise<{ uoms: UOMOption[]; source: string } | null> {
    const [cachedUOMs, hsRow] = await Promise.all([
        prisma.dIHSCodeUOM.findMany({
            where: { hsCode, annexureId },
            orderBy: { uomDesc: 'asc' },
            select: { uomId: true, uomDesc: true },
        }),
        prisma.hSCode.findUnique({
            where: { code: hsCode },
            select: { unit: true },
        }),
    ])
    const unit = hsRow?.unit?.trim()

    if (cachedUOMs.length > 0) {
        const uoms = cachedUOMs.map((entry) => ({ id: entry.uomId, description: entry.uomDesc }))
        // Put the HSCode table unit first so it is the default selection.
        const unitIndex = unit
            ? uoms.findIndex((uom) => uom.description.trim().toLowerCase() === unit.toLowerCase())
            : -1
        if (unitIndex > 0) uoms.unshift(...uoms.splice(unitIndex, 1))
        return { uoms, source: 'database' }
    }

    if (unit) {
        const knownUOM = await prisma.dIUnitOfMeasure.findFirst({
            where: { description: { equals: unit, mode: 'insensitive' } },
            select: { id: true, description: true },
        })
        return {
            uoms: [{ id: knownUOM?.id ?? 0, description: knownUOM?.description ?? unit }],
            source: 'hscode',
        }
    }

    return null
}

export async function GET(req: NextRequest) {
    const { tenant } = await getTenantFromSession()

    let hsCode = req.nextUrl.searchParams.get('hs_code')?.trim() || null
    const annexureId = Math.max(1, Number(req.nextUrl.searchParams.get('annexure_id') ?? 3))
    if (!hsCode) {
        const defaultHS = await getDefaultHSCode()
        hsCode = defaultHS?.code ?? null
    }
    if (!hsCode) {
        return NextResponse.json({ error: 'hs_code query param is required and no default HS code is in database' }, { status: 400 })
    }

    // 1. FBR DI API first
    const pralUOMs = await fetchUOMsFromPRAL(tenant.id, hsCode, annexureId)
    if (pralUOMs) {
        await syncHSCodeTables(hsCode, annexureId, pralUOMs)
        return NextResponse.json({ uoms: pralUOMs, source: 'pral' })
    }

    // 2. Fallback: HS code tables in the database
    const fromDatabase = await loadUOMsFromDatabase(hsCode, annexureId)
    if (fromDatabase) {
        return NextResponse.json(fromDatabase)
    }

    return NextResponse.json(
        { error: `UOM could not be resolved from FBR DI or HS code tables for ${hsCode}` },
        { status: 404 },
    )
}
