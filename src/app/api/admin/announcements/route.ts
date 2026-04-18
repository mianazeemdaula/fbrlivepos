import { NextRequest, NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const createSchema = z.object({
    title: z.string().min(1).max(200),
    body: z.string().min(1),
    type: z.enum(['INFO', 'WARNING', 'MAINTENANCE', 'FEATURE']).default('INFO'),
    targetPlans: z.array(z.string()).default([]),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable().optional(),
    isDismissable: z.boolean().default(true),
})

export async function GET(req: NextRequest) {
    await assertSuperAdmin(req)

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = 20
    const skip = (page - 1) * limit

    const [announcements, total] = await Promise.all([
        prisma.announcement.findMany({
            orderBy: { startsAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.announcement.count(),
    ])

    return NextResponse.json({
        announcements,
        meta: {
            total,
            page,
            totalPages: Math.ceil(total / limit),
        },
    })
}

export async function POST(req: NextRequest) {
    await assertSuperAdmin(req)

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { title, body: announcementBody, type, targetPlans, startsAt, endsAt, isDismissable } = parsed.data

    const announcement = await prisma.announcement.create({
        data: {
            title,
            body: announcementBody,
            type,
            targetPlans,
            startsAt: new Date(startsAt),
            endsAt: endsAt ? new Date(endsAt) : null,
            isDismissable,
        },
    })

    return NextResponse.json({ announcement }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
    await assertSuperAdmin(req)

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await prisma.announcement.delete({ where: { id } })

    return NextResponse.json({ success: true })
}
