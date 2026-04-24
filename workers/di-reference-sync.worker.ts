// Reference data sync worker — run on platform startup and then every 24 hours
// Usage: npx tsx workers/di-reference-sync.worker.ts

import { prisma } from '../src/lib/db/prisma'
import { ALL_SCENARIO_IDS } from '../src/lib/di/scenarios'
import { getScenarioPreview } from '../src/lib/di/scenario-catalog'

const FBR_BASE = 'https://gw.fbr.gov.pk'
// Use YOUR platform's sandbox token for reference syncing
const PLATFORM_TOKEN = process.env.PRAL_PLATFORM_TOKEN!

type ProvinceEntry = { stateProvinceCode: number; stateProvinceDesc: string }
type DocumentTypeEntry = { docTypeId: number; docDescription: string }
type UOMEntry = { uoM_ID: number; description: string }
type ItemDescriptionEntry = { hS_CODE: string; description: string }
type TransactionTypeEntry = { transactioN_TYPE_ID: number; transactioN_DESC: string }
type SROItemEntry = { srO_ITEM_ID: number; srO_ITEM_DESC: string }
type RateEntry = { ratE_ID: number; ratE_DESC: string; ratE_VALUE: number }
type SROScheduleEntry = { srO_ID: number; srO_DESC: string }
async function fetchWithToken<T>(url: string): Promise<T> {
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${PLATFORM_TOKEN}` },
        signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`Reference API ${url} returned ${res.status}`)
    return res.json() as Promise<T>
}

function formatReferenceDate(date = new Date()) {
    return date.toISOString().split('T')[0]
}

function chunked<T>(items: T[], size: number) {
    const chunks: T[][] = []

    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size))
    }

    return chunks
}

async function syncHSCodeUOMReference(hsCode: string, annexureId = 3) {
    const entries = await fetchWithToken<UOMEntry[]>(
        `${FBR_BASE}/pdi/v2/HS_UOM?hs_code=${encodeURIComponent(hsCode)}&annexure_id=${annexureId}`,
    )

    if (!Array.isArray(entries) || entries.length === 0) {
        return []
    }

    await prisma.$transaction(async (tx) => {
        for (const entry of entries) {
            await tx.dIUnitOfMeasure.upsert({
                where: { id: entry.uoM_ID },
                create: { id: entry.uoM_ID, description: entry.description },
                update: { description: entry.description },
            })

            await tx.dIHSCodeUOM.upsert({
                where: {
                    hsCode_uomId_annexureId: {
                        hsCode,
                        uomId: entry.uoM_ID,
                        annexureId,
                    },
                },
                create: {
                    hsCode,
                    uomId: entry.uoM_ID,
                    uomDesc: entry.description,
                    annexureId,
                },
                update: {
                    uomDesc: entry.description,
                },
            })
        }
    })

    if (entries.length === 1) {
        await prisma.hSCode.updateMany({
            where: { code: hsCode },
            data: { unit: entries[0].description },
        })
    }

    return entries
}

async function syncSaleTypeToRateReference(referenceDate: string) {
    const transactionTypes = await prisma.dITransactionType.findMany({ orderBy: { id: 'asc' } })
    const provinces = await prisma.dIProvince.findMany({ orderBy: { code: 'asc' } })
    const rateIds = new Set<number>()
    let syncedRates = 0

    for (const transactionType of transactionTypes) {
        await prisma.dISaleType.upsert({
            where: { code: String(transactionType.id) },
            create: {
                code: String(transactionType.id),
                description: transactionType.description,
            },
            update: {
                description: transactionType.description,
            },
        })

        for (const province of provinces) {
            try {
                const rates = await fetchWithToken<RateEntry[]>(
                    `${FBR_BASE}/pdi/v2/SaleTypeToRate?date=${referenceDate}&transTypeId=${transactionType.id}&originationSupplier=${province.code}`,
                )

                if (!Array.isArray(rates) || rates.length === 0) {
                    continue
                }

                await prisma.$transaction(
                    rates.map((rate) =>
                        prisma.dIRate.upsert({
                            where: { id: rate.ratE_ID },
                            create: {
                                id: rate.ratE_ID,
                                description: rate.ratE_DESC,
                                value: rate.ratE_VALUE,
                            },
                            update: {
                                description: rate.ratE_DESC,
                                value: rate.ratE_VALUE,
                            },
                        }),
                    ),
                )

                for (const rate of rates) {
                    rateIds.add(rate.ratE_ID)
                }
                syncedRates += rates.length
            } catch (err) {
                console.warn(
                    `[DI Sync] SaleTypeToRate skipped for transTypeId=${transactionType.id}, province=${province.code}: ${err instanceof Error ? err.message : String(err)}`
                )
            }
        }
    }

    console.log(`[DI Sync] Synced ${syncedRates} sale-type rate rows across ${transactionTypes.length} transaction types`)
    return [...rateIds]
}

async function syncSroScheduleReference(referenceDate: string, rateIds: number[]) {
    const provinces = await prisma.dIProvince.findMany({ orderBy: { code: 'asc' } })
    const sroIds = new Set<number>()
    let syncedSchedules = 0

    for (const rateId of rateIds) {
        for (const province of provinces) {
            try {
                const schedules = await fetchWithToken<SROScheduleEntry[]>(
                    `${FBR_BASE}/pdi/v1/SroSchedule?rate_id=${rateId}&date=${referenceDate}&origination_supplier_csv=${province.code}`,
                )

                if (!Array.isArray(schedules) || schedules.length === 0) {
                    continue
                }

                await prisma.$transaction(
                    schedules.map((schedule) =>
                        prisma.dISROSchedule.upsert({
                            where: { id: schedule.srO_ID },
                            create: {
                                id: schedule.srO_ID,
                                description: schedule.srO_DESC,
                            },
                            update: {
                                description: schedule.srO_DESC,
                            },
                        }),
                    ),
                )

                for (const schedule of schedules) {
                    sroIds.add(schedule.srO_ID)
                }
                syncedSchedules += schedules.length
            } catch (err) {
                console.warn(
                    `[DI Sync] Schedule sync skipped for rateId=${rateId}, province=${province.code}: ${err instanceof Error ? err.message : String(err)}`
                )
            }
        }
    }

    console.log(`[DI Sync] Synced ${syncedSchedules} SRO schedule rows from ${rateIds.length} rate ids`)
    return [...sroIds]
}

async function syncSroItemDetailsReference(referenceDate: string, sroIds: number[]) {
    let syncedItems = 0

    for (const sroId of sroIds) {
        try {
            const items = await fetchWithToken<SROItemEntry[]>(
                `${FBR_BASE}/pdi/v2/SROItem?date=${referenceDate}&sro_id=${sroId}`,
            )

            if (!Array.isArray(items) || items.length === 0) {
                continue
            }

            await prisma.$transaction(
                items.map((item) =>
                    prisma.dISROItem.upsert({
                        where: { id: item.srO_ITEM_ID },
                        create: {
                            id: item.srO_ITEM_ID,
                            description: item.srO_ITEM_DESC,
                        },
                        update: {
                            description: item.srO_ITEM_DESC,
                        },
                    }),
                ),
            )

            syncedItems += items.length
        } catch (err) {
            console.warn(`[DI Sync] SROItem skipped for sro_id=${sroId}:`, err)
        }
    }

    console.log(`[DI Sync] Synced ${syncedItems} SRO item-detail rows from ${sroIds.length} schedule ids`)
}

async function syncPriorityHSCodeUOMs() {
    const hsCodes = new Set<string>()

    for (const scenarioId of ALL_SCENARIO_IDS) {
        for (const item of getScenarioPreview(scenarioId).items) {
            hsCodes.add(item.hsCode)
        }
    }

    const existingProducts = await prisma.product.findMany({
        select: { hsCode: true },
        distinct: ['hsCode'],
    })

    for (const product of existingProducts) {
        hsCodes.add(product.hsCode)
    }

    let syncedHsCodes = 0
    for (const hsCode of hsCodes) {
        try {
            const entries = await syncHSCodeUOMReference(hsCode)
            if (entries.length > 0) {
                syncedHsCodes += 1
            }
        } catch (err) {
            console.warn(`[DI Sync] HS_UOM skipped for hs_code=${hsCode}:`, err)
        }
    }

    console.log(`[DI Sync] Synced HS_UOM reference data for ${syncedHsCodes} priority HS codes`)
}

export async function syncAllReferenceData() {
    console.log('[DI Sync] Starting reference data sync...')
    const referenceDate = formatReferenceDate()

    // 1. Provinces
    try {
        const provinces = await fetchWithToken<ProvinceEntry[]>(`${FBR_BASE}/pdi/v1/provinces`)
        await prisma.$transaction(
            provinces.map((p) =>
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
        const docTypes = await fetchWithToken<DocumentTypeEntry[]>(`${FBR_BASE}/pdi/v1/doctypecode`)
        await prisma.$transaction(
            docTypes.map((d) =>
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
        const uoms = await fetchWithToken<UOMEntry[]>(`${FBR_BASE}/pdi/v1/uom`)
        await prisma.$transaction(
            uoms.map((u) =>
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
        const items = await fetchWithToken<ItemDescriptionEntry[]>(`${FBR_BASE}/pdi/v1/itemdesccode`)
        let synced = 0
        // Batch in chunks of 50 to avoid transaction size limits
        for (const chunk of chunked(items, 50)) {
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
        for (const chunk of chunked(items, 50)) {
            await prisma.$transaction(
                chunk.map((item) =>
                    prisma.hSCode.upsert({
                        where: { code: item.hS_CODE },
                        create: {
                            code: item.hS_CODE,
                            description: item.description,
                            category: categorizeHSCode(item.hS_CODE),
                            defaultTaxRate: 18,
                            isFBRActive: true,
                        },
                        update: {
                            description: item.description,
                            category: categorizeHSCode(item.hS_CODE),
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
        const transTypes = await fetchWithToken<TransactionTypeEntry[]>(`${FBR_BASE}/pdi/v1/transtypecode`)
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
        const sroItems = await fetchWithToken<SROItemEntry[]>(`${FBR_BASE}/pdi/v1/sroitemcode`)
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

    // 7. Sale Type to Rate
    let rateIds: number[] = []
    try {
        rateIds = await syncSaleTypeToRateReference(referenceDate)
    } catch (err) {
        console.error('[DI Sync] Failed to sync SaleTypeToRate reference data:', err)
    }

    // 8. SRO Schedule
    let sroIds: number[] = []
    try {
        sroIds = await syncSroScheduleReference(referenceDate, rateIds)
    } catch (err) {
        console.error('[DI Sync] Failed to sync SRO schedule reference data:', err)
    }

    // 9. SRO Item Details
    try {
        await syncSroItemDetailsReference(referenceDate, sroIds)
    } catch (err) {
        console.error('[DI Sync] Failed to sync SRO item-detail reference data:', err)
    }

    // 10. HS Code to UOM for priority HS codes
    try {
        await syncPriorityHSCodeUOMs()
    } catch (err) {
        console.error('[DI Sync] Failed to sync HS_UOM reference data:', err)
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
