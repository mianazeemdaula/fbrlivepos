import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTenantFromSession = vi.fn()
const getDIClientForTenant = vi.fn()
const buildSandboxScenarioPayload = vi.fn()
const getSellerIdentity = vi.fn()
const appendDIDebugLog = vi.fn()

const prisma = {
    dICredentials: {
        findUnique: vi.fn(),
        update: vi.fn(),
    },
}

vi.mock('@/lib/tenant/context', () => ({
    getTenantFromSession,
}))

vi.mock('@/lib/db/prisma', () => ({
    prisma,
}))

vi.mock('@/lib/di/client', () => ({
    getDIClientForTenant,
    DIAuthError: class DIAuthError extends Error { },
    DIHttpError: class DIHttpError extends Error { },
    DIServerError: class DIServerError extends Error { },
}))

vi.mock('@/lib/di/scenario-catalog', () => ({
    buildSandboxScenarioPayload,
}))

vi.mock('@/lib/di/seller', () => ({
    getSellerIdentity,
}))

vi.mock('@/lib/di/debug-log', () => ({
    appendDIDebugLog,
}))

describe('POST /api/tenant/fbr-credentials/verify', () => {
    const resetCircuit = vi.fn()
    const validateInvoice = vi.fn()

    beforeEach(() => {
        vi.resetAllMocks()

        getTenantFromSession.mockResolvedValue({
            tenant: { id: 'tenant-1' },
        })

        prisma.dICredentials.findUnique.mockResolvedValue({
            tenantId: 'tenant-1',
            environment: 'SANDBOX',
            encryptedSandboxToken: 'encrypted-token',
            encryptedProductionToken: null,
        })

        getSellerIdentity.mockReturnValue({ sellerNTNCNIC: '1234567' })
        buildSandboxScenarioPayload.mockReturnValue({ scenarioId: 'SN001' })
        getDIClientForTenant.mockResolvedValue({ resetCircuit, validateInvoice })
        validateInvoice.mockResolvedValue({
            validationResponse: {
                statusCode: '00',
                status: 'Valid',
            },
        })
        prisma.dICredentials.update.mockResolvedValue(undefined)
        appendDIDebugLog.mockResolvedValue('logs/di-debug/tenant-1/2026-04-22.jsonl')
    })

    it('verifies against the DI validate endpoint and resets the DI circuit breaker', async () => {
        const { POST } = await import('./route')

        const response = await POST({} as Request as never)

        expect(response.status).toBe(200)
        expect(getDIClientForTenant).toHaveBeenCalledWith('tenant-1')
        expect(getSellerIdentity).toHaveBeenCalledWith(
            expect.objectContaining({ tenantId: 'tenant-1' }),
            expect.objectContaining({ id: 'tenant-1' }),
        )
        expect(buildSandboxScenarioPayload).toHaveBeenCalledWith('SN001', { sellerNTNCNIC: '1234567' })
        expect(validateInvoice).toHaveBeenCalledWith({ scenarioId: 'SN001' })
        expect(resetCircuit).toHaveBeenCalledTimes(1)
        expect(prisma.dICredentials.update).toHaveBeenCalledWith({
            where: { tenantId: 'tenant-1' },
            data: expect.objectContaining({
                verificationError: null,
            }),
        })
        expect(appendDIDebugLog).toHaveBeenCalledWith(expect.objectContaining({
            tenantId: 'tenant-1',
            event: 'VERIFY_SUCCESS',
        }))
    })
})