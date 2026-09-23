import { prisma } from '@/lib/db/prisma'
import type { BillingCycle, SubStatus } from '@/generated/prisma/client'

const DAY_MS = 86_400_000

/** Days before expiry when a subscription is flagged as "expiring soon". */
export const EXPIRY_WARNING_DAYS = 7

/** Statuses that allow a tenant to use the platform (subject to the period end date). */
const USABLE_STATUSES: SubStatus[] = ['ACTIVE', 'TRIALING']

export function addBillingCycle(from: Date, cycle: BillingCycle, cycles = 1): Date {
    const next = new Date(from)
    if (cycle === 'YEARLY') {
        next.setFullYear(next.getFullYear() + cycles)
    } else {
        next.setMonth(next.getMonth() + cycles)
    }
    return next
}

export function priceForCycle(plan: { priceMonthly: unknown; priceYearly: unknown }, cycle: BillingCycle): number {
    return Number(cycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly)
}

/** The date access ends: trial end for trialing subscriptions, otherwise the paid period end. */
export function accessEndsAt(sub: { status: SubStatus; currentPeriodEnd: Date; trialEndsAt: Date | null }): Date {
    if (sub.status === 'TRIALING' && sub.trialEndsAt) return sub.trialEndsAt
    return sub.currentPeriodEnd
}

export function daysUntil(date: Date, now = new Date()): number {
    return Math.ceil((date.getTime() - now.getTime()) / DAY_MS)
}

/**
 * Move ACTIVE/TRIALING subscriptions whose access date has passed to PAST_DUE.
 * Runs lazily from access checks and admin listings, so no cron is required.
 */
export async function expireOverdueSubscriptions(tenantId?: string): Promise<number> {
    const now = new Date()
    const scope = tenantId ? { tenantId } : {}

    const [active, trialing] = await prisma.$transaction([
        prisma.tenantSubscription.updateMany({
            where: { ...scope, status: 'ACTIVE', currentPeriodEnd: { lt: now } },
            data: { status: 'PAST_DUE' },
        }),
        prisma.tenantSubscription.updateMany({
            where: {
                ...scope,
                status: 'TRIALING',
                OR: [
                    { trialEndsAt: { lt: now } },
                    { trialEndsAt: null, currentPeriodEnd: { lt: now } },
                ],
            },
            data: { status: 'PAST_DUE' },
        }),
    ])

    return active.count + trialing.count
}

export interface SubscriptionAccess {
    /** false when the tenant must not create new invoices */
    allowed: boolean
    reason: string | null
    hasSubscription: boolean
    status: SubStatus | null
    planName: string | null
    expiresAt: string | null
    daysLeft: number | null
    expiringSoon: boolean
}

/**
 * Resolve whether a tenant's subscription currently allows usage.
 * Tenants without any subscription keep working on free-tier limits (see checkPlanLimit).
 */
export async function getSubscriptionAccess(tenantId: string): Promise<SubscriptionAccess> {
    await expireOverdueSubscriptions(tenantId)

    const sub = await prisma.tenantSubscription.findUnique({
        where: { tenantId },
        include: { plan: { select: { name: true } } },
    })

    if (!sub) {
        return {
            allowed: true,
            reason: null,
            hasSubscription: false,
            status: null,
            planName: null,
            expiresAt: null,
            daysLeft: null,
            expiringSoon: false,
        }
    }

    const endsAt = accessEndsAt(sub)
    const daysLeft = daysUntil(endsAt)
    const allowed = USABLE_STATUSES.includes(sub.status)

    let reason: string | null = null
    if (!allowed) {
        reason = sub.status === 'PAST_DUE'
            ? `Your ${sub.plan.name} subscription expired on ${endsAt.toLocaleDateString('en-PK')}. Please renew to continue.`
            : sub.status === 'SUSPENDED'
                ? 'Your subscription is suspended. Please contact support.'
                : 'Your subscription is cancelled. Please contact support to reactivate.'
    }

    return {
        allowed,
        reason,
        hasSubscription: true,
        status: sub.status,
        planName: sub.plan.name,
        expiresAt: endsAt.toISOString(),
        daysLeft,
        expiringSoon: allowed && daysLeft <= EXPIRY_WARNING_DAYS,
    }
}

/**
 * Record a paid billing entry and extend the subscription so the tenant's
 * access runs until the end of the paid period.
 */
export async function recordPaymentAndExtend(input: {
    tenantId: string
    amount: number
    description: string
    periodStart: Date
    periodEnd: Date
    paymentMethod: string
    paymentRef?: string | null
}) {
    return prisma.$transaction(async (tx) => {
        const sub = await tx.tenantSubscription.findUniqueOrThrow({
            where: { tenantId: input.tenantId },
        })

        const record = await tx.billingRecord.create({
            data: {
                subscriptionId: sub.id,
                tenantId: input.tenantId,
                amount: input.amount,
                currency: 'PKR',
                status: 'PAID',
                paidAt: new Date(),
                description: input.description,
                periodStart: input.periodStart,
                periodEnd: input.periodEnd,
                paymentMethod: input.paymentMethod,
                paymentRef: input.paymentRef ?? null,
            },
        })

        const subscription = await applyPaidPeriod(tx, sub, input.periodStart, input.periodEnd)
        return { record, subscription }
    })
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/** Extend a subscription to cover a paid period and reactivate it unless it was suspended/cancelled by an admin. */
export async function applyPaidPeriod(
    tx: Tx,
    sub: { id: string; status: SubStatus; currentPeriodStart: Date; currentPeriodEnd: Date },
    periodStart: Date,
    periodEnd: Date,
) {
    const extendsAccess = periodEnd > sub.currentPeriodEnd
    const reactivate = sub.status === 'PAST_DUE' || sub.status === 'TRIALING'

    if (!extendsAccess && !reactivate) return tx.tenantSubscription.findUniqueOrThrow({ where: { id: sub.id } })

    return tx.tenantSubscription.update({
        where: { id: sub.id },
        data: {
            ...(extendsAccess
                ? {
                    currentPeriodEnd: periodEnd,
                    currentPeriodStart: sub.currentPeriodEnd < new Date() ? periodStart : sub.currentPeriodStart,
                }
                : {}),
            ...(reactivate ? { status: 'ACTIVE' as const, trialEndsAt: null } : {}),
        },
    })
}

/**
 * Returns the reason a tenant is blocked from creating or submitting invoices, or null when allowed.
 * Fails open on lookup errors so a billing-table problem never halts FBR invoicing.
 */
export async function getSubscriptionBlockReason(tenantId: string): Promise<string | null> {
    try {
        const access = await getSubscriptionAccess(tenantId)
        return access.allowed ? null : access.reason
    } catch (err) {
        console.error('[billing] Subscription access check failed:', err)
        return null
    }
}
