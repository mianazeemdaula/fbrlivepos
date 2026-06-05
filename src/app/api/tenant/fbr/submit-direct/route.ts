import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'
import { getDIClientForTenant, DIAuthError, DIConfigError, DIServerError } from '@/lib/di/client'
import type { DIInvoicePayload } from '@/lib/di/types'
import { getSellerIdentity } from '@/lib/di/seller'
import { getScenarioId, getSaleTypeIdFromLabel } from '@/lib/di/sale-type-config'
import { evaluateDIItemReadiness } from '@/lib/di/eligibility'
import { mapDIErrorCodes } from '@/lib/di/error-codes'
import { resolveDIRateDescriptor } from '@/lib/di/rate'
import { calculateSalesTaxApplicable } from '@/lib/di/tax'
import { stringifyError } from '@/lib/fbr/submission-log'

const DEFAULT_FALLBACK_UOM = 'Numbers, pieces, units'

const DirectItemSchema = z.object({
    name: z.string().trim().min(1, 'Product name is required'),
    hsCode: z.string().trim().min(1, 'HS code is required in input'),
    price: z.number().min(0),
    quantity: z.number().positive(),
    discount: z.number().min(0).default(0),
    taxRate: z.number().min(0),
    diRate: z.string().trim().min(1),
    diSaleType: z.string().trim().min(1),
    unit: z.string().trim().optional().default(DEFAULT_FALLBACK_UOM),
    diFixedNotifiedValueOrRetailPrice: z.number().nullable().optional(),
    sroScheduleNo: z.string().nullable().optional(),
    sroItemSerialNo: z.string().nullable().optional(),
    valueSalesExcludingST: z.number().min(0).optional(),
    salesTaxApplicable: z.number().min(0).optional(),
    totalValues: z.number().min(0).optional(),
    totalInvoiceValue: z.number().min(0).optional(),
    furtherTax: z.number().min(0).optional().default(0),
    extraTax: z.number().min(0).optional().default(0),
    fedPayable: z.number().min(0).optional().default(0),
    diSalesTaxWithheldAtSource: z.number().min(0).optional().default(0),
})

const DirectSubmissionSchema = z.object({
    buyerName: z.string().optional(),
    buyerNTN: z.string().optional(),
    buyerProvince: z.string().optional(),
    buyerAddress: z.string().optional(),
    buyerRegistrationType: z.enum(['Registered', 'Unregistered']).optional(),
    invoiceType: z.enum(['Sale Invoice', 'Debit Note']).default('Sale Invoice'),
    invoiceRefNo: z.string().optional(),
    items: z.array(DirectItemSchema).min(1),
})

function normalizeText(value: string | null | undefined): string {
    return value?.trim() ?? ''
}

function buildDirectPayload(input: z.infer<typeof DirectSubmissionSchema>, creds: NonNullable<Awaited<ReturnType<typeof prisma.dICredentials.findUnique>>>, tenant: { preferredIdType?: string | null; name?: string | null; address?: string | null }): DIInvoicePayload {
    const seller = getSellerIdentity(creds, {
        preferredIdType: tenant.preferredIdType,
        name: tenant.name,
        address: tenant.address,
    })

    const buyerRegistrationType = input.buyerRegistrationType ?? 'Unregistered'
    const saleTypeLabel = input.items[0]?.diSaleType ?? ''
    const saleTypeId = saleTypeLabel ? getSaleTypeIdFromLabel(saleTypeLabel) : null
    const isSandbox = creds.environment === 'SANDBOX'
    const scenarioId = isSandbox && saleTypeId
        ? getScenarioId(saleTypeId, buyerRegistrationType)
        : undefined

    return {
        invoiceType: input.invoiceType,
        invoiceDate: new Date().toISOString().split('T')[0],
        sellerNTNCNIC: seller.sellerNTNCNIC,
        sellerBusinessName: seller.sellerBusinessName,
        sellerProvince: seller.sellerProvince,
        sellerAddress: seller.sellerAddress,
        buyerNTNCNIC: buyerRegistrationType === 'Registered' ? normalizeText(input.buyerNTN) : normalizeText(input.buyerNTN),
        buyerBusinessName: normalizeText(input.buyerName) || 'Walk-in Customer',
        buyerProvince: normalizeText(input.buyerProvince) || creds.sellerProvince,
        buyerAddress: normalizeText(input.buyerAddress) || normalizeText(input.buyerName) || 'N/A',
        buyerRegistrationType,
        invoiceRefNo: input.invoiceType === 'Debit Note' ? normalizeText(input.invoiceRefNo) : '',
        scenarioId,
        items: input.items.map((item) => {
            const lineDiscount = Number((item.discount ?? 0).toFixed(2))
            const lineValue = Number((item.valueSalesExcludingST ?? (item.price * item.quantity - lineDiscount)).toFixed(2))
            const isThirdSchedule = normalizeText(item.diSaleType).toLowerCase() === '3rd schedule goods'
            const resolvedRate = resolveDIRateDescriptor({
                diRate: item.diRate,
                taxRate: item.taxRate,
                diSaleType: item.diSaleType,
            })
            const retailBase = (item.diFixedNotifiedValueOrRetailPrice ?? item.price) * item.quantity
            const salesTaxApplicable = item.salesTaxApplicable ?? calculateSalesTaxApplicable({
                saleType: item.diSaleType,
                taxRate: item.taxRate,
                taxableValue: lineValue,
                retailPrice: retailBase,
                quantity: item.quantity,
            })
            const furtherTax = Number((item.furtherTax ?? 0).toFixed(2))
            const fedPayable = Number((item.fedPayable ?? 0).toFixed(2))
            const extraTax = Number((item.extraTax ?? 0).toFixed(2))

            return {
                hsCode: item.hsCode,
                productDescription: item.name,
                rate: resolvedRate,
                uoM: normalizeText(item.unit) || DEFAULT_FALLBACK_UOM,
                quantity: Number(item.quantity.toFixed(4)),
                totalValues: item.totalValues ?? (isThirdSchedule ? Number((lineValue + salesTaxApplicable).toFixed(2)) : 0),
                valueSalesExcludingST: lineValue,
                fixedNotifiedValueOrRetailPrice: isThirdSchedule
                    ? Number((item.diFixedNotifiedValueOrRetailPrice ?? item.price).toFixed(2))
                    : Number((item.diFixedNotifiedValueOrRetailPrice ?? 0).toFixed(2)),
                salesTaxApplicable,
                salesTaxWithheldAtSource: Number((item.diSalesTaxWithheldAtSource ?? 0).toFixed(2)),
                extraTax: extraTax === 0 ? '' : extraTax,
                furtherTax,
                sroScheduleNo: normalizeText(item.sroScheduleNo),
                fedPayable,
                discount: lineDiscount,
                saleType: item.diSaleType,
                sroItemSerialNo: normalizeText(item.sroItemSerialNo),
            }
        }),
    }
}

