import { NextRequest, NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { HSCodeSchema } from '@/lib/admin/hscode.schema'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/admin/audit'
import { Prisma } from '@/generated/prisma/client'

export async function GET(req: NextRequest) {
    await assertSuperAdmin(req)

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') ?? ''
    const category = searchParams.get('category')
    const page = Number(searchParams.get('page') ?? 1)
    const limit = Number(searchParams.get('limit') ?? 50)

    const where: Prisma.HSCodeWhereInput = {
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

    const [hsCodes, total, categories] = await Promise.all([
        prisma.hSCode.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { code: 'asc' },
        }),
        prisma.hSCode.count({ where }),
        prisma.hSCode.groupBy({
            by: ['category'],
            orderBy: { category: 'asc' },
        }),
    ])

    return NextResponse.json({
        data: hsCodes,
        total,
        page,
        pages: Math.ceil(total / limit),
        categories: categories.map((c) => c.category),
    })
}

export async function POST(req: NextRequest) {
    const { actor } = await assertSuperAdmin(req)
    const body = HSCodeSchema.parse(await req.json())

    const hsCode = await prisma.hSCode.create({ data: body })

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'SUPER_ADMIN',
        action: 'HSCODE_CREATED',
        entity: 'HSCode',
        entityId: hsCode.id,
        after: hsCode as unknown as object,
    })

    return NextResponse.json(hsCode, { status: 201 })
}
