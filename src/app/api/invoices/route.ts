import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'
import { getNextInvoiceNumber } from '@/lib/invoices/numbering'
import { checkPlanLimit } from '@/lib/features/flags'
import { isValidMobile, isValidNtnCnic, normalizeMobile, normalizeNtnCnic } from '@/lib/validation/pakistan'

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
            productId: z.string(),
            quantity: z.number().positive(),
            discount: z.number().min(0).default(0),
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

    const body = CreateInvoiceSchema.parse(await req.json())

    // Fetch products with tenant guard
    const products = await prisma.product.findMany({
        where: {
            tenantId: tenant.id,
            id: { in: body.items.map((i) => i.productId) },
            isActive: true,
        },
    })

    if (products.length !== body.items.length) {
        return NextResponse.json({ error: 'One or more products not found' }, { status: 400 })
    }

    const productMap = new Map(products.map((p) => [p.id, p]))

    // Calculate totals
    let subtotal = 0
    let taxAmount = 0
    let discountAmount = 0

    const invoiceItems = body.items.map((item) => {
        const product = productMap.get(item.productId)!
        const unitPrice = Number(product.price)
        const qty = item.quantity
        const itemDiscount = item.discount ?? 0
        const lineSubtotal = unitPrice * qty
        const taxableAmount = lineSubtotal - itemDiscount
        const lineTax = (taxableAmount * Number(product.taxRate)) / 100
        const lineTotal = taxableAmount + lineTax

        subtotal += lineSubtotal
        taxAmount += lineTax
        discountAmount += itemDiscount

        return {
            productId: product.id,
            hsCode: product.hsCode,
            name: product.name,
            quantity: qty,
            unit: product.unit,
            unitPrice,
            taxRate: Number(product.taxRate),
            taxAmount: lineTax,
            diRate: product.diRate,
            diUOM: product.diUOM ?? product.unit,
            diSaleType: product.diSaleType,
            diFixedNotifiedValueOrRetailPrice: product.diFixedNotifiedValueOrRetailPrice != null
                ? Number(product.diFixedNotifiedValueOrRetailPrice)
                : null,
            diSalesTaxWithheldAtSource: product.diSalesTaxWithheldAtSource != null
                ? Number(product.diSalesTaxWithheldAtSource)
                : null,
            extraTax: product.extraTax != null ? Number(product.extraTax) : null,
            furtherTax: product.furtherTax != null ? Number(product.furtherTax) : null,
            fedPayable: product.fedPayable != null ? Number(product.fedPayable) : null,
            sroScheduleNo: product.sroScheduleNo,
            sroItemSerialNo: product.sroItemSerialNo,
            discount: itemDiscount,
            lineTotal,
        }
    })

    const totalAmount = subtotal - discountAmount + taxAmount
    const invoiceNumber = await getNextInvoiceNumber(tenant.id)

    const invoice = await prisma.invoice.create({
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
            items: { create: invoiceItems },
        },
        include: { items: true },
    })

    return NextResponse.json({ invoice }, { status: 201 })
}

export async function GET(req: NextRequest) {
    const { tenant } = await getTenantFromSession()
    const { searchParams } = new URL(req.url)

    const page = Number(searchParams.get('page') ?? 1)
    const limit = Number(searchParams.get('limit') ?? 25)
    const status = searchParams.get('status')

    const where = {
        tenantId: tenant.id,
        ...(status ? { status: status as 'PENDING' | 'QUEUED' | 'SUBMITTED' | 'FAILED' } : {}),
    }

    // Date boundaries for stats
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [invoices, total, todayAgg, monthAgg] = await Promise.all([
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
        },
    })
}
