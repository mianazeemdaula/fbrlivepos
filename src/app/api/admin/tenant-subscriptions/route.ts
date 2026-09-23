import { NextRequest, NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'
import { accessEndsAt, daysUntil, EXPIRY_WARNING_DAYS, expireOverdueSubscriptions } from '@/lib/billing/subscription'

const DAY_MS = 86_400_000

// GET — tenant subscriptions with expiry info. filter: all | expiring | expired | suspended
export async function GET(req: NextRequest) {
    await assertSuperAdmin(req)
    await expireOverdueSubscriptions()

    const filter = req.nextUrl.searchParams.get('filter') ?? 'all'
    const now = new Date()
    const soon = new Date(now.getTime() + EXPIRY_WARNING_DAYS * DAY_MS)

    const where =
        filter === 'expiring'
            ? {
                OR: [
                    { status: 'ACTIVE' as const, currentPeriodEnd: { gte: now, lte: soon } },
                    { status: 'TRIALING' as const, trialEndsAt: { gte: now, lte: soon } },
                ],
            }
            : filter === 'expired'
                ? { status: 'PAST_DUE' as const }
                : filter === 'suspended'
                    ? { status: { in: ['SUSPENDED' as const, 'CANCELLED' as const] } }
                    : {}

    const subs = await prisma.tenantSubscription.findMany({
        where,
        include: {
            tenant: { select: { id: true, name: true, email: true, isActive: true } },
            plan: { select: { id: true, name: true, priceMonthly: true, priceYearly: true } },
        },
        orderBy: { currentPeriodEnd: 'asc' },
        take: 200,
    })

    const [expiringCount, expiredCount, activeCount] = await Promise.all([
        prisma.tenantSubscription.count({
            where: {
                OR: [
                    { status: 'ACTIVE', currentPeriodEnd: { gte: now, lte: soon } },
                    { status: 'TRIALING', trialEndsAt: { gte: now, lte: soon } },
                ],
            },
        }),
        prisma.tenantSubscription.count({ where: { status: 'PAST_DUE' } }),
        prisma.tenantSubscription.count({ where: { status: { in: ['ACTIVE', 'TRIALING'] } } }),
    ])

    return NextResponse.json({
        summary: { active: activeCount, expiring: expiringCount, expired: expiredCount },
        data: subs.map((sub) => {
            const endsAt = accessEndsAt(sub)
            return {
                id: sub.id,
                tenant: sub.tenant,
                plan: {
                    id: sub.plan.id,
                    name: sub.plan.name,
                    priceMonthly: Number(sub.plan.priceMonthly),
                    priceYearly: Number(sub.plan.priceYearly),
                },
                status: sub.status,
                billingCycle: sub.billingCycle,
                currentPeriodStart: sub.currentPeriodStart.toISOString(),
                currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
                trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
                expiresAt: endsAt.toISOString(),
                daysLeft: daysUntil(endsAt, now),
            }
        }),
    })
}
