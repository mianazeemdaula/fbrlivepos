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
    const status = searchParams.get('status')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 25)))

    const isFBRActiveFilter =
        status === 'active' ? true : status === 'inactive' ? false : undefined

    const where: Prisma.HSCodeWhereInput = {
        AND: [
            q
                ? {
                    OR: [
                        { code: { contains: q, mode: 'insensitive' } },
                        { description: { contains: q, mode: 'insensitive' } },
                        { shortName: { contains: q, mode: 'insensitive' } },
                        { category: { contains: q, mode: 'insensitive' } },
                    ],
                }
                : {},
            category ? { category } : {},
            isFBRActiveFilter !== undefined ? { isFBRActive: isFBRActiveFilter } : {},
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
        pages: Math.max(1, Math.ceil(total / limit)),
        categories: categories.map((c) => c.category),
    })
}

export async function POST(req: NextRequest) {
    const { actor } = await assertSuperAdmin(req)
    
    let rawBody: unknown
    try {
        rawBody = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 })
    }

    const parseResult = HSCodeSchema.safeParse(rawBody)
    if (!parseResult.success) {
        const issue = parseResult.error.issues[0]
        return NextResponse.json({ error: `${issue.path.join('.')}: ${issue.message}` }, { status: 422 })
    }

    const data = parseResult.data

    // Check if code already exists
    const existing = await prisma.hSCode.findUnique({
        where: { code: data.code },
    })

    if (existing) {
        return NextResponse.json({ error: `HS Code "${data.code}" already exists.` }, { status: 400 })
    }

    const hsCode = await prisma.hSCode.create({
        data: {
            code: data.code,
            description: data.description,
            shortName: data.shortName || null,
            category: data.category,
            subCategory: data.subCategory || null,
            unit: data.unit,
            defaultTaxRate: data.defaultTaxRate,
            isFBRActive: data.isFBRActive,
            notes: data.notes || null,
            effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : null,
            effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
        },
    })

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

