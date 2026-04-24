import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'
import { encryptCredential } from '@/lib/crypto/credentials'

const DISetupSchema = z.object({
    sellerNTN: z.string().min(7).max(13),
    sellerCNIC: z.string().length(13).optional().or(z.literal('')),
    sellerBusinessName: z.string().min(2),
    sellerProvince: z.string().min(2),
    sellerAddress: z.string().min(5),
    businessActivity: z.string().min(2),
    sector: z.string().min(2),
    sandboxToken: z.string().optional().or(z.literal('')),
    productionToken: z.string().optional().or(z.literal('')),
    environment: z.enum(['SANDBOX', 'PRODUCTION']).default('SANDBOX'),
})

export async function POST(req: NextRequest) {
    const { tenant } = await getTenantFromSession()
    const body = DISetupSchema.parse(await req.json())

    const existing = await prisma.dICredentials.findUnique({ where: { tenantId: tenant.id } })

    const encryptedSandboxToken = body.sandboxToken ? encryptCredential(body.sandboxToken) : existing?.encryptedSandboxToken
    const encryptedProductionToken = body.productionToken ? encryptCredential(body.productionToken) : existing?.encryptedProductionToken

    const data = {
        sellerNTN: body.sellerNTN,
        sellerCNIC: body.sellerCNIC || null,
        sellerBusinessName: body.sellerBusinessName,
        sellerProvince: body.sellerProvince,
        sellerAddress: body.sellerAddress,
        businessActivity: body.businessActivity,
        sector: body.sector,
        environment: body.environment,
        encryptedSandboxToken: encryptedSandboxToken ?? null,
        encryptedProductionToken: encryptedProductionToken ?? null,
        tokenExpiresAt: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
    }

    const creds = await prisma.dICredentials.upsert({
        where: { tenantId: tenant.id },
        create: { tenantId: tenant.id, ...data },
        update: data,
    })

    // Get applicable scenarios for this business activity + sector
    const scenarios = await prisma.dIBusinessScenario.findMany({
        where: { businessActivity: body.businessActivity, sector: body.sector },
        include: { scenario: true },
    })

    // Initialise SandboxScenario records for each applicable scenario
    for (const bs of scenarios) {
        await prisma.sandboxScenario.upsert({
            where: { tenantId_scenarioId: { tenantId: tenant.id, scenarioId: bs.scenarioId } },
            create: {
                tenantId: tenant.id,
                scenarioId: bs.scenarioId,
                description: bs.scenario.description,
                status: 'PENDING',
            },
            update: {},
        })
    }

    return NextResponse.json({ success: true, credentialsId: creds.id, scenariosInitialised: scenarios.length })
}

export async function GET() {
    const { tenant } = await getTenantFromSession()

    const creds = await prisma.dICredentials.findUnique({
        where: { tenantId: tenant.id },
        select: {
            id: true,
            sellerNTN: true,
            sellerCNIC: true,
            sellerBusinessName: true,
            sellerProvince: true,
            sellerAddress: true,
            businessActivity: true,
            sector: true,
            environment: true,
            irisRegistrationStatus: true,
            ipWhitelistStatus: true,
            sandboxCompleted: true,
            isProductionReady: true,
            tokenExpiresAt: true,
            // Never expose encrypted tokens
        },
    })

    if (!creds) {
        return NextResponse.json({ configured: false })
    }

    return NextResponse.json({ configured: true, ...creds })
}
