import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantFromSession } from '@/lib/tenant/context'
import { getDIClientForTenant, DIAuthError, DIServerError } from '@/lib/di/client'
import { mapDIErrorCodes } from '@/lib/di/error-codes'
import { SCENARIO_DESCRIPTIONS, getRequiredScenarios } from '@/lib/di/scenarios'
import { prisma } from '@/lib/db/prisma'
import type { DIInvoicePayload } from '@/lib/di/types'

const SandboxTestSchema = z.object({
    scenarioId: z.string().regex(/^SN\d{3}$/, 'Invalid scenario ID format'),
    buyer: z.object({
        name: z.string().min(1, 'Buyer name is required'),
        ntn: z.string().regex(/^\d{7}$/).optional().or(z.literal('')),
        province: z.string().min(1, 'Province is required'),
        address: z.string().min(1, 'Address is required'),
        registrationType: z.enum(['Registered', 'Unregistered']),
    }),
    item: z.object({
        hsCode: z.string().min(1, 'HS Code is required'),
        description: z.string().min(1, 'Description is required'),
        quantity: z.number().positive('Quantity must be positive'),
        unitPrice: z.number().positive('Unit price must be positive'),
        taxRate: z.number().min(0).max(100),
        rate: z.string().min(1, 'Rate is required'),
        uom: z.string().min(1, 'UOM is required'),
        saleType: z.string().min(1, 'Sale type is required'),
        sroScheduleNo: z.string().optional(),
        furtherTax: z.number().min(0).optional(),
        extraTax: z.number().min(0).optional(),
        fedPayable: z.number().min(0).optional(),
        discount: z.number().min(0).optional(),
    }),
})

