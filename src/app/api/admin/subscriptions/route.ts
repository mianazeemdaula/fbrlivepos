import { NextRequest, NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { CreatePlanSchema } from '@/lib/admin/subscription.schema'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/admin/audit'

export async function GET(req: NextRequest) {
    await assertSuperAdmin(req)

    const plans = await prisma.subscriptionPlan.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
            features: true,
            _count: { select: { tenantSubscriptions: true } },
        },
    })

    return NextResponse.json({
        plans: plans.map((plan) => ({
            ...plan,
            monthlyPrice: Number(plan.priceMonthly),
            yearlyPrice: Number(plan.priceYearly),
        })),
    })
}

export async function POST(req: NextRequest) {
    const { actor } = await assertSuperAdmin(req)
    const body = CreatePlanSchema.parse(await req.json())

    const { features, ...planData } = body

    const plan = await prisma.subscriptionPlan.create({
        data: {
            ...planData,
            features: { create: features },
        },
        include: { features: true },
    })

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'SUPER_ADMIN',
        action: 'PLAN_CREATED',
        entity: 'SubscriptionPlan',
        entityId: plan.id,
        after: plan as unknown as object,
    })

    return NextResponse.json(plan, { status: 201 })
}
