import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/admin/audit'
import { digitsOnly, isValidSellerNtn, normalizeSellerNtn } from '@/lib/validation/pakistan'

function formatTenantPayload(tenant: any) {
    return {
        id: tenant.id,
        businessName: tenant.name,
        name: tenant.name,
        slug: tenant.slug,
        email: tenant.email,
        phone: tenant.phone,
        ntn: tenant.diCredentials?.sellerNTN ?? null,
        address: tenant.address,
        logoUrl: tenant.logoUrl ?? null,
        preferredIdType: tenant.preferredIdType ?? 'NTN',
        isActive: tenant.isActive,
        diConfigured: tenant.diCredentials !== null,
        diCredentials: tenant.diCredentials
            ? {
                sellerNTN: tenant.diCredentials.sellerNTN,
                sellerCNIC: tenant.diCredentials.sellerCNIC,
                sellerBusinessName: tenant.diCredentials.sellerBusinessName,
                sellerProvince: tenant.diCredentials.sellerProvince,
                sellerAddress: tenant.diCredentials.sellerAddress,
                businessActivity: tenant.diCredentials.businessActivity,
                sector: tenant.diCredentials.sector,
                environment: tenant.diCredentials.environment,
                isProductionReady: tenant.diCredentials.isProductionReady,
                irisRegistrationStatus: tenant.diCredentials.irisRegistrationStatus,
                lastVerifiedAt: tenant.diCredentials.lastVerifiedAt instanceof Date
                    ? tenant.diCredentials.lastVerifiedAt.toISOString()
                    : tenant.diCredentials.lastVerifiedAt ?? null,
            }
            : null,
        createdAt: tenant.createdAt instanceof Date ? tenant.createdAt.toISOString() : tenant.createdAt,
        subscription: tenant.subscription
            ? {
                plan: tenant.subscription.plan
                    ? {
                        id: tenant.subscription.plan.id,
                        name: tenant.subscription.plan.name,
                    }
                    : undefined,
                status: tenant.subscription.status,
                currentPeriodEnd: tenant.subscription.currentPeriodEnd instanceof Date
                    ? tenant.subscription.currentPeriodEnd.toISOString()
                    : tenant.subscription.currentPeriodEnd ?? null,
            }
            : undefined,
        users: (tenant.users || []).map((user: any) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
        })),
        _count: {
            invoices: tenant._count?.invoices ?? 0,
            users: tenant._count?.users ?? 0,
            products: tenant._count?.products ?? 0,
            posTerminals: tenant._count?.posTerminals ?? 0,
        },
    }
}

