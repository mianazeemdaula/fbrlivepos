import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'
import { getNextInvoiceNumber } from '@/lib/invoices/numbering'
import { checkPlanLimit } from '@/lib/features/flags'
import { isValidMobile, isValidNtnCnic, normalizeMobile, normalizeNtnCnic } from '@/lib/validation/pakistan'
import { resolveDIRateDescriptor } from '@/lib/di/rate'
import { calculateSalesTaxApplicable } from '@/lib/di/tax'

const DEFAULT_FALLBACK_UOM = 'Numbers, pieces, units'

function normalizeOptionalText(value?: string | null) {
    const trimmed = value?.trim()
    return trimmed?.length ? trimmed : undefined
}

const CreateInvoiceSchema = z.object({
    terminalId: z.string().optional(),
    buyerNTN: z.string().optional().transform((value) => {
        const normalized = normalizeNtnCnic(value)
        return normalized || undefined
    }).refine((value) => value === undefined || isValidNtnCnic(value), 'Buyer NTN/CNIC must be 7 or 13 digits'),
    buyerName: z.string().optional(),
    buyerPhone: z.string().optional().transform((value) => {
        const normalized = normalizeMobile(value)
        return normalized || undefined
    }).refine((value) => value === undefined || isValidMobile(value), 'Buyer phone must be a valid Pakistani mobile number'),
    buyerProvince: z.string().optional(),
    buyerAddress: z.string().optional(),
    buyerRegistrationType: z.enum(['Registered', 'Unregistered']).optional(),
    customerId: z.string().optional(),
    paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER']),
    items: z.array(
        z.object({
            productId: z.string().optional(),
            name: z.string().optional(),
            hsCode: z.string().optional(),
            price: z.number().min(0).optional(),
            taxRate: z.number().min(0).max(100).optional(),
            unit: z.string().optional(),
            diRate: z.string().optional(),
            diSaleType: z.string().optional(),
            diFixedNotifiedValueOrRetailPrice: z.number().min(0).nullable().optional(),
            sroScheduleNo: z.string().optional(),
            sroItemSerialNo: z.string().optional(),
            quantity: z.number().positive(),
            discount: z.number().min(0).default(0),
        }).superRefine((value, ctx) => {
            if (value.productId) return

            if (!normalizeOptionalText(value.hsCode)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'HS code is required when productId is not provided.',
                    path: ['hsCode'],
                })
            }

            if (!normalizeOptionalText(value.name)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Product name is required when productId is not provided.',
                    path: ['name'],
                })
            }

            if (value.price == null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Price is required when productId is not provided.',
                    path: ['price'],
                })
            }

            if (value.taxRate == null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Tax rate is required when productId is not provided.',
                    path: ['taxRate'],
                })
            }
        }),
    ).min(1),
})

