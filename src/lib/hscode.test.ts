import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prisma } = vi.hoisted(() => ({
    prisma: {
        hSCode: {
            findFirst: vi.fn(),
        },
    },
}))

vi.mock('@/lib/db/prisma', () => ({
    prisma,
}))

import { getDefaultHSCode, getDefaultHSCodeString } from './hscode'

describe('getDefaultHSCode', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns the first active FBR HS code ordered by code asc', async () => {
        const mockActiveCode = {
            id: 'hs-1',
            code: '0101.2100',
            description: 'Live pure-bred breeding horses',
            isFBRActive: true,
            unit: 'PCS',
            defaultTaxRate: 18,
        }
        prisma.hSCode.findFirst.mockResolvedValueOnce(mockActiveCode)

        const result = await getDefaultHSCode()
        expect(prisma.hSCode.findFirst).toHaveBeenCalledWith({
            where: { isFBRActive: true },
            orderBy: { code: 'asc' },
        })
        expect(result).toEqual(mockActiveCode)
    })

    it('falls back to any HS code if no active FBR code is found', async () => {
        const mockFallbackCode = {
            id: 'hs-2',
            code: '8471.3000',
            description: 'Laptops and computers',
            isFBRActive: false,
            unit: 'PCS',
            defaultTaxRate: 18,
        }
        // First call for isFBRActive returns null
        prisma.hSCode.findFirst.mockResolvedValueOnce(null)
        // Second call for any code
        prisma.hSCode.findFirst.mockResolvedValueOnce(mockFallbackCode)

        const result = await getDefaultHSCode()
        expect(prisma.hSCode.findFirst).toHaveBeenCalledTimes(2)
        expect(prisma.hSCode.findFirst).toHaveBeenNthCalledWith(2, {
            orderBy: { code: 'asc' },
        })
        expect(result).toEqual(mockFallbackCode)
    })

    it('returns null if the database contains no HS codes at all', async () => {
        prisma.hSCode.findFirst.mockResolvedValue(null)

        const result = await getDefaultHSCode()
        expect(result).toBeNull()
    })

    it('getDefaultHSCodeString returns code string', async () => {
        prisma.hSCode.findFirst.mockResolvedValueOnce({
            id: 'hs-1',
            code: '0101.2100',
        })

        const code = await getDefaultHSCodeString()
        expect(code).toBe('0101.2100')
    })
})
