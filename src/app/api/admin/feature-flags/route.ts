import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/admin/audit'

function serializeFlag(flag: {
    id: string
    key: string
    description: string
    isActive: boolean
    tenantOverrides: Array<{
        tenantId: string
        enabled: boolean
        tenant: { name: string }
    }>
}) {
    return {
        id: flag.id,
        key: flag.key,
        description: flag.description || null,
        isEnabled: flag.isActive,
        tenantOverrides: flag.tenantOverrides.map((override) => ({
            tenantId: override.tenantId,
            isEnabled: override.enabled,
            tenant: { businessName: override.tenant.name },
        })),
    }
}

export async function GET(req: NextRequest) {
    await assertSuperAdmin(req)

    const flags = await prisma.featureFlag.findMany({
        include: {
            tenantOverrides: { include: { tenant: { select: { name: true } } } },
        },
        orderBy: { key: 'asc' },
    })

    return NextResponse.json({ flags: flags.map(serializeFlag) })
}

export async function POST(req: NextRequest) {
    const { actor } = await assertSuperAdmin(req)

    const body = z
        .object({
            key: z.string().regex(/^[a-z0-9_]+$/),
            description: z.string().nullish(),
            isGlobal: z.boolean().default(false),
            isEnabled: z.boolean().optional(),
            isActive: z.boolean().default(false),
        })
        .parse(await req.json())

    const flag = await prisma.featureFlag.create({
        data: {
            key: body.key,
            description: body.description ?? '',
            isGlobal: body.isGlobal,
            isActive: body.isEnabled ?? body.isActive,
        },
        include: {
            tenantOverrides: { include: { tenant: { select: { name: true } } } },
        },
    })

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'SUPER_ADMIN',
        action: 'FEATURE_FLAG_CREATED',
        entity: 'FeatureFlag',
        entityId: flag.id,
        after: flag as unknown as object,
    })

    return NextResponse.json({ flag: serializeFlag(flag) }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
    const { actor } = await assertSuperAdmin(req)

    const body = z
        .object({
            flagId: z.string(),
            isGlobal: z.boolean().optional(),
            isEnabled: z.boolean().optional(),
            isActive: z.boolean().optional(),
            // Tenant-specific override
            tenantId: z.string().optional(),
            enabled: z.boolean().optional(),
        })
        .parse(await req.json())

    if (body.tenantId !== undefined && body.enabled !== undefined) {
        // Upsert tenant override
        await prisma.tenantFeatureFlag.upsert({
            where: {
                flagId_tenantId: { flagId: body.flagId, tenantId: body.tenantId },
            },
            create: {
                flagId: body.flagId,
                tenantId: body.tenantId,
                enabled: body.enabled,
            },
            update: { enabled: body.enabled },
        })
    } else {
        await prisma.featureFlag.update({
            where: { id: body.flagId },
            data: {
                isGlobal: body.isGlobal,
                isActive: body.isEnabled ?? body.isActive,
            },
        })
    }

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'SUPER_ADMIN',
        action: 'FEATURE_FLAG_UPDATED',
        entity: 'FeatureFlag',
        entityId: body.flagId,
        after: body as unknown as object,
    })

    return NextResponse.json({ success: true })
}
