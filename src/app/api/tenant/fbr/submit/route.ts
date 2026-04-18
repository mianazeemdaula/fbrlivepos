import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { getDIClientForTenant, DIAuthError, DIConfigError, DIServerError } from '@/lib/di/client'
import { buildDIPayload } from '@/lib/di/payload-builder'
import { mapDIErrorCodes } from '@/lib/di/error-codes'
import { enqueueInvoiceSubmission } from '@/lib/fbr/queue'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@/generated/prisma/client'
import {
    getNextSubmissionAttempt,
    recordFBRSubmissionLog,
    stringifyError,
    updateInvoiceForTenant,
} from '@/lib/fbr/submission-log'

export async function POST(req: NextRequest) {
    const { tenant } = await getTenantFromSession()
    const { invoiceId } = await req.json()

    const start = Date.now()
    const attempt = await getNextSubmissionAttempt(tenant.id, invoiceId)
    let payload: ReturnType<typeof buildDIPayload> | null = null

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
            await recordFBRSubmissionLog({
                tenantId: tenant.id,
                invoiceId,
                attempt,
                error: 'DI credentials not configured',
                durationMs: Date.now() - start,
            })

            return NextResponse.json(
                { error: 'DI credentials not configured. Please set up your PRAL DI credentials in Settings.' },
                { status: 422 },
            )
        }

        const hasToken = creds.environment === 'SANDBOX'
            ? !!creds.encryptedSandboxToken
            : !!creds.encryptedProductionToken

        if (!hasToken) {
            await recordFBRSubmissionLog({
                tenantId: tenant.id,
                invoiceId,
                attempt,
                error: 'PRAL DI token not configured',
                durationMs: Date.now() - start,
            })

            return NextResponse.json(
                { error: 'Your PRAL DI token is not configured. Please complete IRIS registration.' },
                { status: 422 },
            )
        }

        const diClient = await getDIClientForTenant(tenant.id)
        payload = buildDIPayload(invoice, creds, {
            isSandbox: creds.environment === 'SANDBOX',
        })

        if (diClient.getCircuitState().state === 'OPEN') {
            await recordFBRSubmissionLog({
                tenantId: tenant.id,
                invoiceId,
                attempt,
                requestBody: payload,
                error: 'Circuit breaker open. Invoice queued for retry.',
                durationMs: Date.now() - start,
            })

            await enqueueInvoiceSubmission(tenant.id, invoiceId)
            return NextResponse.json({
                success: true,
                offline: true,
                message: 'PRAL DI service temporarily unavailable. Invoice queued for automatic retry.',
            })
        }

        const validation = await diClient.validateInvoice(payload)
        if (validation.validationResponse.statusCode === '01') {
            const errors = mapDIErrorCodes(validation.validationResponse)

            await Promise.all([
                updateInvoiceForTenant(tenant.id, invoiceId, {
                    status: 'FAILED',
                    submissionError: validation.validationResponse.error ?? 'PRAL DI validation failed',
                    diStatusCode: validation.validationResponse.statusCode,
                    diStatus: validation.validationResponse.status,
                    diItemStatuses: validation.validationResponse.invoiceStatuses
                        ? (JSON.parse(JSON.stringify(validation.validationResponse.invoiceStatuses)) as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                    diErrorCode: validation.validationResponse.errorCode ?? null,
                    diErrorMessage: validation.validationResponse.error ?? null,
                    retryCount: attempt,
                }),
                recordFBRSubmissionLog({
                    tenantId: tenant.id,
                    invoiceId,
                    attempt,
                    requestBody: payload,
                    responseCode: 422,
                    responseBody: validation,
                    error: validation.validationResponse.error ?? 'PRAL DI validation failed',
                    durationMs: Date.now() - start,
                }),
            ])

            return NextResponse.json(
                { success: false, valid: false, errors, rawResponse: validation },
                { status: 422 },
            )
        }

        const response = await diClient.postInvoice(payload)
        const isValid = response.validationResponse.statusCode === '00'

        await Promise.all([
            updateInvoiceForTenant(tenant.id, invoiceId, {
                status: isValid ? 'SUBMITTED' : 'FAILED',
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
                retryCount: 0,
                submissionError: null,
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
            valid: isValid,
            diInvoiceNumber: response.invoiceNumber,
            response,
        })
    } catch (err) {
        const errorMessage = stringifyError(err)

        if (err instanceof DIAuthError) {
            const authErrorMessage =
                'Your PRAL DI token was rejected by PRAL (401 Unauthorized). Most common causes: (1) Your server IP is not yet whitelisted by PRAL — submit your IP in Settings and allow ~2 working hours for approval. (2) Token pasted with extra whitespace — re-save it in Settings → PRAL DI Setup to auto-trim. (3) Token expired or belongs to a different environment.'

            await Promise.allSettled([
                updateInvoiceForTenant(tenant.id, invoiceId, {
                    status: 'FAILED',
                    submissionError: authErrorMessage,
                    retryCount: attempt,
                }),
                recordFBRSubmissionLog({
                    tenantId: tenant.id,
                    invoiceId,
                    attempt,
                    requestBody: payload,
                    responseCode: 401,
                    error: err,
                    durationMs: Date.now() - start,
                }),
            ])

            return NextResponse.json(
                {
                    error: authErrorMessage,
                    action: 'UPDATE_TOKEN',
                },
                { status: 401 },
            )
        }

        if (err instanceof DIConfigError) {
            await Promise.allSettled([
                updateInvoiceForTenant(tenant.id, invoiceId, {
                    status: 'FAILED',
                    submissionError: errorMessage,
                    retryCount: attempt,
                }),
                recordFBRSubmissionLog({
                    tenantId: tenant.id,
                    invoiceId,
                    attempt,
                    requestBody: payload,
                    error: err,
                    durationMs: Date.now() - start,
                }),
            ])

            return NextResponse.json(
                { error: errorMessage, action: 'COMPLETE_REGISTRATION' },
                { status: 422 },
            )
        }

        if (err instanceof DIServerError) {
            await recordFBRSubmissionLog({
                tenantId: tenant.id,
                invoiceId,
                attempt,
                requestBody: payload,
                responseCode: 500,
                error: err,
                durationMs: Date.now() - start,
            })

            await enqueueInvoiceSubmission(tenant.id, invoiceId)
            return NextResponse.json({
                success: true,
                offline: true,
                message: 'PRAL server error. Invoice queued for retry.',
            })
        }

        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            await recordFBRSubmissionLog({
                tenantId: tenant.id,
                invoiceId,
                attempt,
                requestBody: payload,
                responseCode: 404,
                error: err,
                durationMs: Date.now() - start,
            })

            return NextResponse.json(
                { success: false, error: 'Invoice not found for this tenant.' },
                { status: 404 },
            )
        }

        await Promise.allSettled([
            updateInvoiceForTenant(tenant.id, invoiceId, {
                status: 'FAILED',
                submissionError: errorMessage,
                retryCount: attempt,
            }),
            recordFBRSubmissionLog({
                tenantId: tenant.id,
                invoiceId,
                attempt,
                requestBody: payload,
                error: err,
                durationMs: Date.now() - start,
            }),
        ])

        return NextResponse.json(
            { success: false, error: 'PRAL DI submission failed', details: errorMessage },
            { status: 500 },
        )
    }
}
