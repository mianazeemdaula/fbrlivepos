import { z } from 'zod'

export const HSCodeSchema = z.object({
    code: z.string().regex(/^\d{4,10}(\.\d{2})?$/, 'Format: 8471.30 or 84713000'),
    description: z.string().min(5).max(500),
    shortName: z.string().max(100).optional(),
    category: z.string().min(2).max(100),
    subCategory: z.string().max(100).optional(),
    unit: z.enum(['PCS', 'KG', 'LTR', 'MTR', 'SQM', 'SET', 'PAIR', 'BOX', 'CTN', 'DZN']),
    defaultTaxRate: z.number().min(0).max(100),
    isFBRActive: z.boolean().default(true),
    notes: z.string().max(1000).optional(),
    effectiveFrom: z.iso.datetime().optional(),
    effectiveTo: z.iso.datetime().optional(),
})

export const HSCodeImportRowSchema = z.object({
    code: z.string(),
    description: z.string(),
    category: z.string(),
    defaultTaxRate: z.coerce.number(),
    unit: z.string().default('PCS'),
    shortName: z.string().optional(),
})

export const HSCodeImportSchema = z.array(HSCodeImportRowSchema)
