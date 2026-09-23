import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { hash } from '@/lib/crypto/password'
import { addBillingCycle } from '@/lib/billing/subscription'

const SignupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2),
    businessName: z.string().min(2),
    phone: z.string().optional(),
})

export async function POST(req: NextRequest) {
    const body = SignupSchema.parse(await req.json())

    // Check for existing tenant
    const existing = await prisma.tenant.findFirst({
        where: { OR: [{ email: body.email }] },
    })

    if (existing) {
        return NextResponse.json(
            { error: 'An account with this email already exists' },
            { status: 409 },
        )
    }

    // Create slug from business name
    const slug = body.businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

    // Check slug uniqueness, append random suffix if needed
    const slugExists = await prisma.tenant.findUnique({ where: { slug } })
    const finalSlug = slugExists ? `${slug}-${Date.now().toString(36)}` : slug

    const hashedPassword = await hash(body.password)

    // Create tenant + admin user + free subscription in a transaction
    const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
            data: {
                name: body.businessName,
                slug: finalSlug,
                email: body.email,
                phone: body.phone,
            },
        })

        const user = await tx.user.create({
            data: {
                tenantId: tenant.id,
                name: body.name,
                email: body.email,
                password: hashedPassword,
                role: 'TENANT_ADMIN',
            },
        })

        // Assign the free plan (slug "free", or any active zero-priced plan) if one exists
        const freePlan = await tx.subscriptionPlan.findFirst({
            where: {
                isActive: true,
                OR: [{ slug: 'free' }, { priceMonthly: 0 }],
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        })

        if (freePlan) {
            const now = new Date()
            const trialEndsAt = freePlan.trialDays > 0
                ? new Date(now.getTime() + freePlan.trialDays * 86400000)
                : null

            await tx.tenantSubscription.create({
                data: {
                    tenantId: tenant.id,
                    planId: freePlan.id,
                    status: trialEndsAt ? 'TRIALING' : 'ACTIVE',
                    billingCycle: 'MONTHLY',
                    currentPeriodStart: now,
                    currentPeriodEnd: trialEndsAt ?? addBillingCycle(now, 'MONTHLY'),
                    trialEndsAt,
                },
            })
        }

        return { tenant, user }
    })

    return NextResponse.json(
        {
            success: true,
            tenantId: result.tenant.id,
            slug: result.tenant.slug,
        },
        { status: 201 },
    )
}