export async function POST(req: NextRequest) {
    const { tenant } = await getTenantFromSession()

    let body: z.infer<typeof SandboxTestSchema>
    try {
        body = SandboxTestSchema.parse(await req.json())
    } catch (err) {
        return NextResponse.json({ error: 'Invalid request data', details: err }, { status: 400 })
    }

    const { scenarioId, buyer, item } = body

    const creds = await prisma.dICredentials.findUnique({ where: { tenantId: tenant.id } })

    if (!creds) {
        return NextResponse.json(
            { error: 'DI credentials not configured. Please complete setup in Settings.' },
            { status: 422 },
        )
    }
    if (!creds.encryptedSandboxToken) {
        return NextResponse.json(
            { error: 'Sandbox token not configured. Paste your IRIS sandbox token in Settings.' },
            { status: 422 },
        )
    }
    if (creds.environment !== 'SANDBOX') {
        return NextResponse.json(
            { error: 'Switch to SANDBOX environment before running scenario tests.' },
            { status: 422 },
        )
    }

    // Validate buyer NTN for registered scenarios
    if (buyer.registrationType === 'Registered' && !buyer.ntn) {
        return NextResponse.json(
            { error: 'Buyer NTN is required for registered buyer scenarios.' },
            { status: 400 },
        )
    }

    const valueExclTax = parseFloat((item.unitPrice * item.quantity).toFixed(2))
    const taxAmount = parseFloat(((valueExclTax * item.taxRate) / 100).toFixed(2))

    const payload: DIInvoicePayload = {
        invoiceType: 'Sale Invoice',
        invoiceDate: new Date().toISOString().split('T')[0],

        sellerNTNCNIC: creds.sellerNTN,
        sellerBusinessName: creds.sellerBusinessName,
        sellerProvince: creds.sellerProvince,
        sellerAddress: creds.sellerAddress,

        buyerNTNCNIC: buyer.registrationType === 'Registered' && buyer.ntn ? buyer.ntn : undefined,
        buyerBusinessName: buyer.name,
        buyerProvince: buyer.province,
        buyerAddress: buyer.address,
        buyerRegistrationType: buyer.registrationType,

        scenarioId,

        items: [
            {
                hsCode: item.hsCode,
                productDescription: item.description,
                rate: item.rate,
                uoM: item.uom,
                quantity: parseFloat(item.quantity.toFixed(4)),
                totalValues: 0.0,
                valueSalesExcludingST: valueExclTax,
                fixedNotifiedValueOrRetailPrice: 0.0,
                salesTaxApplicable: taxAmount,
                salesTaxWithheldAtSource: 0.0,
                extraTax: item.extraTax ?? 0.0,
                furtherTax: item.furtherTax ?? 0.0,
                sroScheduleNo: item.sroScheduleNo ?? '',
                fedPayable: item.fedPayable ?? 0.0,
                discount: item.discount ?? 0.0,
                saleType: item.saleType,
                sroItemSerialNo: '',
            },
        ],
    }

    const start = Date.now()

    try {
        const diClient = await getDIClientForTenant(tenant.id)
        const response = await diClient.postInvoice(payload)
        const isValid = response.validationResponse.statusCode === '00'

        await prisma.sandboxScenario.upsert({
            where: { tenantId_scenarioId: { tenantId: tenant.id, scenarioId } },
            create: {
                tenantId: tenant.id,
                scenarioId,
                description: SCENARIO_DESCRIPTIONS[scenarioId] ?? scenarioId,
                status: isValid ? 'PASSED' : 'FAILED',
                completedAt: isValid ? new Date() : null,
                invoiceNo: response.invoiceNumber ?? null,
                errorCode: response.validationResponse.errorCode ?? null,
                errorDetail: response.validationResponse.error ?? null,
            },
            update: {
                status: isValid ? 'PASSED' : 'FAILED',
                completedAt: isValid ? new Date() : null,
                invoiceNo: response.invoiceNumber ?? null,
                errorCode: response.validationResponse.errorCode ?? null,
                errorDetail: response.validationResponse.error ?? null,
            },
        })

        if (isValid) {
            await checkSandboxCompletion(tenant.id, creds.businessActivity, creds.sector)
        }

        const errors = !isValid ? mapDIErrorCodes(response.validationResponse) : []

        return NextResponse.json({
            success: isValid,
            scenarioId,
            diInvoiceNumber: response.invoiceNumber ?? null,
            errors,
            rawResponse: response,
            durationMs: Date.now() - start,
        })
    } catch (err) {
        const isAuth = err instanceof DIAuthError
        const message = isAuth
            ? 'PRAL sandbox token unauthorized (401). Most common causes: (1) Your server IP is not yet whitelisted by PRAL — whitelisting takes ~2 working hours after submission. (2) The token was pasted with extra whitespace — re-save it in Settings to auto-trim. (3) Token was issued for a different environment.'
            : err instanceof DIServerError
                ? 'PRAL server error. Try again later or contact PRAL support at dicrm.pral.com.pk'
                : (err as Error).message

        await prisma.sandboxScenario.upsert({
            where: { tenantId_scenarioId: { tenantId: tenant.id, scenarioId } },
            create: {
                tenantId: tenant.id,
                scenarioId,
                description: SCENARIO_DESCRIPTIONS[scenarioId] ?? scenarioId,
                status: 'FAILED',
                errorDetail: message,
            },
            update: {
                status: 'FAILED',
                errorDetail: message,
            },
        })

        return NextResponse.json({ success: false, error: message }, { status: isAuth ? 401 : 500 })
    }
}

async function checkSandboxCompletion(tenantId: string, businessActivity: string, sector: string) {
    const required = getRequiredScenarios(businessActivity, sector)
    const passed = await prisma.sandboxScenario.count({ where: { tenantId, status: 'PASSED' } })

    if (passed >= required.length) {
        await prisma.dICredentials.update({
            where: { tenantId },
            data: {
                sandboxCompleted: true,
                sandboxCompletedAt: new Date(),
                irisRegistrationStatus: 'PRODUCTION_READY',
            },
        })
    }
}
