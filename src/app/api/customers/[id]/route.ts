import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'

const UpdateCustomerSchema = z.object({
    name: z.string().min(1).optional(),
    ntnCnic: z.string().regex(/^(\d{7}|\d{13})$/).optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    province: z.string().optional(),
    address: z.string().optional(),
    registrationType: z.enum(['Registered', 'Unregistered']).optional(),
    isActive: z.boolean().optional(),
})

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { tenant } = await getTenantFromSession()
    const { id } = await params

    const customer = await prisma.customer.findFirst({
        where: { id, tenantId: tenant.id },
        include: {
            invoices: {
                select: { id: true, invoiceNumber: true, totalAmount: true, createdAt: true, status: true },
                orderBy: { createdAt: 'desc' },
                take: 10,
            },
        },
    })

    if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    return NextResponse.json({ customer })
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { tenant } = await getTenantFromSession()
    const { id } = await params
    const body = UpdateCustomerSchema.parse(await req.json())

    const existing = await prisma.customer.findFirst({
        where: { id, tenantId: tenant.id },
    })

    if (!existing) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const customer = await prisma.customer.update({
        where: { id },
        data: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.ntnCnic !== undefined ? { ntnCnic: body.ntnCnic } : {}),
            ...(body.phone !== undefined ? { phone: body.phone } : {}),
            ...(body.email !== undefined ? { email: body.email || null } : {}),
            ...(body.province !== undefined ? { province: body.province } : {}),
            ...(body.address !== undefined ? { address: body.address } : {}),
            ...(body.registrationType !== undefined ? { registrationType: body.registrationType } : {}),
            ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
    })

    return NextResponse.json({ customer })
}
