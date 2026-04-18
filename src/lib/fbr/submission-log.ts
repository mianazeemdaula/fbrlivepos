import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/db/prisma'

type SubmissionLogInput = {
    tenantId: string
    invoiceId: string
    attempt: number
    requestBody?: unknown
    responseCode?: number | null
    responseBody?: unknown
    error?: unknown
    durationMs?: number | null
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue
}

export function stringifyError(error: unknown) {
    if (error instanceof Error) {
        return `${error.name}: ${error.message}`
    }

    if (typeof error === 'string') {
        return error
    }

    try {
        return JSON.stringify(error)
    } catch {
        return String(error)
    }
}

export async function getNextSubmissionAttempt(tenantId: string, invoiceId: string) {
    const existingAttempts = await prisma.fBRSubmissionLog.count({
        where: { tenantId, invoiceId },
    })

    return existingAttempts + 1
}

export async function recordFBRSubmissionLog(input: SubmissionLogInput) {
    try {
        await prisma.fBRSubmissionLog.create({
            data: {
                tenantId: input.tenantId,
                invoiceId: input.invoiceId,
                attempt: input.attempt,
                requestBody: toJsonValue(input.requestBody),
                responseCode: input.responseCode ?? null,
                responseBody: input.responseBody === undefined ? undefined : toJsonValue(input.responseBody),
                error: input.error == null ? null : stringifyError(input.error),
                durationMs: input.durationMs ?? null,
            },
        })
    } catch (logError) {
        console.error('Failed to persist FBR submission log', {
            tenantId: input.tenantId,
            invoiceId: input.invoiceId,
            attempt: input.attempt,
            logError: stringifyError(logError),
            originalError: input.error == null ? null : stringifyError(input.error),
        })
    }
}

export async function updateInvoiceForTenant(
    tenantId: string,
    invoiceId: string,
    data: Prisma.InvoiceUpdateManyMutationInput,
) {
    const result = await prisma.invoice.updateMany({
        where: { id: invoiceId, tenantId },
        data,
    })

    if (result.count === 0) {
        throw new Error(`Invoice ${invoiceId} was not found for tenant ${tenantId}`)
    }
}