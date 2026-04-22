import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'
import { DIAuthError, DIHttpError, DIServerError, getDIClientForTenant } from '@/lib/di/client'
import { buildSandboxScenarioPayload } from '@/lib/di/scenario-catalog'
import { getSellerIdentity } from '@/lib/di/seller'
import { appendDIDebugLog } from '@/lib/di/debug-log'

export async function POST(req: NextRequest) {
    const { tenant } = await getTenantFromSession()
    let probePayload: ReturnType<typeof buildSandboxScenarioPayload> | null = null

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
        probePayload = buildSandboxScenarioPayload('SN001', getSellerIdentity(creds, tenant))

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

        await appendDIDebugLog({
            tenantId: tenant.id,
            event: 'VERIFY_SUCCESS',
            operation: 'validateInvoice',
            environment: creds.environment,
            endpoint: creds.environment === 'SANDBOX'
                ? 'https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb'
                : 'https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata',
            status: 200,
            message: 'Token verification succeeded via probe payload SN001',
            metadata: {
                latencyMs,
                tenantId: tenant.id,
            },
        }).catch(console.error)

        return NextResponse.json({
            success: true,
            latencyMs,
            message: 'PRAL DI connection verified successfully',
        })
    } catch (err) {
        const errorName = err instanceof Error ? err.name : 'UnknownError'
        const errorMessage = err instanceof Error ? err.message : String(err)

        const status = err instanceof DIAuthError || err instanceof DIServerError || err instanceof DIHttpError
            ? err.context?.status
            : undefined

        const endpoint = err instanceof DIAuthError || err instanceof DIServerError || err instanceof DIHttpError
            ? err.context?.endpoint
            : undefined

        const responseBody = err instanceof DIAuthError || err instanceof DIServerError || err instanceof DIHttpError
            ? err.context?.responseBody
            : undefined

        const logFile = await appendDIDebugLog({
            tenantId: tenant.id,
            event: 'VERIFY_FAILURE',
            operation: 'validateInvoice',
            environment: creds.environment,
            endpoint,
            status,
            errorName,
            errorMessage,
            responseBody,
            payload: probePayload,
            metadata: {
                tenantId: tenant.id,
                hint: 'If localhost works but live fails, confirm live outbound server IP is whitelisted in PRAL.',
            },
        }).catch((logErr) => {
            console.error(logErr)
            return null
        })

        const finalErrorText = logFile
            ? `${errorMessage} Debug log: ${logFile}`
            : errorMessage

        await prisma.dICredentials.update({
            where: { tenantId: tenant.id },
            data: {
                verificationError: finalErrorText,
            },
        })

        return NextResponse.json(
            {
                success: false,
                error: finalErrorText,
                debugLogFile: logFile,
                hint: 'If localhost works and live fails, the live server outbound IP may differ from the IP you whitelisted.',
            },
            { status: 422 },
        )
    }
}
