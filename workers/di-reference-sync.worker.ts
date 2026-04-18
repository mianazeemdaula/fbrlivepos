// Reference data sync worker — run on platform startup and then every 24 hours
// Usage: npx tsx workers/di-reference-sync.worker.ts

import { prisma } from '../src/lib/db/prisma'

const FBR_BASE = 'https://gw.fbr.gov.pk'
// Use YOUR platform's sandbox token for reference syncing
const PLATFORM_TOKEN = process.env.PRAL_PLATFORM_TOKEN!

async function fetchWithToken(url: string) {
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${PLATFORM_TOKEN}` },
        signal: AbortSignal.timeout(30_000),
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

    // 4. HS Codes / Item Descriptions
    try {
        const items: Array<{ hS_CODE: string; description: string }> = await fetchWithToken(`${FBR_BASE}/pdi/v1/itemdesccode`)
        let synced = 0
        // Batch in chunks of 50 to avoid transaction size limits
        for (let i = 0; i < items.length; i += 50) {
            const chunk = items.slice(i, i + 50)
            await prisma.$transaction(
                chunk.map((item) =>
                    prisma.dIItemDescription.upsert({
                        where: { hsCode: item.hS_CODE },
                        create: { hsCode: item.hS_CODE, description: item.description },
                        update: { description: item.description },
                    }),
                ),
            )
            synced += chunk.length
        }
        console.log(`[DI Sync] Synced ${synced} HS codes (item descriptions)`)

        // Also seed into the HSCode master table for tenant product mapping
        let hsSeeded = 0
        for (let i = 0; i < items.length; i += 50) {
            const chunk = items.slice(i, i + 50)
            await prisma.$transaction(
                chunk.map((item) =>
                    prisma.hSCode.upsert({
                        where: { code: item.hS_CODE },
                        create: {
                            code: item.hS_CODE,
                            description: item.description,
                            category: categorizeHSCode(item.hS_CODE),
                            unit: 'PCS',
                            defaultTaxRate: 18,
                            isFBRActive: true,
                        },
                        update: {
                            description: item.description,
                            isFBRActive: true,
                        },
                    }),
                ),
            )
            hsSeeded += chunk.length
        }
        console.log(`[DI Sync] Seeded ${hsSeeded} HS codes into master library`)
    } catch (err) {
        console.error('[DI Sync] Failed to sync HS codes:', err)
    }

    // 5. Transaction Types
    try {
        const transTypes: Array<{ transactioN_TYPE_ID: number; transactioN_DESC: string }> = await fetchWithToken(`${FBR_BASE}/pdi/v1/transtypecode`)
        await prisma.$transaction(
            transTypes.map((t) =>
                prisma.dITransactionType.upsert({
                    where: { id: t.transactioN_TYPE_ID },
                    create: { id: t.transactioN_TYPE_ID, description: t.transactioN_DESC },
                    update: { description: t.transactioN_DESC },
                }),
            ),
        )
        console.log(`[DI Sync] Synced ${transTypes.length} transaction types`)
    } catch (err) {
        console.error('[DI Sync] Failed to sync transaction types:', err)
    }

    // 6. SRO Item Codes
    try {
        const sroItems: Array<{ srO_ITEM_ID: number; srO_ITEM_DESC: string }> = await fetchWithToken(`${FBR_BASE}/pdi/v1/sroitemcode`)
        await prisma.$transaction(
            sroItems.map((s) =>
                prisma.dISROItem.upsert({
                    where: { id: s.srO_ITEM_ID },
                    create: { id: s.srO_ITEM_ID, description: s.srO_ITEM_DESC },
                    update: { description: s.srO_ITEM_DESC },
                }),
            ),
        )
        console.log(`[DI Sync] Synced ${sroItems.length} SRO item codes`)
    } catch (err) {
        console.error('[DI Sync] Failed to sync SRO item codes:', err)
    }

    console.log('[DI Sync] Reference data sync complete')
}

/** Categorize HS code by its chapter (first 2 digits) */
function categorizeHSCode(code: string): string {
    const chapter = parseInt(code.substring(0, 2), 10)
    if (chapter <= 5) return 'Animal Products'
    if (chapter <= 14) return 'Vegetable Products'
    if (chapter <= 15) return 'Fats & Oils'
    if (chapter <= 24) return 'Food & Beverages'
    if (chapter <= 27) return 'Mineral Products'
    if (chapter <= 38) return 'Chemicals'
    if (chapter <= 40) return 'Plastics & Rubber'
    if (chapter <= 43) return 'Leather & Fur'
    if (chapter <= 46) return 'Wood & Paper'
    if (chapter <= 49) return 'Paper Products'
    if (chapter <= 63) return 'Textiles'
    if (chapter <= 67) return 'Footwear & Headwear'
    if (chapter <= 70) return 'Stone & Glass'
    if (chapter <= 71) return 'Precious Metals'
    if (chapter <= 83) return 'Base Metals'
    if (chapter <= 85) return 'Electronics'
    if (chapter <= 89) return 'Transport'
    if (chapter <= 92) return 'Instruments'
    if (chapter <= 93) return 'Arms & Ammunition'
    if (chapter <= 96) return 'Miscellaneous'
    return 'Other'
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
