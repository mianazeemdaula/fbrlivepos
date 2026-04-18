import { NextRequest, NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'
import { getGlobalQueueStats } from '@/lib/fbr/queue'

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
            by: ['planId'],
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

    const mrr = mrrByPlan.reduce((sum, row) => {
        const plan = planMap[row.planId]
        return sum + (plan ? Number(plan.priceMonthly) * row._count.planId : 0)
    }, 0)

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
        breakdown: mrrByPlan.map((row) => ({
            plan: planMap[row.planId]?.name,
            tenants: row._count.planId,
            contribution: Number(planMap[row.planId]?.priceMonthly ?? 0) * row._count.planId,
        })),
    })
}
