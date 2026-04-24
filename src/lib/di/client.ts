import { decryptCredential } from '@/lib/crypto/credentials'
import { prisma } from '@/lib/db/prisma'
import { DICircuitBreakerRegistry } from './circuit-breaker'
import type { DIInvoicePayload, DIResponse, DIValidationResponse } from './types'

const DI_POST_URL = 'https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata'
const DI_POST_URL_SB = 'https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb'
const DI_VAL_URL = 'https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata'
const DI_VAL_URL_SB = 'https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb'

const circuitRegistry = DICircuitBreakerRegistry.getInstance()

export interface DIErrorContext {
    operation: 'postInvoice' | 'validateInvoice'
    endpoint: string
    status?: number
    responseBody?: string
}

function responsePreview(responseBody?: string): string | undefined {
    if (!responseBody) {
        return undefined
    }

    return responseBody.length > 700
        ? `${responseBody.slice(0, 700)}...`
        : responseBody
}

function parseDIResponse<T>(rawBody: string, operation: 'postInvoice' | 'validateInvoice'): T {
    if (!rawBody.trim()) {
        throw new Error(`PRAL DI ${operation} returned an empty response body.`)
    }

    try {
        return JSON.parse(rawBody) as T
    } catch {
        const preview = rawBody.length > 600
            ? `${rawBody.slice(0, 600)}...`
            : rawBody

        throw new Error(`PRAL DI ${operation} returned malformed JSON: ${preview}`)
    }
}

export async function getDIClientForTenant(tenantId: string) {
    const creds = await prisma.dICredentials.findUniqueOrThrow({
        where: { tenantId },
    })

    const isSandbox = creds.environment === 'SANDBOX'
    const encryptedToken = isSandbox
        ? creds.encryptedSandboxToken
        : creds.encryptedProductionToken

    if (!encryptedToken) {
        throw new DIConfigError(
            tenantId,
            isSandbox
                ? 'No sandbox token configured. Complete IRIS registration and paste your sandbox token.'
                : 'No production token configured. Complete sandbox testing first, then paste your production token from IRIS.',
        )
    }

    // Decrypt at runtime — never stored in memory
    const token = decryptCredential(encryptedToken)

    // Debug: log token metadata to help diagnose 401s (never log the full token)
    console.log(`[DI-CLIENT] Token loaded for tenant ${tenantId}:`, {
        environment: isSandbox ? 'SANDBOX' : 'PRODUCTION',
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 8) + '...',
        tokenSuffix: '...' + token.substring(token.length - 4),
        hasWhitespace: token !== token.trim(),
        postUrl: isSandbox ? DI_POST_URL_SB : DI_POST_URL,
        validateUrl: isSandbox ? DI_VAL_URL_SB : DI_VAL_URL,
    })
    const breaker = circuitRegistry.get(tenantId)

    const postUrl = isSandbox ? DI_POST_URL_SB : DI_POST_URL
    const validateUrl = isSandbox ? DI_VAL_URL_SB : DI_VAL_URL

    return {
        tenantId,
        isSandbox,
        sellerNTN: creds.sellerNTN,
        sellerBusinessName: creds.sellerBusinessName,
        sellerProvince: creds.sellerProvince,
        sellerAddress: creds.sellerAddress,

        // Submit invoice to FBR (creates it)
        postInvoice: async (payload: DIInvoicePayload): Promise<DIResponse> => {
            return breaker.execute(async () => {
                const controller = new AbortController()
                const timer = setTimeout(() => controller.abort(), 15_000)
                try {
                    const res = await fetch(postUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify(payload),
                        signal: controller.signal,
                    })
                    clearTimeout(timer)
                    const rawBody = await res.text()
                    console.log(`[DI-CLIENT] postInvoice HTTP status: ${res.status} ${res.statusText} | url: ${postUrl}`)
                    if (res.status === 401) {
                        throw new DIAuthError(tenantId, {
                            operation: 'postInvoice',
                            endpoint: postUrl,
                            status: res.status,
                            responseBody: rawBody,
                        })
                    }
                    if (res.status >= 500) {
                        throw new DIServerError(tenantId, {
                            operation: 'postInvoice',
                            endpoint: postUrl,
                            status: res.status,
                            responseBody: rawBody,
                        })
                    }

                    if (!res.ok) {
                        throw new DIHttpError(tenantId, {
                            operation: 'postInvoice',
                            endpoint: postUrl,
                            status: res.status,
                            responseBody: rawBody,
                        })
                    }

                    return parseDIResponse<DIResponse>(rawBody, 'postInvoice')
                } catch (err) {
                    clearTimeout(timer)
                    throw err
                }
            })
        },

        // Validate invoice WITHOUT submitting (useful for pre-flight check)
        validateInvoice: async (payload: DIInvoicePayload): Promise<DIValidationResponse> => {
            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), 10_000)
            try {
                const res = await fetch(validateUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                })
                clearTimeout(timer)
                const rawBody = await res.text()
                console.log('[DI-Client] Payload', payload)
                console.log(`[DI-CLIENT] validateInvoice HTTP status: ${res.status} ${res.statusText} | url: ${validateUrl}`)
                if (res.status === 401) {
                    throw new DIAuthError(tenantId, {
                        operation: 'validateInvoice',
                        endpoint: validateUrl,
                        status: res.status,
                        responseBody: rawBody,
                    })
                }
                if (res.status >= 500) {
                    throw new DIServerError(tenantId, {
                        operation: 'validateInvoice',
                        endpoint: validateUrl,
                        status: res.status,
                        responseBody: rawBody,
                    })
                }

                if (!res.ok) {
                    throw new DIHttpError(tenantId, {
                        operation: 'validateInvoice',
                        endpoint: validateUrl,
                        status: res.status,
                        responseBody: rawBody,
                    })
                }

                return parseDIResponse<DIValidationResponse>(rawBody, 'validateInvoice')
            } catch (err) {
                clearTimeout(timer)
                throw err
            }
        },

        getCircuitState: () => breaker.getState(),
        resetCircuit: () => breaker.reset(),
    }
}

