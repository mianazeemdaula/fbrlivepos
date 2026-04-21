import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantFromSession } from '@/lib/tenant/context'
import { getDIClientForTenant, DIAuthError, DIServerError } from '@/lib/di/client'
import { mapDIErrorCodes } from '@/lib/di/error-codes'
import { SCENARIO_DESCRIPTIONS, getRequiredScenarios } from '@/lib/di/scenarios'
import { buildSandboxScenarioPayload } from '@/lib/di/scenario-catalog'
import { getSellerIdentity } from '@/lib/di/seller'
import { prisma } from '@/lib/db/prisma'

const SandboxTestSchema = z.object({
    scenarioId: z.string().regex(/^SN\d{3}$/, 'Invalid scenario ID format'),
})

export async function POST(req: NextRequest) {
    const { tenant } = await getTenantFromSession()

    let body: z.infer<typeof SandboxTestSchema>
    try {
        body = SandboxTestSchema.parse(await req.json())
    } catch (err) {
        return NextResponse.json({ error: 'Invalid request data', details: err }, { status: 400 })
    }

    const { scenarioId } = body

    const creds = await prisma.dICredentials.findUnique({ where: { tenantId: tenant.id } })

    if (!creds) {
        return NextResponse.json(
            { error: 'DI credentials not configured. Please complete setup in Settings.' },
            { status: 422 },
        )
    }
    if (!creds.encryptedSandboxToken) {
        return NextResponse.json(
            { error: 'Sandbox token not configured. Paste your IRIS sandbox token in Settings.' },
            { status: 422 },
        )
    }
    if (creds.environment !== 'SANDBOX') {
        return NextResponse.json(
            { error: 'Switch to SANDBOX environment before running scenario tests.' },
            { status: 422 },
        )
    }
    if (!creds.sellerNTN && !creds.sellerCNIC) {
        return NextResponse.json(
            { error: 'Seller NTN or CNIC is required for sandbox submissions. Update it in Settings.' },
            { status: 422 },
        )
    }

    const payload = buildSandboxScenarioPayload(
        scenarioId,
        getSellerIdentity(creds, tenant),
    )

    const start = Date.now()

    try {
        const diClient = await getDIClientForTenant(tenant.id)
        const response = await diClient.postInvoice(payload)
        const isValid = response.validationResponse.statusCode === '00'

        await prisma.sandboxScenario.upsert({
            where: { tenantId_scenarioId: { tenantId: tenant.id, scenarioId } },
            create: {
                tenantId: tenant.id,
                scenarioId,
                description: SCENARIO_DESCRIPTIONS[scenarioId] ?? scenarioId,
                status: isValid ? 'PASSED' : 'FAILED',
                completedAt: isValid ? new Date() : null,
                invoiceNo: response.invoiceNumber ?? null,
                errorCode: response.validationResponse.errorCode ?? null,
                errorDetail: response.validationResponse.error ?? null,
            },
            update: {
                status: isValid ? 'PASSED' : 'FAILED',
                completedAt: isValid ? new Date() : null,
                invoiceNo: response.invoiceNumber ?? null,
                errorCode: response.validationResponse.errorCode ?? null,
                errorDetail: response.validationResponse.error ?? null,
            },
        })

        if (isValid) {
            await checkSandboxCompletion(tenant.id, creds.businessActivity, creds.sector)
        }

        const errors = !isValid ? mapDIErrorCodes(response.validationResponse) : []

        return NextResponse.json({
            success: isValid,
            scenarioId,
            diInvoiceNumber: response.invoiceNumber ?? null,
            errors,
            rawResponse: response,
            durationMs: Date.now() - start,
        })
    } catch (err) {
        const isAuth = err instanceof DIAuthError
        const message = isAuth
            ? 'PRAL sandbox token unauthorized (401). Most common causes: (1) Your server IP is not yet whitelisted by PRAL — whitelisting takes ~2 working hours after submission. (2) The token was pasted with extra whitespace — re-save it in Settings to auto-trim. (3) Token was issued for a different environment.'
            : err instanceof DIServerError
                ? 'PRAL server error. Try again later or contact PRAL support at dicrm.pral.com.pk'
                : (err as Error).message

        await prisma.sandboxScenario.upsert({
            where: { tenantId_scenarioId: { tenantId: tenant.id, scenarioId } },
            create: {
                tenantId: tenant.id,
                scenarioId,
                description: SCENARIO_DESCRIPTIONS[scenarioId] ?? scenarioId,
                status: 'FAILED',
                errorDetail: message,
            },
            update: {
                status: 'FAILED',
                errorDetail: message,
            },
        })

        return NextResponse.json({ success: false, error: message }, { status: isAuth ? 401 : 500 })
    }
}

async function checkSandboxCompletion(tenantId: string, businessActivity: string, sector: string) {
    const required = getRequiredScenarios(businessActivity, sector)
    const passed = await prisma.sandboxScenario.count({ where: { tenantId, status: 'PASSED' } })

    if (passed >= required.length) {
        await prisma.dICredentials.update({
            where: { tenantId },
            data: {
                sandboxCompleted: true,
                sandboxCompletedAt: new Date(),
                irisRegistrationStatus: 'PRODUCTION_READY',
            },
        })
    }
}
