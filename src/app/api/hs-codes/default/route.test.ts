import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prisma, getTenantFromSession } = vi.hoisted(() => ({
    prisma: {
        hSCode: {
            findFirst: vi.fn(),
        },
    },
    getTenantFromSession: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({
    prisma,
}))

vi.mock('@/lib/tenant/context', () => ({
    getTenantFromSession,
}))

import { GET } from './route'

describe('GET /api/hs-codes/default', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getTenantFromSession.mockResolvedValue({
            tenant: { id: 'tenant-1' },
            userId: 'user-1',
        })
    })

    it('returns the active default HS code from database', async () => {
        prisma.hSCode.findFirst.mockResolvedValueOnce({
            id: 'hs-123',
            code: '0101.2100',
            description: 'Horses',
            shortName: 'Horses',
            category: 'Animals',
            unit: 'PCS',
            defaultTaxRate: 18,
            isFBRActive: true,
        })

        const res = await GET()
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data).toEqual({
            id: 'hs-123',
            code: '0101.2100',
            description: 'Horses',
            shortName: 'Horses',
            category: 'Animals',
            unit: 'PCS',
            defaultTaxRate: 18,
        })
    })

    it('returns 404 when no HS codes exist in database', async () => {
        prisma.hSCode.findFirst.mockResolvedValue(null)

        const res = await GET()
        expect(res.status).toBe(404)
        const data = await res.json()
        expect(data.error).toBe('No HS codes found in database')
    })
})
