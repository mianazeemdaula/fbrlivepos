import { z } from 'zod'

export const HSCodeSchema = z.object({
    code: z.string().min(2, 'Code is required').max(20),
    description: z.string().min(2, 'Description must be at least 2 characters').max(500),
    shortName: z.string().max(100).optional().nullable(),
    category: z.string().min(2, 'Category is required').max(100),
    subCategory: z.string().max(100).optional().nullable(),
    unit: z.string().min(1, 'Unit is required'),
    defaultTaxRate: z.coerce.number().min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%'),
    isFBRActive: z.boolean().default(true),
    notes: z.string().max(1000).optional().nullable(),
    effectiveFrom: z.string().optional().nullable(),
    effectiveTo: z.string().optional().nullable(),
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

