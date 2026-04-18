import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'
import { checkPlanLimit } from '@/lib/features/flags'

const CreateProductSchema = z.object({
    name: z.string().min(1),
    sku: z.string().optional(),
    hsCodeId: z.string().optional(),
    hsCode: z.string().min(4).optional(),
    description: z.string().optional(),
    price: z.number().positive(),
    taxRate: z.number().min(0).max(100),
    unit: z.string().min(1),
})

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
                unit: body.unit,
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
        }),
        prisma.product.count({ where }),
    ])

    return NextResponse.json({
        data: products,
        total,
        page,
        pages: Math.ceil(total / limit),
        meta: {
            total,
            totalPages: Math.ceil(total / limit),
        },
    })
}
