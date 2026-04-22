import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'
import { getDIClientForTenant } from '@/lib/di/client'
import { buildSandboxScenarioPayload } from '@/lib/di/scenario-catalog'
import { getSellerIdentity } from '@/lib/di/seller'

export async function POST(req: NextRequest) {
    const { tenant } = await getTenantFromSession()

    const creds = await prisma.dICredentials.findUnique({
        where: { tenantId: tenant.id },
    })

    if (!creds) {
        return NextResponse.json(
            { success: false, error: 'No DI credentials configured. Please set up your PRAL DI credentials.' },
            { status: 422 },
        )
    }

    const tokenField = creds.environment === 'SANDBOX'
        ? creds.encryptedSandboxToken
        : creds.encryptedProductionToken

    if (!tokenField) {
        return NextResponse.json(
            { success: false, error: `No ${creds.environment.toLowerCase()} token configured. Please enter your IRIS security token.` },
            { status: 422 },
        )
    }

    try {
        const diClient = await getDIClientForTenant(tenant.id)
        const probePayload = buildSandboxScenarioPayload('SN001', getSellerIdentity(creds, tenant))

        // Verify against the actual DI validate endpoint used by sandbox submissions.
        const start = Date.now()
        await diClient.validateInvoice(probePayload)

        const latencyMs = Date.now() - start

        diClient.resetCircuit()

        await prisma.dICredentials.update({
            where: { tenantId: tenant.id },
            data: {
                lastVerifiedAt: new Date(),
                verificationError: null,
            },
        })

        return NextResponse.json({
            success: true,
            latencyMs,
            message: 'PRAL DI connection verified successfully',
        })
    } catch (err) {
        await prisma.dICredentials.update({
            where: { tenantId: tenant.id },
            data: {
                verificationError: String(err),
            },
        })

        return NextResponse.json(
            { success: false, error: String(err) },
            { status: 422 },
        )
    }
}
