import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/admin/audit'

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ tenantId: string }> },
) {
    const { actor } = await assertSuperAdmin(req)
    const { tenantId } = await params

    const body = z
        .object({
            planId: z.string(),
            billingCycle: z.enum(['MONTHLY', 'YEARLY']).optional(),
            status: z.enum(['ACTIVE', 'TRIALING', 'SUSPENDED', 'CANCELLED']).optional(),
            trialEndsAt: z.string().datetime().optional(),
            cancelAtPeriodEnd: z.boolean().optional(),
        })
        .parse(await req.json())

    const before = await prisma.tenantSubscription.findUniqueOrThrow({
        where: { tenantId },
    })

    const updated = await prisma.tenantSubscription.update({
        where: { tenantId },
        data: {
            planId: body.planId,
            billingCycle: body.billingCycle,
            status: body.status,
            trialEndsAt: body.trialEndsAt ? new Date(body.trialEndsAt) : undefined,
            cancelAtPeriodEnd: body.cancelAtPeriodEnd,
        },
        include: { plan: true },
    })

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'SUPER_ADMIN',
        tenantId,
        action: 'SUBSCRIPTION_CHANGED',
        entity: 'TenantSubscription',
        entityId: updated.id,
        before: before as unknown as object,
        after: updated as unknown as object,
    })

    return NextResponse.json(updated)
}
