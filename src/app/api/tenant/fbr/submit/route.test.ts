import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTenantFromSession = vi.fn()
const getDIClientForTenant = vi.fn()
const inferSandboxScenario = vi.fn()
const buildDIPayload = vi.fn()
const enqueueInvoiceSubmission = vi.fn()
const getNextSubmissionAttempt = vi.fn()
const recordFBRSubmissionLog = vi.fn()
const stringifyError = vi.fn((error: unknown) => (error instanceof Error ? error.message : String(error)))
const updateInvoiceForTenant = vi.fn()

const prisma = {
    invoice: {
        findFirstOrThrow: vi.fn(),
        updateMany: vi.fn(),
    },
    dICredentials: {
        findUnique: vi.fn(),
    },
}

vi.mock('@/lib/tenant/context', () => ({
    getTenantFromSession,
}))

vi.mock('@/lib/di/client', () => ({
    getDIClientForTenant,
    DIAuthError: class DIAuthError extends Error { },
    DIConfigError: class DIConfigError extends Error { },
    DIServerError: class DIServerError extends Error { },
}))

vi.mock('@/lib/di/scenario-catalog', () => ({
    inferSandboxScenario,
}))

vi.mock('@/lib/di/payload-builder', () => ({
    buildDIPayload,
}))

vi.mock('@/lib/fbr/queue', () => ({
    enqueueInvoiceSubmission,
}))

vi.mock('@/lib/fbr/submission-log', () => ({
    getNextSubmissionAttempt,
    recordFBRSubmissionLog,
    stringifyError,
    updateInvoiceForTenant,
}))

vi.mock('@/lib/db/prisma', () => ({
    prisma,
}))

describe('POST /api/tenant/fbr/submit', () => {
    beforeEach(() => {
        vi.resetAllMocks()

        getTenantFromSession.mockResolvedValue({
            tenant: { id: 'tenant-1', preferredIdType: 'NTN' },
        })
        getNextSubmissionAttempt.mockResolvedValue(1)
        inferSandboxScenario.mockReturnValue({ scenarioId: 'SN026' })
        buildDIPayload.mockReturnValue({ payload: 'di' })
        prisma.invoice.updateMany.mockResolvedValue({ count: 1 })
        updateInvoiceForTenant.mockResolvedValue({ count: 1 })
        recordFBRSubmissionLog.mockResolvedValue(undefined)

        prisma.invoice.findFirstOrThrow.mockResolvedValue({
            id: 'invoice-1',
            tenantId: 'tenant-1',
            invoiceDate: new Date('2026-04-21T00:00:00.000Z'),
            invoiceType: 'Sale Invoice',
            buyerRegistrationType: 'Unregistered',
            diScenarioId: null,
            items: [
                {
                    id: 'item-1',
                    hsCode: '0401.2000',
                    name: 'Milk Pack',
                    quantity: 1,
                    unit: 'PCS',
                    unitPrice: 100,
                    taxAmount: 18,
                    diRate: '18%',
                    diUOM: 'Numbers, pieces, units',
                    diSaleType: 'Goods at standard rate (default)',
                    diFixedNotifiedValueOrRetailPrice: 0,
                    diSalesTaxWithheldAtSource: 0,
                    extraTax: 0,
                    furtherTax: 0,
                    fedPayable: 0,
                    discount: 0,
                    sroScheduleNo: '',
                    sroItemSerialNo: '',
                },
            ],
        })

        prisma.dICredentials.findUnique.mockResolvedValue({
            tenantId: 'tenant-1',
            environment: 'SANDBOX',
            encryptedSandboxToken: 'token',
            encryptedProductionToken: null,
            businessActivity: 'Retailer',
            sector: 'Wholesale / Retails',
            isProductionReady: false,
        })

        getDIClientForTenant.mockResolvedValue({
            getCircuitState: () => ({ state: 'CLOSED' }),
            validateInvoice: vi.fn().mockResolvedValue({
                validationResponse: {
                    statusCode: '00',
                    status: 'Valid',
                },
            }),
            postInvoice: vi.fn().mockResolvedValue({
                invoiceNumber: 'PRAL-INV-001',
                dated: '2026-04-21T10:00:00.000Z',
                validationResponse: {
                    statusCode: '00',
                    status: 'Valid',
                },
            }),
        })
    })

    it('infers and persists sandbox scenario id before PRAL submission', async () => {
        const { POST } = await import('./route')

        const response = await POST({
            json: async () => ({ invoiceId: 'invoice-1' }),
        } as Request as never)

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            diInvoiceNumber: 'PRAL-INV-001',
        })

        expect(inferSandboxScenario).toHaveBeenCalledWith(
            expect.objectContaining({
                businessActivity: 'Retailer',
                sector: 'Wholesale / Retails',
            }),
        )
        expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
            where: { id: 'invoice-1', tenantId: 'tenant-1' },
            data: { diScenarioId: 'SN026' },
        })
        expect(buildDIPayload).toHaveBeenCalledWith(
            expect.objectContaining({ diScenarioId: 'SN026' }),
            expect.objectContaining({ environment: 'SANDBOX' }),
            { isSandbox: true, scenarioId: 'SN026', preferredIdType: 'NTN' },
        )
        expect(updateInvoiceForTenant).toHaveBeenCalledWith(
            'tenant-1',
            'invoice-1',
            expect.objectContaining({
                status: 'SUBMITTED',
                diInvoiceNumber: 'PRAL-INV-001',
            }),
        )
        expect(enqueueInvoiceSubmission).not.toHaveBeenCalled()
    })
})