const UpdateTenantSchema = z.object({
    name: z.string().trim().min(2, 'Business name must be at least 2 characters').optional(),
    slug: z
        .string()
        .trim()
        .min(2, 'Slug must be at least 2 characters')
        .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens')
        .optional(),
    email: z.string().trim().email('Invalid email address').optional(),
    phone: z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), z.string().trim().nullable().optional()),
    address: z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), z.string().trim().nullable().optional()),
    logoUrl: z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), z.string().trim().url('Invalid logo URL').nullable().optional()),
    preferredIdType: z.preprocess((val) => (val === '' ? null : val), z.enum(['NTN', 'CNIC']).nullable().optional()),
    isActive: z.boolean().optional(),

    // Tax / FBR DI credentials
    sellerNTN: z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), z.string().trim().nullable().optional()),
    sellerCNIC: z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), z.string().trim().nullable().optional()),
    sellerBusinessName: z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), z.string().trim().nullable().optional()),
    sellerProvince: z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), z.string().trim().nullable().optional()),
    sellerAddress: z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), z.string().trim().nullable().optional()),
    businessActivity: z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), z.string().trim().nullable().optional()),
    sector: z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), z.string().trim().nullable().optional()),
    environment: z.enum(['SANDBOX', 'PRODUCTION']).optional(),
    isProductionReady: z.boolean().optional(),
})

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ tenantId: string }> },
) {
    await assertSuperAdmin(req)
    const { tenantId } = await params

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
            users: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    isActive: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'asc' },
            },
            subscription: { include: { plan: true, billingHistory: { orderBy: { createdAt: 'desc' }, take: 10 } } },
            diCredentials: {
                select: {
                    environment: true,
                    isProductionReady: true,
                    lastVerifiedAt: true,
                    sellerNTN: true,
                    sellerCNIC: true,
                    sellerBusinessName: true,
                    sellerProvince: true,
                    sellerAddress: true,
                    businessActivity: true,
                    sector: true,
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
        tenant: formatTenantPayload(tenant),
    })
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ tenantId: string }> },
) {
    const { actor } = await assertSuperAdmin(req)
    const { tenantId } = await params

    const rawBody = await req.json().catch(() => null)
    if (!rawBody || typeof rawBody !== 'object') {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const parseResult = UpdateTenantSchema.safeParse(rawBody)
    if (!parseResult.success) {
        const firstError = parseResult.error.issues[0]?.message || 'Validation error'
        return NextResponse.json({ error: firstError, issues: parseResult.error.issues }, { status: 400 })
    }

    const body = parseResult.data

    const existing = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { diCredentials: true },
    })

    if (!existing) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Slug conflict check
    if (body.slug && body.slug !== existing.slug) {
        const slugConflict = await prisma.tenant.findFirst({
            where: {
                slug: body.slug,
                id: { not: tenantId },
            },
        })
        if (slugConflict) {
            return NextResponse.json({ error: 'A tenant with this slug already exists' }, { status: 409 })
        }
    }

    // Email conflict check
    if (body.email && body.email.toLowerCase() !== existing.email.toLowerCase()) {
        const emailConflict = await prisma.tenant.findFirst({
            where: {
                email: { equals: body.email, mode: 'insensitive' },
                id: { not: tenantId },
            },
        })
        if (emailConflict) {
            return NextResponse.json({ error: 'A tenant with this email already exists' }, { status: 409 })
        }
    }

    // Seller NTN validation
    if (body.sellerNTN) {
        const normalizedNTN = normalizeSellerNtn(body.sellerNTN)
        if (!isValidSellerNtn(normalizedNTN)) {
            return NextResponse.json({ error: 'Seller NTN must be 7, 8, or 9 digits' }, { status: 400 })
        }
    }

    // Seller CNIC validation
    if (body.sellerCNIC) {
        const normalizedCNIC = digitsOnly(body.sellerCNIC)
        if (normalizedCNIC.length !== 13) {
            return NextResponse.json({ error: 'Seller CNIC must be 13 digits' }, { status: 400 })
        }
    }

    await prisma.$transaction(async (tx) => {
        const tenantUpdateData: Record<string, any> = {}
        if (body.name !== undefined) tenantUpdateData.name = body.name
        if (body.slug !== undefined) tenantUpdateData.slug = body.slug
        if (body.email !== undefined) tenantUpdateData.email = body.email.toLowerCase()
        if (body.phone !== undefined) tenantUpdateData.phone = body.phone
        if (body.address !== undefined) tenantUpdateData.address = body.address
        if (body.logoUrl !== undefined) tenantUpdateData.logoUrl = body.logoUrl
        if (body.preferredIdType !== undefined) tenantUpdateData.preferredIdType = body.preferredIdType
        if (body.isActive !== undefined) tenantUpdateData.isActive = body.isActive

        if (Object.keys(tenantUpdateData).length > 0) {
            await tx.tenant.update({
                where: { id: tenantId },
                data: tenantUpdateData,
            })
        }

        // Keep subscription status in sync if isActive changed
        if (body.isActive !== undefined && body.isActive !== existing.isActive) {
            if (!body.isActive) {
                await tx.tenantSubscription.updateMany({
                    where: { tenantId, status: { in: ['ACTIVE', 'TRIALING'] } },
                    data: { status: 'SUSPENDED' },
                })
            } else {
                await tx.tenantSubscription.updateMany({
                    where: { tenantId, status: 'SUSPENDED' },
                    data: { status: 'ACTIVE' },
                })
            }
        }

        const diFieldsProvided = [
            body.sellerNTN,
            body.sellerCNIC,
            body.sellerBusinessName,
            body.sellerProvince,
            body.sellerAddress,
            body.businessActivity,
            body.sector,
            body.environment,
            body.isProductionReady,
        ].some((v) => v !== undefined)

        if (diFieldsProvided) {
            if (existing.diCredentials) {
                const diUpdateData: Record<string, any> = {}
                if (body.sellerNTN !== undefined) diUpdateData.sellerNTN = normalizeSellerNtn(body.sellerNTN)
                if (body.sellerCNIC !== undefined) diUpdateData.sellerCNIC = body.sellerCNIC ? digitsOnly(body.sellerCNIC) : null
                if (body.sellerBusinessName !== undefined) diUpdateData.sellerBusinessName = body.sellerBusinessName || body.name || existing.name
                if (body.sellerProvince !== undefined) diUpdateData.sellerProvince = body.sellerProvince || existing.diCredentials.sellerProvince
                if (body.sellerAddress !== undefined) diUpdateData.sellerAddress = body.sellerAddress || body.address || existing.address || ''
                if (body.businessActivity !== undefined) diUpdateData.businessActivity = body.businessActivity || existing.diCredentials.businessActivity
                if (body.sector !== undefined) diUpdateData.sector = body.sector || existing.diCredentials.sector
                if (body.environment !== undefined) diUpdateData.environment = body.environment
                if (body.isProductionReady !== undefined) diUpdateData.isProductionReady = body.isProductionReady

                await tx.dICredentials.update({
                    where: { tenantId },
                    data: diUpdateData,
                })
            } else if (body.sellerNTN || body.sellerBusinessName || body.sellerProvince) {
                await tx.dICredentials.create({
                    data: {
                        tenantId,
                        sellerNTN: normalizeSellerNtn(body.sellerNTN) || '0000000',
                        sellerCNIC: body.sellerCNIC ? digitsOnly(body.sellerCNIC) : null,
                        sellerBusinessName: body.sellerBusinessName || body.name || existing.name,
                        sellerProvince: body.sellerProvince || 'PUNJAB',
                        sellerAddress: body.sellerAddress || body.address || existing.address || '',
                        businessActivity: body.businessActivity || 'Other',
                        sector: body.sector || 'All Other Sectors',
                        environment: body.environment || 'SANDBOX',
                        isProductionReady: body.isProductionReady ?? false,
                    },
                })
            }
        }
    })

    const refreshed = await prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        include: {
            users: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    isActive: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'asc' },
            },
            subscription: { include: { plan: true, billingHistory: { orderBy: { createdAt: 'desc' }, take: 10 } } },
            diCredentials: {
                select: {
                    environment: true,
                    isProductionReady: true,
                    lastVerifiedAt: true,
                    sellerNTN: true,
                    sellerCNIC: true,
                    sellerBusinessName: true,
                    sellerProvince: true,
                    sellerAddress: true,
                    businessActivity: true,
                    sector: true,
                    irisRegistrationStatus: true,
                },
            },
            _count: {
                select: { invoices: true, users: true, products: true, posTerminals: true },
            },
        },
    })

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email ?? '',
        actorRole: 'SUPER_ADMIN',
        tenantId,
        action: 'TENANT_UPDATED',
        entity: 'Tenant',
        entityId: tenantId,
        before: {
            name: existing.name,
            slug: existing.slug,
            email: existing.email,
            phone: existing.phone,
            address: existing.address,
            preferredIdType: existing.preferredIdType,
            isActive: existing.isActive,
            diCredentials: existing.diCredentials ? {
                sellerNTN: existing.diCredentials.sellerNTN,
                sellerCNIC: existing.diCredentials.sellerCNIC,
                sellerBusinessName: existing.diCredentials.sellerBusinessName,
                sellerProvince: existing.diCredentials.sellerProvince,
                sellerAddress: existing.diCredentials.sellerAddress,
                businessActivity: existing.diCredentials.businessActivity,
                sector: existing.diCredentials.sector,
                environment: existing.diCredentials.environment,
                isProductionReady: existing.diCredentials.isProductionReady,
            } : null,
        },
        after: body,
    })

    const formatted = formatTenantPayload(refreshed)
    return NextResponse.json({
        success: true,
        ...formatted,
        tenant: formatted,
    })
}
