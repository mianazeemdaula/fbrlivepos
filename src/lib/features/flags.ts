import { prisma } from '@/lib/db/prisma'
import { cache } from 'react'

// Check if a feature is enabled for a tenant
// Priority: TenantFeatureFlag override > PlanFeature > FeatureFlag global
export const isFeatureEnabled = cache(
    async (tenantId: string, flagKey: string): Promise<boolean> => {
        // 1. Check per-tenant override
        const tenantOverride = await prisma.tenantFeatureFlag.findFirst({
            where: {
                tenantId,
                flag: { key: flagKey },
            },
            include: { flag: true },
        })

        if (tenantOverride) return tenantOverride.enabled

        // 2. Check plan feature
        const planFeature = await prisma.planFeature.findFirst({
            where: {
                key: flagKey,
                plan: { tenantSubscriptions: { some: { tenantId } } },
            },
        })

        if (planFeature) return planFeature.value === 'true'

        // 3. Check global flag
        const globalFlag = await prisma.featureFlag.findUnique({
            where: { key: flagKey },
        })

        return globalFlag?.isGlobal ?? false
    },
)

// Check plan limits
export const checkPlanLimit = cache(
    async (
        tenantId: string,
        limitKey: string,
    ): Promise<{ allowed: boolean; current: number; max: number | null }> => {
        const sub = await prisma.tenantSubscription.findUnique({
            where: { tenantId },
            include: { plan: true },
        })

        if (!sub) {
            return { allowed: true, current: 0, max: null }
        }

        const plan = sub.plan as Record<string, unknown>
        const max = (plan[limitKey] as number | null) ?? null

        const current = await getUsageCount(tenantId, limitKey)

        return {
            allowed: max === null || current < max,
            current,
            max,
        }
    },
)

async function getUsageCount(tenantId: string, limitKey: string): Promise<number> {
    switch (limitKey) {
        case 'maxPosTerminals':
            return prisma.pOSTerminal.count({ where: { tenantId, isActive: true } })
        case 'maxUsers':
            return prisma.user.count({ where: { tenantId, isActive: true } })
        case 'maxProducts':
            return prisma.product.count({ where: { tenantId, isActive: true } })
        case 'maxInvoicesMonth': {
            const start = new Date()
            start.setDate(1)
            start.setHours(0, 0, 0, 0)
            return prisma.invoice.count({
                where: { tenantId, createdAt: { gte: start } },
            })
        }
        default:
            return 0
    }
}
