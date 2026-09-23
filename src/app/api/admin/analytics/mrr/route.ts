import { NextRequest, NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'
import { getGlobalQueueStats } from '@/lib/fbr/queue'
import { expireOverdueSubscriptions } from '@/lib/billing/subscription'

const DEFAULT_QUEUE_STATS = { waiting: 0, active: 0, failed: 0, delayed: 0 }

async function getQueueStats() {
    try {
        return await Promise.race([
            getGlobalQueueStats(),
            new Promise<typeof DEFAULT_QUEUE_STATS>((resolve) => {
                setTimeout(() => resolve(DEFAULT_QUEUE_STATS), 750)
            }),
        ])
    } catch {
        return DEFAULT_QUEUE_STATS
    }
}

export async function GET(req: NextRequest) {
    await assertSuperAdmin(req)
    await expireOverdueSubscriptions()

    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const [
        totalTenants,
        activeTenants,
        activeSubscriptions,
        mrrByPlan,
        newTenantsThisMonth,
        churnedThisMonth,
        totalInvoicesMonth,
        totalInvoicesToday,
        monthlyRevenue,
    ] = await Promise.all([
        prisma.tenant.count(),
        prisma.tenant.count({
            where: { isActive: true },
        }),
        prisma.tenantSubscription.count({
            where: { status: { in: ['ACTIVE', 'TRIALING'] } },
        }),
        prisma.tenantSubscription.groupBy({
            by: ['planId', 'billingCycle'],
            where: { status: 'ACTIVE' },
            _count: { planId: true },
        }),
        prisma.tenant.count({
            where: { createdAt: { gte: thisMonth } },
        }),
        prisma.tenantSubscription.count({
            where: {
                status: 'CANCELLED',
                cancelledAt: { gte: lastMonth, lt: thisMonth },
            },
        }),
        prisma.invoice.count({
            where: {
                createdAt: { gte: thisMonth },
            },
        }),
        prisma.invoice.count({
            where: {
                status: 'SUBMITTED',
                createdAt: { gte: today },
            },
        }),
        prisma.invoice.aggregate({
            where: {
                createdAt: { gte: thisMonth },
            },
            _sum: {
                totalAmount: true,
            },
        }),
    ])

    // Calculate MRR
    const plans = await prisma.subscriptionPlan.findMany()
    const planMap = Object.fromEntries(plans.map((p) => [p.id, p]))

    // Yearly subscribers contribute a twelfth of the yearly price per month
    const monthlyValue = (row: (typeof mrrByPlan)[number]) => {
        const plan = planMap[row.planId]
        if (!plan) return 0
        const perTenant = row.billingCycle === 'YEARLY' ? Number(plan.priceYearly) / 12 : Number(plan.priceMonthly)
        return perTenant * row._count.planId
    }

    const mrr = mrrByPlan.reduce((sum, row) => sum + monthlyValue(row), 0)

    const diQueueStats = await getQueueStats()
    const totalRevenue = Number(monthlyRevenue._sum.totalAmount ?? 0)

    return NextResponse.json({
        mrr,
        totalTenants,
        activeTenants,
        totalInvoicesMonth,
        totalRevenue,
        activeSubscriptions,
        newTenantsThisMonth,
        churnedThisMonth,
        totalInvoicesToday,
        diQueue: diQueueStats,
        breakdown: Object.values(
            mrrByPlan.reduce<Record<string, { plan: string | undefined; tenants: number; contribution: number }>>((acc, row) => {
                const entry = acc[row.planId] ?? { plan: planMap[row.planId]?.name, tenants: 0, contribution: 0 }
                entry.tenants += row._count.planId
                entry.contribution += monthlyValue(row)
                acc[row.planId] = entry
                return acc
            }, {}),
        ),
    })
}
