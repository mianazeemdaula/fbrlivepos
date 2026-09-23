import { NextRequest, NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { CreatePlanSchema } from '@/lib/admin/subscription.schema'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/admin/audit'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ planId: string }> },
) {
    await assertSuperAdmin(req)
    const { planId } = await params

    const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
        where: { id: planId },
        include: {
            features: true,
            _count: { select: { tenantSubscriptions: true } },
        },
    })

    return NextResponse.json(plan)
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ planId: string }> },
) {
    const { actor } = await assertSuperAdmin(req)
    const { planId } = await params
    const raw = await req.json()
    const parsed = CreatePlanSchema.partial().safeParse(raw)
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid plan data' }, { status: 400 })
    }
    // Zod 4 applies .default() values even inside .partial(); keep only the fields actually sent
    // so a partial update (e.g. toggling isActive) doesn't reset limits or wipe features.
    const sentKeys = new Set(Object.keys(raw ?? {}))
    const body = Object.fromEntries(
        Object.entries(parsed.data).filter(([key]) => sentKeys.has(key)),
    ) as typeof parsed.data

    const before = await prisma.subscriptionPlan.findUniqueOrThrow({
        where: { id: planId },
        include: { features: true },
    })

    const { features, ...planData } = body

    const updated = await prisma.$transaction(async (tx) => {
        const plan = await tx.subscriptionPlan.update({
            where: { id: planId },
            data: planData,
        })

        if (features) {
            await tx.planFeature.deleteMany({ where: { planId } })
            await tx.planFeature.createMany({
                data: features.map((f) => ({ ...f, planId })),
            })
        }

        return plan
    })

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'SUPER_ADMIN',
        action: 'PLAN_UPDATED',
        entity: 'SubscriptionPlan',
        entityId: planId,
        before: before as unknown as object,
        after: updated as unknown as object,
    })

    return NextResponse.json(updated)
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ planId: string }> },
) {
    const { actor } = await assertSuperAdmin(req)
    const { planId } = await params

    const activeCount = await prisma.tenantSubscription.count({
        where: { planId, status: { in: ['ACTIVE', 'TRIALING'] } },
    })

    if (activeCount > 0) {
        return NextResponse.json(
            { error: `Cannot delete: ${activeCount} active tenant(s) on this plan. Deactivate instead.` },
            { status: 422 },
        )
    }

    await prisma.subscriptionPlan.update({
        where: { id: planId },
        data: { isActive: false, isPublic: false },
    })

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'SUPER_ADMIN',
        action: 'PLAN_DEACTIVATED',
        entity: 'SubscriptionPlan',
        entityId: planId,
    })

    return NextResponse.json({ success: true })
}
