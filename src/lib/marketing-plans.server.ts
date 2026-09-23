import 'server-only'

import type { MarketingPlan } from '@/lib/marketing'
import { prisma } from '@/lib/db/prisma'

function toFeatureLabel(feature: { key: string; value: string; label: string }) {
    const label = feature.label?.trim() || feature.key
    const value = feature.value?.trim()
    // Boolean flags show just the label; other values (e.g. "5 branches") are appended
    return !value || value === 'true' ? label : `${label}: ${value}`
}

/** Active, public plans with their enabled features, straight from the database. */
export async function getPublicMarketingPlans(): Promise<MarketingPlan[]> {
    try {
        const plans = await prisma.subscriptionPlan.findMany({
            where: { isActive: true, isPublic: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            // cuid ids are time-ordered, so this keeps the order features were entered in
            include: { features: { orderBy: { id: 'asc' } } },
        })

        return plans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            tagline: plan.description,
            currency: plan.currency,
            monthlyPrice: Number(plan.priceMonthly),
            annualPrice: Number(plan.priceYearly),
            trialDays: plan.trialDays,
            invoicesPerMonth: plan.maxInvoicesMonth ?? 'unlimited',
            users: plan.maxUsers ?? 'unlimited',
            products: plan.maxProducts ?? 'unlimited',
            posTerminals: plan.maxPosTerminals ?? 'unlimited',
            features: plan.features
                .filter((feature) => feature.value?.trim().toLowerCase() !== 'false')
                .map(toFeatureLabel),
        }))
    } catch (err) {
        console.error('[marketing] Failed to load public plans:', err)
        return []
    }
}
