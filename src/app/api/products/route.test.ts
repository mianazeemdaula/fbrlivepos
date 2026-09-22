import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { prisma, getTenantFromSession, checkPlanLimit } = vi.hoisted(() => {
    const prismaObj = {
        hSCode: {
            findFirst: vi.fn(),
        },
        dIHSCodeUOM: {
            findMany: vi.fn(),
        },
        product: {
            create: vi.fn(),
            findMany: vi.fn(),
            count: vi.fn(),
        },
        productHSCode: {
            create: vi.fn(),
        },
        $transaction: vi.fn(async (cb: any) => cb(prismaObj)),
    }
    return {
        prisma: prismaObj,
        getTenantFromSession: vi.fn(),
        checkPlanLimit: vi.fn(),
    }
})

vi.mock('@/lib/db/prisma', () => ({
    prisma,
}))

vi.mock('@/lib/tenant/context', () => ({
    getTenantFromSession,
}))

vi.mock('@/lib/features/flags', () => ({
    checkPlanLimit,
}))

import { POST } from './route'

describe('POST /api/products HS Code database fallback', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getTenantFromSession.mockResolvedValue({
            tenant: { id: 'tenant-1' },
            userId: 'user-1',
        })
        checkPlanLimit.mockResolvedValue({ allowed: true, max: 100 })
        prisma.dIHSCodeUOM.findMany.mockResolvedValue([])
    })

    it('loads default HS code from database when hsCodeId lookup fails', async () => {
        // First lookup by ID fails (e.g. invalid hsCodeId)
        prisma.hSCode.findFirst
            .mockResolvedValueOnce(null) // by id
            .mockResolvedValueOnce({    // default fallback from database
                id: 'db-default-hs',
                code: '0101.2100',
                defaultTaxRate: 18,
                isFBRActive: true,
            })

        prisma.product.create.mockResolvedValueOnce({
            id: 'prod-1',
            name: 'Test Product',
            hsCode: '0101.2100',
            price: 100,
            taxRate: 18,
            unit: 'PCS',
        })

        const req = new NextRequest('http://localhost/api/products', {
            method: 'POST',
            body: JSON.stringify({
                name: 'Test Product',
                hsCodeId: 'non-existent-id',
                price: 100,
                taxRate: 18,
                unit: 'PCS',
            }),
        })

        const res = await POST(req)
        expect(res.status).toBe(201)
        expect(prisma.product.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    hsCode: '0101.2100',
                }),
            }),
        )
    })

    it('loads default HS code from database when hsCode is omitted completely', async () => {
        // Lookup default fallback from database
        prisma.hSCode.findFirst.mockResolvedValueOnce({
            id: 'db-default-hs',
            code: '0101.2100',
            defaultTaxRate: 18,
            isFBRActive: true,
        })

        prisma.product.create.mockResolvedValueOnce({
            id: 'prod-2',
            name: 'Item Without HS',
            hsCode: '0101.2100',
            price: 250,
            taxRate: 18,
            unit: 'PCS',
        })

        const req = new NextRequest('http://localhost/api/products', {
            method: 'POST',
            body: JSON.stringify({
                name: 'Item Without HS',
                price: 250,
                taxRate: 18,
                unit: 'PCS',
            }),
        })

        const res = await POST(req)
        expect(res.status).toBe(201)
        expect(prisma.product.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    hsCode: '0101.2100',
                }),
            }),
        )
    })
})