export class DIAuthError extends Error {
    constructor(public tenantId: string, public context?: DIErrorContext) {
        const preview = responsePreview(context?.responseBody)
        const status = context?.status != null ? ` [HTTP ${context.status}]` : ''
        const endpoint = context?.endpoint ? ` (${context.endpoint})` : ''
        const raw = preview ? ` Response: ${preview}` : ''
        super(`PRAL DI token unauthorized for tenant ${tenantId}${status}${endpoint}. Token may be expired, wrong environment, or not yet whitelisted.${raw}`)
        this.name = 'DIAuthError'
    }
}

export class DIServerError extends Error {
    constructor(public tenantId: string, public context?: DIErrorContext) {
        const preview = responsePreview(context?.responseBody)
        const status = context?.status != null ? ` [HTTP ${context.status}]` : ''
        const endpoint = context?.endpoint ? ` (${context.endpoint})` : ''
        const raw = preview ? ` Response: ${preview}` : ''
        super(`PRAL DI server error for tenant ${tenantId}${status}${endpoint}. Contact PRAL support via dicrm.pral.com.pk.${raw}`)
        this.name = 'DIServerError'
    }
}

export class DIHttpError extends Error {
    constructor(public tenantId: string, public context: DIErrorContext) {
        const preview = responsePreview(context.responseBody)
        const status = context.status ?? 'unknown'
        const raw = preview ? ` Response: ${preview}` : ''
        super(`PRAL DI ${context.operation} failed for tenant ${tenantId} [HTTP ${status}] (${context.endpoint}).${raw}`)
        this.name = 'DIHttpError'
    }
}

/** Non-retryable: tenant credentials are missing or misconfigured */
export class DIConfigError extends Error {
    constructor(public tenantId: string, detail: string) {
        super(`PRAL DI config error for tenant ${tenantId}: ${detail}`)
        this.name = 'DIConfigError'
    }
}

/** Returns true if the error is permanent and should NOT be retried by the queue */
export function isDIPermanentError(error: unknown): boolean {
    return (
        error instanceof DIAuthError ||
        error instanceof DIConfigError
    )
}
