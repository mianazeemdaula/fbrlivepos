import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'

const UpdateProductSchema = z.object({
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
    return trimmed ? trimmed : null
}

function resolveSharedUnit(body: z.infer<typeof UpdateProductSchema>) {
    return cleanOptionalString(body.diUOM) ?? cleanOptionalString(body.unit)
}

function buildProductDIFields(body: z.infer<typeof UpdateProductSchema>, sharedUnit: string) {
    return {
        unit: sharedUnit,
        diRate: cleanOptionalString(body.diRate),
        diUOM: sharedUnit,
        diSaleType: cleanOptionalString(body.diSaleType),
        diFixedNotifiedValueOrRetailPrice: body.diFixedNotifiedValueOrRetailPrice ?? null,
        diSalesTaxWithheldAtSource: body.diSalesTaxWithheldAtSource ?? null,
        extraTax: body.extraTax ?? null,
        furtherTax: body.furtherTax ?? null,
        fedPayable: body.fedPayable ?? null,
        sroScheduleNo: cleanOptionalString(body.sroScheduleNo),
        sroItemSerialNo: cleanOptionalString(body.sroItemSerialNo),
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { tenant } = await getTenantFromSession()
    const { id } = await params
    const body = UpdateProductSchema.parse(await req.json())

    let hsCode = body.hsCode
    let selectedHSCode: null | { id: string; code: string } = null

    if (body.hsCodeId) {
        selectedHSCode = await prisma.hSCode.findFirst({
            where: {
                id: body.hsCodeId,
                isFBRActive: true,
            },
            select: { id: true, code: true },
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

    if (validUOMs.length > 0 && !validUOMs.some((entry) => entry.uomDesc.trim().toLowerCase() === sharedUnit.trim().toLowerCase())) {
        return NextResponse.json({ error: `Selected unit of measure (${sharedUnit}) is not valid for the chosen HS code. Valid options are: ${validUOMs.map(v => v.uomDesc).join(', ')}` }, { status: 400 })
    }

    const existingProduct = await prisma.product.findFirst({
        where: { id, tenantId: tenant.id },
        select: { id: true },
    })

    if (!existingProduct) {
        return NextResponse.json({ error: 'Product not found.' }, { status: 404 })
    }

    const product = await prisma.$transaction(async (tx) => {
        const updatedProduct = await tx.product.update({
            where: { id },
            data: {
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
            await tx.productHSCode.upsert({
                where: { productId: updatedProduct.id },
                create: {
                    productId: updatedProduct.id,
                    hsCodeId: selectedHSCode.id,
                    tenantId: tenant.id,
                    taxRate: body.taxRate,
                },
                update: {
                    hsCodeId: selectedHSCode.id,
                    taxRate: body.taxRate,
                },
            })
        }

        return updatedProduct
    })

    return NextResponse.json({
        ...product,
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
    })
}