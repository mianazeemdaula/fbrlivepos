import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/admin/audit'
import { isFeatureEnabled } from '@/lib/features/flags'
import { LEDGER_IMPORT_FLAG, LEDGER_IMPORT_FLAG_DESCRIPTION } from '@/lib/ledger/service'

// Per-tenant features a super admin switches on individually (stored as TenantFeatureFlag overrides).
const MANAGED_FEATURES = [
    { key: LEDGER_IMPORT_FLAG, label: 'Sales Ledger Import', description: LEDGER_IMPORT_FLAG_DESCRIPTION },
]

type Params = { params: Promise<{ tenantId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
    await assertSuperAdmin(req)
    const { tenantId } = await params

    const features = await Promise.all(MANAGED_FEATURES.map(async (feature) => ({
        ...feature,
        enabled: await isFeatureEnabled(tenantId, feature.key),
    })))
    return NextResponse.json({ features })
}

const PatchSchema = z.object({
    key: z.enum(MANAGED_FEATURES.map((feature) => feature.key) as [string, ...string[]]),
    enabled: z.boolean(),
})

export async function PATCH(req: NextRequest, { params }: Params) {
    const { actor } = await assertSuperAdmin(req)
    const { tenantId } = await params

    const parsed = PatchSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Unknown feature' }, { status: 400 })
    const { key, enabled } = parsed.data

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const feature = MANAGED_FEATURES.find((f) => f.key === key)!
    // The flag stays off globally; only tenants with an override get the feature.
    const flag = await prisma.featureFlag.upsert({
        where: { key },
        create: { key, description: feature.description, isGlobal: false, isActive: false },
        update: {},
    })
    await prisma.tenantFeatureFlag.upsert({
        where: { flagId_tenantId: { flagId: flag.id, tenantId } },
        create: { flagId: flag.id, tenantId, enabled },
        update: { enabled },
    })

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email ?? '',
        actorRole: 'SUPER_ADMIN',
        tenantId,
        action: 'TENANT_FEATURE_UPDATED',
        entity: 'TenantFeatureFlag',
        entityId: flag.id,
        after: { key, enabled },
    })

    return NextResponse.json({ key, enabled })
}
