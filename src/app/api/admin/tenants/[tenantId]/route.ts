import { NextRequest, NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ tenantId: string }> },
) {
    await assertSuperAdmin(req)
    const { tenantId } = await params

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
            subscription: { include: { plan: true, billingHistory: { orderBy: { createdAt: 'desc' }, take: 10 } } },
            diCredentials: {
                select: {
                    environment: true,
                    isProductionReady: true,
                    lastVerifiedAt: true,
                    sellerNTN: true,
                    sellerBusinessName: true,
                    irisRegistrationStatus: true,
                },
            },
            _count: {
                select: { invoices: true, users: true, products: true, posTerminals: true },
            },
        },
    })

    if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    return NextResponse.json({
        tenant: {
            id: tenant.id,
            businessName: tenant.name,
            email: tenant.email,
            phone: tenant.phone,
            ntn: tenant.diCredentials?.sellerNTN ?? null,
            address: tenant.address,
            isActive: tenant.isActive,
            diConfigured: tenant.diCredentials !== null,
            createdAt: tenant.createdAt.toISOString(),
            subscription: tenant.subscription
                ? {
                    plan: tenant.subscription.plan
                        ? {
                            id: tenant.subscription.plan.id,
                            name: tenant.subscription.plan.name,
                        }
                        : undefined,
                    status: tenant.subscription.status,
                    currentPeriodEnd: tenant.subscription.currentPeriodEnd?.toISOString() ?? null,
                }
                : undefined,
            _count: {
                invoices: tenant._count.invoices,
                users: tenant._count.users,
                products: tenant._count.products,
            },
        },
    })
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ tenantId: string }> },
) {
    const { actor } = await assertSuperAdmin(req)
    const { tenantId } = await params
    const body = await req.json()

    const updated = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
            name: body.name,
            isActive: body.isActive,
        },
    })

    return NextResponse.json(updated)
}
