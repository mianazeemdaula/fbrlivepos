import { NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'

// Tenants can search the platform HS code library (read-only)
export async function GET(req: Request) {
    await getTenantFromSession()

    const q = new URL(req.url).searchParams.get('q') ?? ''

    const hsCodes = await prisma.hSCode.findMany({
        where: {
            isFBRActive: true,
            OR: [
                { code: { contains: q } },
                { description: { contains: q, mode: 'insensitive' } },
                { shortName: { contains: q, mode: 'insensitive' } },
            ],
        },
        take: 20,
        select: {
            id: true,
            code: true,
            description: true,
            shortName: true,
            defaultTaxRate: true,
            unit: true,
            category: true,
        },
    })

    return NextResponse.json(hsCodes)
}
