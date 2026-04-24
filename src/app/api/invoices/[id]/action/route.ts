import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { getDIClientForTenant, DIAuthError, DIConfigError } from '@/lib/di/client'
import { buildDIPayload } from '@/lib/di/payload-builder'
import { mapDIErrorCodes } from '@/lib/di/error-codes'
import { evaluateDISubmissionEligibility } from '@/lib/di/eligibility'
import { inferSandboxScenario } from '@/lib/di/scenario-catalog'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@/generated/prisma/client'
import {
    getNextSubmissionAttempt,
    recordFBRSubmissionLog,
    stringifyError,
    updateInvoiceForTenant,
} from '@/lib/fbr/submission-log'

// POST /api/invoices/[id]/action  body: { action: 'validate' | 'confirm' }
// validate → calls FBR validateinvoicedata (dry-run, no FBR number issued)
// confirm  → calls FBR postinvoicedata (real submission, FBR number assigned, invoice locked)
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { tenant } = await getTenantFromSession()
    const { id: invoiceId } = await params
    const { action } = await req.json() as { action: 'validate' | 'confirm' }

    if (action !== 'validate' && action !== 'confirm') {
        return NextResponse.json({ error: 'action must be "validate" or "confirm"' }, { status: 400 })
    }

    const start = Date.now()
    const attempt = await getNextSubmissionAttempt(tenant.id, invoiceId)

    let payload: ReturnType<typeof buildDIPayload> | null = null
    try {
        const [invoice, creds] = await Promise.all([
            prisma.invoice.findFirstOrThrow({
                where: { id: invoiceId, tenantId: tenant.id },
                include: { items: true },
            }),
            prisma.dICredentials.findUnique({ where: { tenantId: tenant.id } }),
        ])

        // Guard: CONFIRMED invoices cannot be re-submitted
        if (action === 'confirm' && invoice.status === 'CONFIRMED') {
            return NextResponse.json(
                { error: 'Invoice is already confirmed and locked. Use a Debit Note to make corrections.' },
                { status: 409 },
            )
        }

        if (!creds) {
            return NextResponse.json(
                { error: 'DI credentials not configured. Set up PRAL DI in Settings first.' },
                { status: 422 },
            )
        }

        const hasToken = creds.environment === 'SANDBOX'
            ? !!creds.encryptedSandboxToken
            : !!creds.encryptedProductionToken

        if (!hasToken) {
            return NextResponse.json(
                { error: 'PRAL DI token not configured. Complete IRIS registration.' },
                { status: 422 },
            )
        }

        const isSandbox = creds.environment === 'SANDBOX'
        // Resolve sandbox scenarioId
        let scenarioId: string | undefined
        if (isSandbox) {
            let dbScenarioId: string | undefined = undefined;
            if (invoice.items.length > 0 && invoice.items[0].diSaleType) {
                const dbScenario = await prisma.dIScenario.findFirst({
                    where: { saleType: {
                        equals: invoice.items[0].diSaleType.toLowerCase(),
                        mode: 'insensitive'
                    }},
                    select: { id: true }
                });
                if (dbScenario) {
                    dbScenarioId = dbScenario.id;
                    invoice.diScenarioId = dbScenarioId;
                }
            }

            const fallbackScenarioId = invoice.buyerRegistrationType === 'Registered'
                ? 'SN001'
                : 'SN002'
            scenarioId = scenarioId ?? invoice.diScenarioId ?? dbScenarioId ?? fallbackScenarioId
        }

        // Update stored scenarioId if it changed
        if (scenarioId && scenarioId !== invoice.diScenarioId) {
            await prisma.invoice.updateMany({
                where: { id: invoiceId, tenantId: tenant.id },
                data: { diScenarioId: scenarioId },
            })
            invoice.diScenarioId = scenarioId
        }

        const eligibility = evaluateDISubmissionEligibility({
            creds,
            invoice,
            scenarioId: scenarioId,
        })

        if (!eligibility.eligible) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invoice is not eligible for PRAL DI submission.',
                    eligibility,
                },
                { status: 422 },
            )
        }

        const diClient = await getDIClientForTenant(tenant.id)
        payload = buildDIPayload(invoice, creds, {
            isSandbox,
            scenarioId: scenarioId,
            preferredIdType: tenant.preferredIdType === 'CNIC' ? 'CNIC' : 'NTN',
        })

        // ── VALIDATE action ──────────────────────────────────────────────────
        console.log(payload)
        const validation = await diClient.validateInvoice(payload)
        console.log(validation)
        if (validation.validationResponse.statusCode === '01') {
            const errors = mapDIErrorCodes(validation.validationResponse)

            // On validation failure always reset to DRAFT so user can fix and retry
            await Promise.all([
                updateInvoiceForTenant(tenant.id, invoiceId, {
                    status: 'DRAFT',
                    lastValidatedAt: new Date(),
                    lastValidationResult: JSON.parse(JSON.stringify(validation)) as Prisma.InputJsonValue,
                    diStatusCode: validation.validationResponse.statusCode,
                    diStatus: validation.validationResponse.status,
                    diErrorCode: validation.validationResponse.errorCode ?? null,
                    diErrorMessage: validation.validationResponse.error ?? null,
                    diItemStatuses: validation.validationResponse.invoiceStatuses
                        ? (JSON.parse(JSON.stringify(validation.validationResponse.invoiceStatuses)) as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                }),
                recordFBRSubmissionLog({
                    tenantId: tenant.id,
                    invoiceId,
                    attempt,
                    requestBody: payload,
                    responseCode: 422,
                    responseBody: validation,
                    error: validation.validationResponse.error ?? 'Validation failed',
                    durationMs: Date.now() - start,
                }),
            ])

            return NextResponse.json({ success: false, action: 'validate', valid: false, errors, rawResponse: validation }, { status: 422 })
        }

        // Validation passed
        if (action === 'validate') {
            await Promise.all([
                updateInvoiceForTenant(tenant.id, invoiceId, {
                    status: 'VALIDATED',
                    lastValidatedAt: new Date(),
                    lastValidationResult: JSON.parse(JSON.stringify(validation)) as Prisma.InputJsonValue,
                    diStatusCode: validation.validationResponse.statusCode,
                    diStatus: validation.validationResponse.status,
                    diErrorCode: null,
                    diErrorMessage: null,
                    diItemStatuses: validation.validationResponse.invoiceStatuses
                        ? (JSON.parse(JSON.stringify(validation.validationResponse.invoiceStatuses)) as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                }),
                recordFBRSubmissionLog({
                    tenantId: tenant.id,
                    invoiceId,
                    attempt,
                    requestBody: payload,
                    responseCode: 200,
                    responseBody: validation,
                    durationMs: Date.now() - start,
                }),
            ])
            return NextResponse.json({ success: true, action: 'validate', valid: true, rawResponse: validation })
        }

        // ── CONFIRM action (postinvoicedata) ─────────────────────────────────
        const response = await diClient.postInvoice(payload)
        const isValid = response.validationResponse.statusCode === '00'

        await Promise.all([
            updateInvoiceForTenant(tenant.id, invoiceId, {
                status: isValid ? 'CONFIRMED' : 'FAILED',
                confirmedAt: isValid ? new Date() : null,
                diInvoiceNumber: response.invoiceNumber ?? null,
                diInvoiceDate: response.dated ? new Date(response.dated) : null,
                diStatusCode: response.validationResponse.statusCode,
                diStatus: response.validationResponse.status,
                diItemStatuses: response.validationResponse.invoiceStatuses
                    ? (JSON.parse(JSON.stringify(response.validationResponse.invoiceStatuses)) as Prisma.InputJsonValue)
                    : Prisma.DbNull,
                diErrorCode: response.validationResponse.errorCode ?? null,
                diErrorMessage: response.validationResponse.error ?? null,
                qrCodeData: response.invoiceNumber ?? null,
                submissionError: null,
                retryCount: 0,
            }),
            recordFBRSubmissionLog({
                tenantId: tenant.id,
                invoiceId,
                attempt,
                requestBody: payload,
                responseCode: 200,
                responseBody: response,
                durationMs: Date.now() - start,
            }),
        ])

        return NextResponse.json({
            success: true,
            action: 'confirm',
            valid: isValid,
            diInvoiceNumber: response.invoiceNumber,
            response,
        })
    } catch (err) {
        const errorMessage = stringifyError(err)
        console.error(errorMessage)
        if (err instanceof DIAuthError) {
            const msg = 'PRAL DI token rejected (401). Check your IP whitelist and token in Settings.'
            await Promise.allSettled([
                updateInvoiceForTenant(tenant.id, invoiceId, { status: 'FAILED', submissionError: msg }),
                recordFBRSubmissionLog({ tenantId: tenant.id, invoiceId, attempt, requestBody: payload, responseCode: 401, error: err, durationMs: Date.now() - start }),
            ])
            return NextResponse.json({ error: msg }, { status: 401 })
        }

        if (err instanceof DIConfigError) {
            return NextResponse.json({ error: err.message }, { status: 422 })
        }

        await Promise.allSettled([
            updateInvoiceForTenant(tenant.id, invoiceId, { status: 'FAILED', submissionError: errorMessage }),
            recordFBRSubmissionLog({ tenantId: tenant.id, invoiceId, attempt, requestBody: payload, responseCode: 500, error: err, durationMs: Date.now() - start }),
        ])
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
