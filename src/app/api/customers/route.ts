import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'
import { isValidMobile, isValidNtnCnic, normalizeMobile, normalizeNtnCnic } from '@/lib/validation/pakistan'

const CreateCustomerSchema = z.object({
    name: z.string().min(1),
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
})

export async function POST(req: NextRequest) {
    const { tenant } = await getTenantFromSession()
    const body = CreateCustomerSchema.parse(await req.json())

    // Check for duplicate NTN/CNIC within tenant
    if (body.ntnCnic) {
        const existing = await prisma.customer.findUnique({
            where: { tenantId_ntnCnic: { tenantId: tenant.id, ntnCnic: body.ntnCnic } },
        })
        if (existing) {
            return NextResponse.json(
                { error: `A customer with NTN/CNIC ${body.ntnCnic} already exists` },
                { status: 409 },
            )
        }
    }

    const customer = await prisma.customer.create({
        data: {
            tenantId: tenant.id,
            name: body.name,
            ntnCnic: body.ntnCnic || null,
            phone: body.phone || null,
            email: body.email || null,
            province: body.province || null,
            address: body.address || null,
            registrationType: body.registrationType || null,
        },
    })

    return NextResponse.json({ customer }, { status: 201 })
}

export async function GET(req: NextRequest) {
    const { tenant } = await getTenantFromSession()
    const { searchParams } = new URL(req.url)

    const q = searchParams.get('q') || ''
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 25)))

    const where = {
        tenantId: tenant.id,
        isActive: true,
        ...(q
            ? {
                OR: [
                    { name: { contains: q, mode: 'insensitive' as const } },
                    { ntnCnic: { contains: q } },
                    { phone: { contains: q } },
                ],
            }
            : {}),
    }

    const [customers, total] = await Promise.all([
        prisma.customer.findMany({
            where,
            orderBy: { name: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.customer.count({ where }),
    ])

    return NextResponse.json({
        data: customers,
        total,
        page,
        pages: Math.ceil(total / limit),
    })
}
