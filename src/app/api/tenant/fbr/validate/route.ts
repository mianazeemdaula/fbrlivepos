import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { getDIClientForTenant, DIAuthError, DIConfigError, DIServerError } from '@/lib/di/client'
import { buildDIPayload } from '@/lib/di/payload-builder'
import { mapDIErrorCodes } from '@/lib/di/error-codes'
import { evaluateDISubmissionEligibility } from '@/lib/di/eligibility'
import { prisma } from '@/lib/db/prisma'
import { stringifyError } from '@/lib/fbr/submission-log'

export async function POST(req: NextRequest) {
    const { tenant } = await getTenantFromSession()
    const { invoiceId, scenarioId } = await req.json()

    let payload: ReturnType<typeof buildDIPayload> | null = null
    let resolvedScenarioId: string | null | undefined = undefined

    try {
        const [invoice, creds] = await Promise.all([
            prisma.invoice.findFirstOrThrow({
                where: { id: invoiceId, tenantId: tenant.id },
                include: { items: true },
            }),
            prisma.dICredentials.findUnique({
                where: { tenantId: tenant.id },
            }),
        ])

        if (!creds) {
            return NextResponse.json(
                { error: 'DI credentials not configured. Please set up your PRAL DI credentials in Settings.' },
                { status: 422 },
            )
        }

        const hasToken = creds.environment === 'SANDBOX'
            ? !!creds.encryptedSandboxToken
            : !!creds.encryptedProductionToken

        if (!hasToken) {
            return NextResponse.json(
                { error: 'Your PRAL DI token is not configured. Please complete IRIS registration.' },
                { status: 422 },
            )
        }

        const isSandbox = creds.environment === 'SANDBOX'
        if (isSandbox) {
            let dbScenarioId: string | undefined = undefined;
            if (invoice.items.length > 0 && invoice.items[0].diSaleType) {
                const dbScenario = await prisma.dIScenario.findFirst({
                    where: { saleType: invoice.items[0].diSaleType },
                    select: { id: true }
                });
                if (dbScenario) {
                    dbScenarioId = dbScenario.id;
                }
            }

            const fallbackScenarioId = invoice.buyerRegistrationType === 'Registered'
                ? 'SN001'
                : 'SN002'
            resolvedScenarioId = scenarioId ?? invoice.diScenarioId ?? dbScenarioId ?? fallbackScenarioId
        } else {
            resolvedScenarioId = undefined
        }

        const eligibility = evaluateDISubmissionEligibility({
            creds,
            invoice,
            scenarioId: resolvedScenarioId,
        })

        if (!eligibility.eligible) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invoice is not eligible for PRAL DI validation yet.',
                    eligibility,
                },
                { status: 422 },
            )
        }

        const diClient = await getDIClientForTenant(tenant.id)
        payload = buildDIPayload(invoice, creds, {
            isSandbox,
            scenarioId: resolvedScenarioId ?? undefined,
            preferredIdType: tenant.preferredIdType === 'CNIC' ? 'CNIC' : 'NTN',
        })

        const validation = await diClient.validateInvoice(payload)
        
        if (validation.validationResponse.statusCode === '01') {
            const errors = mapDIErrorCodes(validation.validationResponse)
            return NextResponse.json(
                { success: false, valid: false, errors, rawResponse: validation, payload },
                { status: 422 },
            )
        }

        return NextResponse.json({
            success: true,
            valid: true,
            rawResponse: validation,
            payload
        })
    } catch (err) {
        const errorMessage = stringifyError(err)

        if (err instanceof DIAuthError) {
            return NextResponse.json(
                {
                    error: 'Your PRAL DI token was rejected by PRAL (401 Unauthorized). Verify token and IP whitelisting.',
                    action: 'UPDATE_TOKEN',
                },
                { status: 401 },
            )
        }

        if (err instanceof DIConfigError) {
            return NextResponse.json(
                { error: errorMessage, action: 'COMPLETE_REGISTRATION' },
                { status: 422 },
            )
        }

        if (err instanceof DIServerError) {
            return NextResponse.json({
                success: false,
                error: 'PRAL server error during validation.',
            }, { status: 502 })
        }

        return NextResponse.json(
            { success: false, error: 'PRAL DI validation failed', details: errorMessage },
            { status: 500 },
        )
    }
}
