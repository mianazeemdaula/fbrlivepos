import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/admin/audit'
import { recordPaymentAndExtend } from '@/lib/billing/subscription'

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

    return NextResponse.json({
        data: records.map((record) => ({ ...record, amount: Number(record.amount) })),
        total,
        page,
        pages: Math.ceil(total / limit),
    })
}

// POST — Record a manual payment. A PAID record extends the tenant's subscription to periodEnd.
export async function POST(req: NextRequest) {
    const { actor } = await assertSuperAdmin(req)

    const parsed = z
        .object({
            tenantId: z.string(),
            amount: z.number().min(0),
            description: z.string().trim().min(1),
            periodStart: z.string().datetime(),
            periodEnd: z.string().datetime(),
            paymentMethod: z.string().trim().min(1),
            paymentRef: z.string().trim().optional(),
        })
        .refine((b) => new Date(b.periodEnd) > new Date(b.periodStart), {
            message: 'Period end must be after period start',
        })
        .safeParse(await req.json())

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
    }
    const body = parsed.data

    const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId: body.tenantId } })
    if (!sub) {
        return NextResponse.json({ error: 'Tenant has no subscription. Assign a plan first.' }, { status: 404 })
    }

    const { record, subscription } = await recordPaymentAndExtend({
        tenantId: body.tenantId,
        amount: body.amount,
        description: body.description,
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        paymentMethod: body.paymentMethod,
        paymentRef: body.paymentRef,
    })

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'SUPER_ADMIN',
        tenantId: body.tenantId,
        action: 'BILLING_RECORD_ADDED',
        entityId: record.id,
        after: { record, subscription } as unknown as object,
    })

    return NextResponse.json({ ...record, amount: Number(record.amount) }, { status: 201 })
}
