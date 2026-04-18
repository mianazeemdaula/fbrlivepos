import { NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@/generated/prisma/client'

export async function GET(req: Request) {
    await getTenantFromSession()

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') ?? ''
    const category = searchParams.get('category') ?? ''
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 25)))

    const where: Prisma.HSCodeWhereInput = {
        isFBRActive: true,
        AND: [
            q
                ? {
                    OR: [
                        { code: { contains: q, mode: 'insensitive' } },
                        { description: { contains: q, mode: 'insensitive' } },
                        { shortName: { contains: q, mode: 'insensitive' } },
                    ],
                }
                : {},
            category ? { category } : {},
        ],
    }

    const [hsCodes, total, categoryRows] = await Promise.all([
        prisma.hSCode.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { code: 'asc' },
            select: {
                id: true,
                code: true,
                description: true,
                shortName: true,
                category: true,
                unit: true,
                defaultTaxRate: true,
            },
        }),
        prisma.hSCode.count({ where }),
        prisma.hSCode.groupBy({
            by: ['category'],
            where: { isFBRActive: true },
            orderBy: { category: 'asc' },
        }),
    ])

    return NextResponse.json({
        data: hsCodes,
        total,
        page,
        pages: Math.ceil(total / limit),
        categories: categoryRows.map((r) => r.category),
    })
}
