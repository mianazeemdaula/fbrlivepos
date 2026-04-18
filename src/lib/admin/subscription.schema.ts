import { z } from 'zod'

export const PlanFeatureKeys = z.enum([
    'multi_pos',
    'advanced_reports',
    'api_access',
    'custom_branding',
    'email_invoices',
    'bulk_import',
    'priority_support',
    'white_label',
    'multi_branch',
    'accountant_access',
])

export const CreatePlanSchema = z.object({
    name: z.string().min(2).max(50),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    description: z.string().max(500),
    isActive: z.boolean().default(true),
    isPublic: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
    trialDays: z.number().int().min(0).max(90).default(0),
    priceMonthly: z.number().min(0),
    priceYearly: z.number().min(0),
    currency: z.string().default('PKR'),
    maxPosTerminals: z.number().int().positive().nullable().default(null),
    maxUsers: z.number().int().positive().nullable().default(null),
    maxProducts: z.number().int().positive().nullable().default(null),
    maxInvoicesMonth: z.number().int().positive().nullable().default(null),
    maxHsCodesAccess: z.number().int().positive().nullable().default(null),
    dataRetentionDays: z.number().int().min(30).default(365),
    features: z
        .array(
            z.object({
                key: PlanFeatureKeys,
                value: z.string(),
                label: z.string(),
            }),
        )
        .default([]),
})

export type CreatePlanInput = z.infer<typeof CreatePlanSchema>
