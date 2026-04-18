import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/admin/audit'

// GET — list billing records
export async function GET(req: NextRequest) {
    await assertSuperAdmin(req)
    const { searchParams } = new URL(req.url)

    const tenantId = searchParams.get('tenantId')
    const status = searchParams.get('status')
    const page = Number(searchParams.get('page') ?? 1)
    const limit = 25

    const where = {
        ...(tenantId ? { tenantId } : {}),
        ...(status ? { status: status as 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'WAIVED' } : {}),
    }

    const [records, total] = await Promise.all([
        prisma.billingRecord.findMany({
            where,
            include: {
                subscription: {
                    include: { tenant: { select: { name: true, slug: true } }, plan: { select: { name: true } } },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.billingRecord.count({ where }),
    ])

    return NextResponse.json({ data: records, total, page, pages: Math.ceil(total / limit) })
}

// POST — Record a manual payment
export async function POST(req: NextRequest) {
    const { actor } = await assertSuperAdmin(req)

    const body = z
        .object({
            tenantId: z.string(),
            amount: z.number().positive(),
            description: z.string(),
            periodStart: z.string().datetime(),
            periodEnd: z.string().datetime(),
            paymentMethod: z.string(),
            paymentRef: z.string().optional(),
        })
        .parse(await req.json())

    const sub = await prisma.tenantSubscription.findUniqueOrThrow({
        where: { tenantId: body.tenantId },
    })

    const record = await prisma.billingRecord.create({
        data: {
            subscriptionId: sub.id,
            tenantId: body.tenantId,
            amount: body.amount,
            currency: 'PKR',
            status: 'PAID',
            paidAt: new Date(),
            description: body.description,
            periodStart: new Date(body.periodStart),
            periodEnd: new Date(body.periodEnd),
            paymentMethod: body.paymentMethod,
            paymentRef: body.paymentRef,
        },
    })

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'SUPER_ADMIN',
        tenantId: body.tenantId,
        action: 'BILLING_RECORD_ADDED',
        entityId: record.id,
        after: record as unknown as object,
    })

    return NextResponse.json(record, { status: 201 })
}
