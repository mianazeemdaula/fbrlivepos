import 'dotenv/config'
import { PrismaClient } from '../../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

function createPrismaClient() {
    const connectionString = process.env.DATABASE_URL?.trim()

    if (!connectionString) {
        throw new Error('DATABASE_URL is not configured. Add it to .env before starting the app or worker.')
    }

    try {
        const parsedUrl = new URL(connectionString)

        if (!parsedUrl.protocol.startsWith('postgres')) {
            throw new Error(`Unsupported DATABASE_URL protocol: ${parsedUrl.protocol}`)
        }
    } catch (error) {
        throw new Error(`Invalid DATABASE_URL configuration: ${error instanceof Error ? error.message : String(error)}`)
    }

    const adapter = new PrismaPg({
        connectionString,
    })

    return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
