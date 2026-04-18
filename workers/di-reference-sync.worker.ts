// Reference data sync worker — run on platform startup and then every 24 hours
// Usage: npx tsx workers/di-reference-sync.worker.ts

import { prisma } from '../src/lib/db/prisma'

const FBR_BASE = 'https://gw.fbr.gov.pk'
// Use YOUR platform's sandbox token for reference syncing
const PLATFORM_TOKEN = process.env.PRAL_PLATFORM_TOKEN!

async function fetchWithToken(url: string) {
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${PLATFORM_TOKEN}` },
        signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`Reference API ${url} returned ${res.status}`)
    return res.json()
}

export async function syncAllReferenceData() {
    console.log('[DI Sync] Starting reference data sync...')

    // 1. Provinces
    try {
        const provinces = await fetchWithToken(`${FBR_BASE}/pdi/v1/provinces`)
        await prisma.$transaction(
            provinces.map((p: { stateProvinceCode: number; stateProvinceDesc: string }) =>
                prisma.dIProvince.upsert({
                    where: { code: p.stateProvinceCode },
                    create: { code: p.stateProvinceCode, description: p.stateProvinceDesc },
                    update: { description: p.stateProvinceDesc },
                }),
            ),
        )
        console.log(`[DI Sync] Synced ${provinces.length} provinces`)
    } catch (err) {
        console.error('[DI Sync] Failed to sync provinces:', err)
    }

    // 2. Document Types
    try {
        const docTypes = await fetchWithToken(`${FBR_BASE}/pdi/v1/doctypecode`)
        await prisma.$transaction(
            docTypes.map((d: { docTypeId: number; docDescription: string }) =>
                prisma.dIDocumentType.upsert({
                    where: { id: d.docTypeId },
                    create: { id: d.docTypeId, description: d.docDescription },
                    update: { description: d.docDescription },
                }),
            ),
        )
        console.log(`[DI Sync] Synced ${docTypes.length} document types`)
    } catch (err) {
        console.error('[DI Sync] Failed to sync document types:', err)
    }

    // 3. Units of Measure
    try {
        const uoms = await fetchWithToken(`${FBR_BASE}/pdi/v1/uom`)
        await prisma.$transaction(
            uoms.map((u: { uoM_ID: number; description: string }) =>
                prisma.dIUnitOfMeasure.upsert({
                    where: { id: u.uoM_ID },
                    create: { id: u.uoM_ID, description: u.description },
                    update: { description: u.description },
                }),
            ),
        )
        console.log(`[DI Sync] Synced ${uoms.length} units of measure`)
    } catch (err) {
        console.error('[DI Sync] Failed to sync UOMs:', err)
    }

    console.log('[DI Sync] Reference data sync complete')
}

// Run if executed directly
if (require.main === module) {
    if (!PLATFORM_TOKEN) {
        console.error('[DI Sync] PRAL_PLATFORM_TOKEN not set in environment')
        process.exit(1)
    }

    syncAllReferenceData()
        .then(() => {
            console.log('[DI Sync] Done')
            process.exit(0)
        })
        .catch((err) => {
            console.error('[DI Sync] Fatal error:', err)
            process.exit(1)
        })
}