export async function POST(req: NextRequest) {
    const { tenant, userId } = await getTenantFromSession()

    // Check plan limit
    const limit = await checkPlanLimit(tenant.id, 'maxInvoicesMonth')
    if (!limit.allowed) {
        return NextResponse.json(
            {
                error: `Monthly invoice limit reached (${limit.max}). Upgrade your plan.`,
                upgradeRequired: true,
            },
            { status: 403 },
        )
    }

    const parsed = CreateInvoiceSchema.safeParse(await req.json())
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid invoice input.' }, { status: 400 })
    }
    const body = parsed.data

    // Fetch catalog products with tenant guard
    const productIds = [...new Set(body.items.map((i) => i.productId).filter((id): id is string => Boolean(id)))]
    const products = await prisma.product.findMany({
        where: {
            tenantId: tenant.id,
            id: { in: productIds },
            isActive: true,
        },
    })

    if (products.length !== productIds.length) {
        return NextResponse.json({ error: 'One or more products not found' }, { status: 400 })
    }

    const productMap = new Map(products.map((p) => [p.id, p]))

    // Calculate totals
    let subtotal = 0
    let taxAmount = 0
    let discountAmount = 0

    const invoiceNumber = await getNextInvoiceNumber(tenant.id)

    // Stamp the invoice with the tenant's current DI environment so sandbox and live invoices are separated
    const diCreds = await prisma.dICredentials.findUnique({ where: { tenantId: tenant.id }, select: { environment: true } })
    const diEnvironment = diCreds?.environment ?? 'SANDBOX'

    const invoice = await prisma.$transaction(async (tx) => {
        const invoiceItems = [] as Array<{
            productId: string
            hsCode: string
            name: string
            quantity: number
            unit: string
            unitPrice: number
            taxRate: number
            taxAmount: number
            diRate: string | null
            diUOM: string
            diSaleType: string | null
            diFixedNotifiedValueOrRetailPrice: number | null
            diSalesTaxWithheldAtSource: number | null
            extraTax: number | null
            furtherTax: number | null
            fedPayable: number | null
            sroScheduleNo: string | null
            sroItemSerialNo: string | null
            discount: number
            lineTotal: number
        }>

        for (const [index, item] of body.items.entries()) {
            let product = item.productId ? productMap.get(item.productId) : null

            if (!product) {
                const directName = normalizeOptionalText(item.name) ?? `POS Item ${index + 1}`
                const directHSCode = normalizeOptionalText(item.hsCode)!

                const directUnit = normalizeOptionalText(item.unit) ?? DEFAULT_FALLBACK_UOM
                const createdProduct = await tx.product.create({
                    data: {
                        tenantId: tenant.id,
                        name: directName,
                        sku: `POS-DRAFT-${Date.now()}-${index + 1}`,
                        hsCode: directHSCode,
                        price: item.price ?? 0,
                        taxRate: item.taxRate ?? 0,
                        unit: directUnit,
                        diUOM: directUnit,
                        diRate: normalizeOptionalText(item.diRate),
                        diSaleType: normalizeOptionalText(item.diSaleType),
                        diFixedNotifiedValueOrRetailPrice: item.diFixedNotifiedValueOrRetailPrice ?? null,
                        sroScheduleNo: normalizeOptionalText(item.sroScheduleNo),
                        sroItemSerialNo: normalizeOptionalText(item.sroItemSerialNo),
                        isActive: false,
                    },
                })
                product = createdProduct
            }

            const unitPrice = Number(item.price ?? product.price)
            const qty = item.quantity
            const itemDiscount = item.discount ?? 0
            const lineSubtotal = unitPrice * qty
            const taxableAmount = lineSubtotal - itemDiscount
            const taxRate = Number(item.taxRate ?? product.taxRate)
            const directSaleType = normalizeOptionalText(item.diSaleType)
            const productSaleType = normalizeOptionalText(product.diSaleType)
            const resolvedSaleType = directSaleType ?? productSaleType ?? null
            const resolvedRate = resolveDIRateDescriptor({
                diRate: normalizeOptionalText(item.diRate) ?? product.diRate,
                taxRate,
                diSaleType: resolvedSaleType,
            })

            const retailBase = item.diFixedNotifiedValueOrRetailPrice != null
                ? Number(item.diFixedNotifiedValueOrRetailPrice)
                : product.diFixedNotifiedValueOrRetailPrice != null
                    ? Number(product.diFixedNotifiedValueOrRetailPrice)
                    : unitPrice
            const lineTax = calculateSalesTaxApplicable({
                saleType: resolvedSaleType,
                taxRate,
                taxableValue: taxableAmount,
                retailPrice: retailBase,
                quantity: qty,
            })
            const lineTotal = taxableAmount + lineTax
            const unit = normalizeOptionalText(item.unit) ?? product.unit ?? DEFAULT_FALLBACK_UOM

            subtotal += lineSubtotal
            taxAmount += lineTax
            discountAmount += itemDiscount

            invoiceItems.push({
                productId: product.id,
                hsCode: normalizeOptionalText(item.hsCode) ?? product.hsCode,
                name: normalizeOptionalText(item.name) ?? product.name,
                quantity: qty,
                unit,
                unitPrice,
                taxRate,
                taxAmount: lineTax,
                diRate: resolvedRate || null,
                diUOM: unit,
                diSaleType: resolvedSaleType,
                diFixedNotifiedValueOrRetailPrice: item.diFixedNotifiedValueOrRetailPrice != null
                    ? Number(item.diFixedNotifiedValueOrRetailPrice)
                    : product.diFixedNotifiedValueOrRetailPrice != null
                        ? Number(product.diFixedNotifiedValueOrRetailPrice)
                        : null,
                diSalesTaxWithheldAtSource: product.diSalesTaxWithheldAtSource != null
                    ? Number(product.diSalesTaxWithheldAtSource)
                    : null,
                extraTax: product.extraTax != null ? Number(product.extraTax) : null,
                furtherTax: product.furtherTax != null ? Number(product.furtherTax) : null,
                fedPayable: product.fedPayable != null ? Number(product.fedPayable) : null,
                sroScheduleNo: normalizeOptionalText(item.sroScheduleNo) ?? product.sroScheduleNo,
                sroItemSerialNo: normalizeOptionalText(item.sroItemSerialNo) ?? product.sroItemSerialNo,
                discount: itemDiscount,
                lineTotal,
            })
        }

        const totalAmount = subtotal - discountAmount + taxAmount

        return tx.invoice.create({
            data: {
                tenantId: tenant.id,
                userId,
                terminalId: body.terminalId,
                invoiceNumber,
                buyerNTN: body.buyerNTN,
                buyerName: body.buyerName,
                buyerPhone: body.buyerPhone,
                buyerProvince: body.buyerProvince,
                buyerAddress: body.buyerAddress,
                buyerRegistrationType: body.buyerRegistrationType,
                customerId: body.customerId,
                subtotal,
                taxAmount,
                discountAmount,
                totalAmount,
                paymentMethod: body.paymentMethod,
                status: 'DRAFT',
                invoiceType: 'Sale Invoice',
                diEnvironment,
                items: { create: invoiceItems },
            },
            include: { items: true },
        })
    })

    return NextResponse.json({ invoice }, { status: 201 })
}

