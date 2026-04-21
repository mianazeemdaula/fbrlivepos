import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'
import { checkPlanLimit } from '@/lib/features/flags'
import { evaluateDIItemReadiness } from '@/lib/di/eligibility'

const CreateProductSchema = z.object({
    name: z.string().min(1),
    sku: z.string().optional(),
    hsCodeId: z.string().optional(),
    hsCode: z.string().min(4).optional(),
    description: z.string().optional(),
    price: z.number().positive(),
    taxRate: z.number().min(0).max(100),
    unit: z.string().min(1),
    diRate: z.string().optional(),
    diUOM: z.string().optional(),
    diSaleType: z.string().optional(),
    diFixedNotifiedValueOrRetailPrice: z.number().min(0).optional(),
    diSalesTaxWithheldAtSource: z.number().min(0).optional(),
    extraTax: z.number().min(0).optional(),
    furtherTax: z.number().min(0).optional(),
    fedPayable: z.number().min(0).optional(),
    sroScheduleNo: z.string().optional(),
    sroItemSerialNo: z.string().optional(),
})

function cleanOptionalString(value: string | undefined) {
    const trimmed = value?.trim()
    return trimmed ? trimmed : undefined
}

function resolveSharedUnit(body: z.infer<typeof CreateProductSchema>) {
    return cleanOptionalString(body.diUOM) ?? cleanOptionalString(body.unit)
}

function buildProductDIFields(body: z.infer<typeof CreateProductSchema>, sharedUnit: string) {
    return {
        unit: sharedUnit,
        diRate: cleanOptionalString(body.diRate),
        diUOM: sharedUnit,
        diSaleType: cleanOptionalString(body.diSaleType),
        diFixedNotifiedValueOrRetailPrice: body.diFixedNotifiedValueOrRetailPrice,
        diSalesTaxWithheldAtSource: body.diSalesTaxWithheldAtSource,
        extraTax: body.extraTax,
        furtherTax: body.furtherTax,
        fedPayable: body.fedPayable,
        sroScheduleNo: cleanOptionalString(body.sroScheduleNo),
        sroItemSerialNo: cleanOptionalString(body.sroItemSerialNo),
    }
}

export async function POST(req: NextRequest) {
    const { tenant } = await getTenantFromSession()

    const limit = await checkPlanLimit(tenant.id, 'maxProducts')
    if (!limit.allowed) {
        return NextResponse.json(
            {
                error: `Product limit reached (${limit.max}). Upgrade your plan.`,
                upgradeRequired: true,
            },
            { status: 403 },
        )
    }

    const body = CreateProductSchema.parse(await req.json())

    let hsCode = body.hsCode
    let selectedHSCode: null | { id: string; code: string; defaultTaxRate: unknown } = null

    if (body.hsCodeId) {
        selectedHSCode = await prisma.hSCode.findFirst({
            where: {
                id: body.hsCodeId,
                isFBRActive: true,
            },
            select: {
                id: true,
                code: true,
                defaultTaxRate: true,
            },
        })

        if (!selectedHSCode) {
            return NextResponse.json({ error: 'Selected HS code was not found.' }, { status: 400 })
        }

        hsCode = selectedHSCode.code
    }

    if (!hsCode) {
        return NextResponse.json({ error: 'HS code is required.' }, { status: 400 })
    }

    const sharedUnit = resolveSharedUnit(body)
    if (!sharedUnit) {
        return NextResponse.json({ error: 'Unit of measure is required.' }, { status: 400 })
    }

    const validUOMs = await prisma.dIHSCodeUOM.findMany({
        where: { hsCode },
        select: { uomDesc: true },
    })

    if (validUOMs.length > 0 && !validUOMs.some((entry) => entry.uomDesc === sharedUnit)) {
        return NextResponse.json({ error: 'Selected unit of measure is not valid for the chosen HS code.' }, { status: 400 })
    }

    const product = await prisma.$transaction(async (tx) => {
        const createdProduct = await tx.product.create({
            data: {
                tenantId: tenant.id,
                name: body.name,
                sku: body.sku,
                hsCode,
                description: body.description,
                price: body.price,
                taxRate: body.taxRate,
                ...buildProductDIFields(body, sharedUnit),
            },
        })

        if (selectedHSCode) {
            await tx.productHSCode.create({
                data: {
                    productId: createdProduct.id,
                    hsCodeId: selectedHSCode.id,
                    tenantId: tenant.id,
                    taxRate: body.taxRate,
                },
            })
        }

        return createdProduct
    })

    return NextResponse.json(product, { status: 201 })
}

export async function GET(req: NextRequest) {
    const { tenant } = await getTenantFromSession()
    const { searchParams } = new URL(req.url)

    const q = searchParams.get('q') ?? ''
    const page = Number(searchParams.get('page') ?? 1)
    const limit = Number(searchParams.get('limit') ?? 50)

    const where = {
        tenantId: tenant.id,
        isActive: true,
        ...(q
            ? {
                OR: [
                    { name: { contains: q, mode: 'insensitive' as const } },
                    { sku: { contains: q, mode: 'insensitive' as const } },
                    { hsCode: { contains: q } },
                ],
            }
            : {}),
    }

    const [products, total] = await Promise.all([
        prisma.product.findMany({
            where,
            orderBy: { name: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                hsCodeMapping: {
                    select: { hsCodeId: true },
                },
            },
        }),
        prisma.product.count({ where }),
    ])

    const data = products.map((product) => {
        const diReadiness = evaluateDIItemReadiness({
            name: product.name,
            hsCode: product.hsCode,
            diSaleType: product.diSaleType,
            diRate: product.diRate,
            diUOM: product.diUOM,
            unit: product.unit,
            diFixedNotifiedValueOrRetailPrice: product.diFixedNotifiedValueOrRetailPrice != null
                ? Number(product.diFixedNotifiedValueOrRetailPrice)
                : null,
            sroScheduleNo: product.sroScheduleNo,
            sroItemSerialNo: product.sroItemSerialNo,
        })

        return {
            ...product,
            hsCodeId: product.hsCodeMapping?.hsCodeId ?? null,
            price: Number(product.price),
            taxRate: Number(product.taxRate),
            diFixedNotifiedValueOrRetailPrice: product.diFixedNotifiedValueOrRetailPrice != null
                ? Number(product.diFixedNotifiedValueOrRetailPrice)
                : null,
            diSalesTaxWithheldAtSource: product.diSalesTaxWithheldAtSource != null
                ? Number(product.diSalesTaxWithheldAtSource)
                : null,
            extraTax: product.extraTax != null ? Number(product.extraTax) : null,
            furtherTax: product.furtherTax != null ? Number(product.furtherTax) : null,
            fedPayable: product.fedPayable != null ? Number(product.fedPayable) : null,
            diReady: diReadiness.ready,
            diIssues: diReadiness.issues,
        }
    })

    return NextResponse.json({
        data,
        total,
        page,
        pages: Math.ceil(total / limit),
        meta: {
            total,
            totalPages: Math.ceil(total / limit),
        },
    })
}
