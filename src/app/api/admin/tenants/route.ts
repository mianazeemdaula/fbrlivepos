import { NextRequest, NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
    await assertSuperAdmin(req)
    const { searchParams } = new URL(req.url)

    const q = searchParams.get('q') ?? ''
    const plan = searchParams.get('plan')
    const status = searchParams.get('status')
    const page = Number(searchParams.get('page') ?? 1)
    const limit = 25

    const where = {
        AND: [
            q
                ? {
                    OR: [
                        { name: { contains: q, mode: 'insensitive' as const } },
                        { email: { contains: q, mode: 'insensitive' as const } },
                        { slug: { contains: q, mode: 'insensitive' as const } },
                    ],
                }
                : {},
            plan ? { subscription: { plan: { slug: plan } } } : {},
            status ? { subscription: { status: status as 'ACTIVE' | 'SUSPENDED' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED' } } : {},
        ],
    }

    const [tenants, total] = await Promise.all([
        prisma.tenant.findMany({
            where,
            include: {
                subscription: { include: { plan: { select: { name: true, slug: true } } } },
                diCredentials: { select: { environment: true, isProductionReady: true, lastVerifiedAt: true } },
                _count: { select: { invoices: true, users: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.tenant.count({ where }),
    ])

    return NextResponse.json({ data: tenants, total, page, pages: Math.ceil(total / limit) })
}
