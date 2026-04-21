import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'
import { decryptCredential } from '@/lib/crypto/credentials'

const FBR_BASE = 'https://gw.fbr.gov.pk'

interface PRALUOMEntry {
    uoM_ID: number
    description: string
}

export async function GET(req: NextRequest) {
    const { tenant } = await getTenantFromSession()

    const hsCode = req.nextUrl.searchParams.get('hs_code')
    const annexureId = Math.max(1, Number(req.nextUrl.searchParams.get('annexure_id') ?? 3))
    if (!hsCode) {
        return NextResponse.json({ error: 'hs_code query param is required' }, { status: 400 })
    }

    const cachedUOMs = await prisma.dIHSCodeUOM.findMany({
        where: {
            hsCode,
            annexureId,
        },
        orderBy: { uomDesc: 'asc' },
        select: {
            uomId: true,
            uomDesc: true,
        },
    })

    if (cachedUOMs.length > 0) {
        return NextResponse.json({
            uoms: cachedUOMs.map((entry) => ({
                id: entry.uomId,
                description: entry.uomDesc,
            })),
            source: 'database',
        })
    }

    const creds = await prisma.dICredentials.findUnique({
        where: { tenantId: tenant.id },
    })

    if (!creds) {
        return NextResponse.json({ error: 'No DI credentials configured' }, { status: 422 })
    }

    const tokenField = creds.environment === 'SANDBOX'
        ? creds.encryptedSandboxToken
        : creds.encryptedProductionToken

    if (!tokenField) {
        return NextResponse.json({ error: 'No token configured for current environment' }, { status: 422 })
    }

    try {
        const token = decryptCredential(tokenField)
        const url = `${FBR_BASE}/pdi/v2/HS_UOM?hs_code=${encodeURIComponent(hsCode)}&annexure_id=${annexureId}`
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: AbortSignal.timeout(10_000),
        })

        if (res.status === 401) {
            console.error('[HS-UOM] PRAL token unauthorized:', await res.text())
            return NextResponse.json({ error: 'PRAL token unauthorized' }, { status: 401 })
        }

        if (!res.ok) {
            console.error('[HS-UOM] PRAL API error:', await res.text())

            return NextResponse.json({ error: `PRAL API returned ${res.status}` }, { status: 502 })
        }
        const data = (await res.json()) as PRALUOMEntry[]
        const uoms = Array.isArray(data)
            ? data.map((entry) => ({ id: entry.uoM_ID, description: entry.description }))
            : []

        if (uoms.length > 0) {
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
            })

            if (uoms.length === 1) {
                await prisma.hSCode.updateMany({
                    where: { code: hsCode },
                    data: { unit: uoms[0].description },
                })
            }
        }

        return NextResponse.json({ uoms, source: 'pral' })
    } catch (err) {
        console.error('[HS-UOM] Failed to fetch UOMs from PRAL:', err)
        return NextResponse.json({ error: 'Failed to reach PRAL API' }, { status: 502 })
    }
}
