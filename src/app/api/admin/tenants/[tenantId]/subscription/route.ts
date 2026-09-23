import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/admin/audit'
import { addBillingCycle, priceForCycle, recordPaymentAndExtend } from '@/lib/billing/subscription'

const DAY_MS = 86_400_000

const UpdateSubscriptionSchema = z
    .object({
        planId: z.string().optional(),
        billingCycle: z.enum(['MONTHLY', 'YEARLY']).optional(),
        status: z.enum(['ACTIVE', 'TRIALING', 'PAST_DUE', 'SUSPENDED', 'CANCELLED']).optional(),
        currentPeriodStart: z.string().datetime().optional(),
        currentPeriodEnd: z.string().datetime().optional(),
        trialEndsAt: z.string().datetime().nullable().optional(),
        cancelAtPeriodEnd: z.boolean().optional(),
    })
    .refine(
        (b) => !b.currentPeriodStart || !b.currentPeriodEnd || new Date(b.currentPeriodEnd) > new Date(b.currentPeriodStart),
        { message: 'Expiry date must be after the start date', path: ['currentPeriodEnd'] },
    )

// PATCH — create or update a tenant's subscription (plan, cycle, status, dates)
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ tenantId: string }> },
) {
    const { actor } = await assertSuperAdmin(req)
    const { tenantId } = await params

    const parsed = UpdateSubscriptionSchema.safeParse(await req.json())
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
    }
    const body = parsed.data

    const before = await prisma.tenantSubscription.findUnique({ where: { tenantId } })

    if (body.planId) {
        const plan = await prisma.subscriptionPlan.findUnique({ where: { id: body.planId } })
        if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const cancelledAt = body.status === 'CANCELLED'
        ? (before?.cancelledAt ?? new Date())
        : body.status ? null : undefined

    let updated
    if (before) {
        updated = await prisma.tenantSubscription.update({
            where: { tenantId },
            data: {
                planId: body.planId,
                billingCycle: body.billingCycle,
                status: body.status,
                currentPeriodStart: body.currentPeriodStart ? new Date(body.currentPeriodStart) : undefined,
                currentPeriodEnd: body.currentPeriodEnd ? new Date(body.currentPeriodEnd) : undefined,
                trialEndsAt: body.trialEndsAt === undefined ? undefined : body.trialEndsAt ? new Date(body.trialEndsAt) : null,
                cancelAtPeriodEnd: body.cancelAtPeriodEnd,
                cancelledAt,
            },
            include: { plan: true },
        })
    } else {
        if (!body.planId) {
            return NextResponse.json({ error: 'Select a plan to create a subscription' }, { status: 400 })
        }
        const plan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { id: body.planId } })
        const cycle = body.billingCycle ?? 'MONTHLY'
        const start = body.currentPeriodStart ? new Date(body.currentPeriodStart) : new Date()
        const trialEndsAt = body.trialEndsAt
            ? new Date(body.trialEndsAt)
            : plan.trialDays > 0 && !body.status ? new Date(start.getTime() + plan.trialDays * DAY_MS) : null

        updated = await prisma.tenantSubscription.create({
            data: {
                tenantId,
                planId: plan.id,
                billingCycle: cycle,
                status: body.status ?? (trialEndsAt ? 'TRIALING' : 'ACTIVE'),
                currentPeriodStart: start,
                currentPeriodEnd: body.currentPeriodEnd ? new Date(body.currentPeriodEnd) : trialEndsAt ?? addBillingCycle(start, cycle),
                trialEndsAt,
                cancelAtPeriodEnd: body.cancelAtPeriodEnd ?? false,
                cancelledAt: body.status === 'CANCELLED' ? new Date() : null,
            },
            include: { plan: true },
        })
    }

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'SUPER_ADMIN',
        tenantId,
        action: before ? 'SUBSCRIPTION_CHANGED' : 'SUBSCRIPTION_CREATED',
        entity: 'TenantSubscription',
        entityId: updated.id,
        before: (before ?? undefined) as unknown as object,
        after: updated as unknown as object,
    })

    return NextResponse.json(updated)
}

const RenewSchema = z.object({
    cycles: z.number().int().min(1).max(36).default(1),
    billingCycle: z.enum(['MONTHLY', 'YEARLY']).optional(),
    recordPayment: z.boolean().default(false),
    amount: z.number().min(0).optional(),
    paymentMethod: z.string().trim().min(1).optional(),
    paymentRef: z.string().trim().optional(),
})

// POST — renew: extend the subscription by N billing cycles, optionally recording the payment
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ tenantId: string }> },
) {
    const { actor } = await assertSuperAdmin(req)
    const { tenantId } = await params

    const parsed = RenewSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
    }
    const body = parsed.data

    const sub = await prisma.tenantSubscription.findUnique({
        where: { tenantId },
        include: { plan: true },
    })
    if (!sub) {
        return NextResponse.json({ error: 'Tenant has no subscription. Assign a plan first.' }, { status: 404 })
    }

    const cycle = body.billingCycle ?? sub.billingCycle
    const now = new Date()
    // Renew from the current expiry if still running, otherwise from today
    const periodStart = sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now
    const periodEnd = addBillingCycle(periodStart, cycle, body.cycles)

    if (cycle !== sub.billingCycle) {
        await prisma.tenantSubscription.update({ where: { id: sub.id }, data: { billingCycle: cycle } })
    }

    let result
    if (body.recordPayment) {
        const amount = body.amount ?? priceForCycle(sub.plan, cycle) * body.cycles
        result = await recordPaymentAndExtend({
            tenantId,
            amount,
            description: `${sub.plan.name} — ${body.cycles} ${cycle === 'YEARLY' ? 'year' : 'month'}${body.cycles > 1 ? 's' : ''}`,
            periodStart,
            periodEnd,
            paymentMethod: body.paymentMethod ?? 'BANK_TRANSFER',
            paymentRef: body.paymentRef,
        })
    } else {
        const subscription = await prisma.tenantSubscription.update({
            where: { id: sub.id },
            data: {
                currentPeriodStart: sub.currentPeriodEnd > now ? sub.currentPeriodStart : periodStart,
                currentPeriodEnd: periodEnd,
                status: sub.status === 'PAST_DUE' || sub.status === 'TRIALING' ? 'ACTIVE' : sub.status,
                trialEndsAt: sub.status === 'TRIALING' ? null : sub.trialEndsAt,
            },
        })
        result = { record: null, subscription }
    }

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'SUPER_ADMIN',
        tenantId,
        action: 'SUBSCRIPTION_RENEWED',
        entity: 'TenantSubscription',
        entityId: sub.id,
        before: sub as unknown as object,
        after: result as unknown as object,
    })

    return NextResponse.json(result)
}
