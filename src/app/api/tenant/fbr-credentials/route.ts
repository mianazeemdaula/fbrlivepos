import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantFromSession } from '@/lib/tenant/context'
import { encryptCredential } from '@/lib/crypto/credentials'
import { prisma } from '@/lib/db/prisma'
import { isValidSellerNtn, normalizeSellerNtn, normalizeNtnCnic } from '@/lib/validation/pakistan'

const DICredentialsSchema = z.object({
    sellerNTN: z.string().transform((value) => normalizeSellerNtn(value)).refine(isValidSellerNtn, 'NTN/registration must be 7, 8, or 9 digits'),
    sellerCNIC: z.string().optional().transform((value) => {
        const normalized = normalizeNtnCnic(value)
        return normalized || undefined
    }).refine((value) => value === undefined || value.length === 13, 'CNIC must be 13 digits'),
    sellerBusinessName: z.string().min(2),
    sellerProvince: z.string().min(1),
    sellerAddress: z.string().min(2),
    businessActivity: z.string().min(1),
    sector: z.string().min(1),
    // .trim() prevents whitespace from copy-paste causing silent 401s with PRAL
    sandboxToken: z.string().trim().optional(),
    productionToken: z.string().trim().optional(),
    environment: z.enum(['SANDBOX', 'PRODUCTION']).optional(),
})

export async function POST(req: NextRequest) {
    const { tenant } = await getTenantFromSession()
    const body = DICredentialsSchema.parse(await req.json())

    const encryptedSandboxToken = body.sandboxToken ? encryptCredential(body.sandboxToken) : undefined
    const encryptedProductionToken = body.productionToken ? encryptCredential(body.productionToken) : undefined

    await prisma.dICredentials.upsert({
        where: { tenantId: tenant.id },
        create: {
            tenantId: tenant.id,
            sellerNTN: body.sellerNTN,
            sellerCNIC: body.sellerCNIC ?? null,
            sellerBusinessName: body.sellerBusinessName,
            sellerProvince: body.sellerProvince,
            sellerAddress: body.sellerAddress,
            businessActivity: body.businessActivity,
            sector: body.sector,
            encryptedSandboxToken: encryptedSandboxToken ?? null,
            encryptedProductionToken: encryptedProductionToken ?? null,
            environment: body.environment ?? 'SANDBOX',
            irisRegistrationStatus: encryptedSandboxToken ? 'SANDBOX_ACCESS' : 'PENDING',
        },
        update: {
            sellerNTN: body.sellerNTN,
            sellerCNIC: body.sellerCNIC ?? null,
            sellerBusinessName: body.sellerBusinessName,
            sellerProvince: body.sellerProvince,
            sellerAddress: body.sellerAddress,
            businessActivity: body.businessActivity,
            sector: body.sector,
            ...(encryptedSandboxToken ? { encryptedSandboxToken } : {}),
            ...(encryptedProductionToken ? {
                encryptedProductionToken,
                isProductionReady: true,
                environment: 'PRODUCTION' as const,
                productionTokenIssuedAt: new Date(),
            } : {}),
            ...(body.environment ? { environment: body.environment } : {}),
            verificationError: null,
        },
    })

    return NextResponse.json({ success: true })
}

// GET — return DI credential info (tokens masked)
export async function GET() {
    const { tenant } = await getTenantFromSession()

    const creds = await prisma.dICredentials.findUnique({
        where: { tenantId: tenant.id },
    })

    if (!creds) {
        return NextResponse.json({ configured: false })
    }

    const scenarios = await prisma.sandboxScenario.findMany({
        where: { tenantId: tenant.id },
        orderBy: { scenarioId: 'asc' },
    })

    return NextResponse.json({
        configured: true,
        sellerNTN: creds.sellerNTN,
        sellerCNIC: creds.sellerCNIC,
        sellerBusinessName: creds.sellerBusinessName,
        sellerProvince: creds.sellerProvince,
        sellerAddress: creds.sellerAddress,
        businessActivity: creds.businessActivity,
        sector: creds.sector,
        environment: creds.environment,
        isProductionReady: creds.isProductionReady,
        irisRegistrationStatus: creds.irisRegistrationStatus,
        ipWhitelistStatus: creds.ipWhitelistStatus,
        sandboxCompleted: creds.sandboxCompleted,
        sandboxCompletedAt: creds.sandboxCompletedAt,
        tokenExpiresAt: creds.tokenExpiresAt,
        lastVerifiedAt: creds.lastVerifiedAt,
        verificationError: creds.verificationError,
        hasSandboxToken: !!creds.encryptedSandboxToken,
        hasProductionToken: !!creds.encryptedProductionToken,
        sandboxScenarios: scenarios,
        scenarios,
    })
}