export async function GET(req: NextRequest) {
    const { tenant } = await getTenantFromSession()
    const { searchParams } = new URL(req.url)

    const page = Number(searchParams.get('page') ?? 1)
    const limit = Number(searchParams.get('limit') ?? 25)
    const status = searchParams.get('status')
    const q = searchParams.get('q')?.trim()
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const paymentMethod = searchParams.get('paymentMethod')

    // Filter invoices by the tenant's current DI environment so sandbox and live invoices are separated
    const diCreds = await prisma.dICredentials.findUnique({ where: { tenantId: tenant.id }, select: { environment: true } })
    const diEnvironment = diCreds?.environment ?? 'SANDBOX'

    const dateFilter = fromParam || toParam ? {
        createdAt: {
            ...(fromParam ? { gte: new Date(fromParam) } : {}),
            ...(toParam ? { lte: new Date(new Date(toParam).setHours(23, 59, 59, 999)) } : {}),
        },
    } : {}

    const where = {
        tenantId: tenant.id,
        diEnvironment,
        ...(status ? { status: status as 'PENDING' | 'QUEUED' | 'SUBMITTED' | 'FAILED' | 'CONFIRMED' | 'DRAFT' | 'VALIDATED' | 'CANCELLED' } : {}),
        ...(paymentMethod ? { paymentMethod: paymentMethod as 'CASH' | 'CARD' | 'BANK_TRANSFER' } : {}),
        ...(q ? {
            OR: [
                { invoiceNumber: { contains: q, mode: 'insensitive' as const } },
                { buyerName: { contains: q, mode: 'insensitive' as const } },
                { buyerNTN: { contains: q, mode: 'insensitive' as const } },
            ],
        } : {}),
        ...dateFilter,
    }

    // Date boundaries for stats
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [invoices, total, todayAgg, monthAgg, invoiceLimit] = await Promise.all([
        prisma.invoice.findMany({
            where,
            include: { items: true, user: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.invoice.count({ where }),
        prisma.invoice.aggregate({
            where: { tenantId: tenant.id, createdAt: { gte: todayStart } },
            _count: true,
            _sum: { totalAmount: true },
        }),
        prisma.invoice.aggregate({
            where: { tenantId: tenant.id, createdAt: { gte: monthStart } },
            _count: true,
            _sum: { totalAmount: true },
        }),
        checkPlanLimit(tenant.id, 'maxInvoicesMonth'),
    ])

    return NextResponse.json({
        invoices,
        data: invoices,
        total,
        page,
        pages: Math.ceil(total / limit),
        meta: {
            todayCount: todayAgg._count,
            todaySales: Number(todayAgg._sum.totalAmount ?? 0),
            monthCount: monthAgg._count,
            monthSales: Number(monthAgg._sum.totalAmount ?? 0),
            total,
            totalPages: Math.ceil(total / limit),
            invoiceLimit: {
                current: invoiceLimit.current,
                max: invoiceLimit.max,
                allowed: invoiceLimit.allowed,
            },
        },
    })
}
