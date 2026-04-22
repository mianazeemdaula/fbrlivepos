import 'server-only'

import type { MarketingPlan } from '@/lib/marketing'
import { prisma } from '@/lib/db/prisma'

function toFeatureLabel(feature: { key: string; value: string; label: string }) {
    return feature.label?.trim() || `${feature.key}: ${feature.value}`
}

export async function getPublicMarketingPlans(): Promise<MarketingPlan[]> {
    try {
        const plans = await prisma.subscriptionPlan.findMany({
            where: { isActive: true, isPublic: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            include: { features: true },
        })

        return plans.map((plan, index) => ({
            id: plan.id,
            name: plan.name,
            tagline: plan.description,
            monthlyPrice: Number(plan.priceMonthly),
            annualPrice: Number(plan.priceYearly),
            invoicesPerMonth: plan.maxInvoicesMonth ?? 'unlimited',
            users: plan.maxUsers ?? 'unlimited',
            badge: index === 2 ? 'Most Popular' : undefined,
            highlight: index === 2,
            features: plan.features.length
                ? plan.features.map(toFeatureLabel)
                : ['Full FBR DI integration', 'Sandbox support', 'Ongoing platform updates'],
        }))
    } catch {
        return []
    }
}
