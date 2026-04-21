import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'
import { isValidMobile, isValidNtnCnic, normalizeMobile, normalizeNtnCnic } from '@/lib/validation/pakistan'

const UpdateCustomerSchema = z.object({
    name: z.string().min(1).optional(),
    ntnCnic: z.string().optional().transform((value) => {
        const normalized = normalizeNtnCnic(value)
        return normalized || undefined
    }).refine((value) => value === undefined || isValidNtnCnic(value), 'Must be 7-digit NTN or 13-digit CNIC'),
    phone: z.string().optional().transform((value) => {
        const normalized = normalizeMobile(value)
        return normalized || undefined
    }).refine((value) => value === undefined || isValidMobile(value), 'Mobile must be a valid Pakistani number'),
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

    if (body.ntnCnic && body.ntnCnic !== existing.ntnCnic) {
        const duplicate = await prisma.customer.findUnique({
            where: { tenantId_ntnCnic: { tenantId: tenant.id, ntnCnic: body.ntnCnic } },
        })

        if (duplicate && duplicate.id !== existing.id) {
            return NextResponse.json(
                { error: `A customer with NTN/CNIC ${body.ntnCnic} already exists` },
                { status: 409 },
            )
        }
    }

    const customer = await prisma.customer.update({
        where: { id },
        data: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.ntnCnic !== undefined ? { ntnCnic: body.ntnCnic || null } : {}),
            ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
            ...(body.email !== undefined ? { email: body.email || null } : {}),
            ...(body.province !== undefined ? { province: body.province || null } : {}),
            ...(body.address !== undefined ? { address: body.address || null } : {}),
            ...(body.registrationType !== undefined ? { registrationType: body.registrationType } : {}),
            ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
    })

    return NextResponse.json({ customer })
}
