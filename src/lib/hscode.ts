import { prisma } from '@/lib/db/prisma'
import type { HSCode } from '@/generated/prisma/client'

/**
 * Loads the default active HS Code from the database.
 * First queries active FBR HS codes ordered by code asc.
 * If no active codes exist, falls back to the first available HS code in the database.
 */
export async function getDefaultHSCode(): Promise<HSCode | null> {
    const active = await prisma.hSCode.findFirst({
        where: { isFBRActive: true },
        orderBy: { code: 'asc' },
    })

    if (active) {
        return active
    }

    return prisma.hSCode.findFirst({
        orderBy: { code: 'asc' },
    })
}

/**
 * Helper to get the default HS code string (e.g. "0101.2100").
 */
export async function getDefaultHSCodeString(): Promise<string | null> {
    const defaultRecord = await getDefaultHSCode()
    return defaultRecord?.code ?? null
}