export async function POST(req: NextRequest) {
    const { tenant } = await getTenantFromSession()

    try {
        const body = DirectSubmissionSchema.parse(await req.json())
        const creds = await prisma.dICredentials.findUnique({ where: { tenantId: tenant.id } })

        if (!creds) {
            return NextResponse.json({ error: 'DI credentials not configured. Please set up your PRAL DI credentials in Settings.' }, { status: 422 })
        }

        const hasToken = creds.environment === 'SANDBOX'
            ? !!creds.encryptedSandboxToken
            : !!creds.encryptedProductionToken

        if (!hasToken) {
            return NextResponse.json({ error: 'Your PRAL DI token is not configured. Please complete IRIS registration.' }, { status: 422 })
        }

        const readinessIssues = body.items
            .flatMap((item) => evaluateDIItemReadiness({
                name: item.name,
                hsCode: item.hsCode,
                diSaleType: item.diSaleType,
                diRate: resolveDIRateDescriptor({
                    diRate: item.diRate,
                    taxRate: item.taxRate,
                    diSaleType: item.diSaleType,
                }),
                diUOM: item.unit,
                unit: item.unit,
                diFixedNotifiedValueOrRetailPrice: item.diFixedNotifiedValueOrRetailPrice ?? null,
                sroScheduleNo: item.sroScheduleNo ?? null,
                sroItemSerialNo: item.sroItemSerialNo ?? null,
            }).issues)

        if (readinessIssues.length > 0) {
            return NextResponse.json({ success: false, error: readinessIssues.join(' ') }, { status: 422 })
        }

        const payload = buildDirectPayload(body, creds, tenant)
        const diClient = await getDIClientForTenant(tenant.id)

        const validation = await diClient.validateInvoice(payload)
        if (validation.validationResponse.statusCode === '01') {
            return NextResponse.json(
                {
                    success: false,
                    valid: false,
                    errors: mapDIErrorCodes(validation.validationResponse),
                    rawResponse: validation,
                    payload,
                },
                { status: 422 },
            )
        }

        const response = await diClient.postInvoice(payload)

        return NextResponse.json({
            success: true,
            valid: response.validationResponse.statusCode === '00',
            diInvoiceNumber: response.invoiceNumber,
            response,
            payload,
        })
    } catch (err) {
        if (err instanceof z.ZodError) {
            return NextResponse.json({ success: false, error: err.issues[0]?.message ?? 'Invalid direct submission input.' }, { status: 400 })
        }

        if (err instanceof DIAuthError) {
            return NextResponse.json(
                { error: 'Your PRAL DI token was rejected by PRAL (401 Unauthorized). Verify token and IP whitelisting.' },
                { status: 401 },
            )
        }

        if (err instanceof DIConfigError) {
            return NextResponse.json({ error: err.message }, { status: 422 })
        }

        if (err instanceof DIServerError) {
            return NextResponse.json({ success: false, error: 'PRAL server error during direct submission.' }, { status: 502 })
        }

        return NextResponse.json(
            { success: false, error: 'Direct PRAL submission failed', details: stringifyError(err) },
            { status: 500 },
        )
    }
}