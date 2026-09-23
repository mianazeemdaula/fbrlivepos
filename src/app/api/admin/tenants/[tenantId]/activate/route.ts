import { NextRequest, NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/admin/audit'
import { expireOverdueSubscriptions } from '@/lib/billing/subscription'

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ tenantId: string }> },
) {
    const { actor } = await assertSuperAdmin(req)
    const { tenantId } = await params

    await prisma.$transaction([
        prisma.tenant.update({
            where: { id: tenantId },
            data: { isActive: true },
        }),
        prisma.tenantSubscription.updateMany({
            where: { tenantId, status: 'SUSPENDED' },
            data: { status: 'ACTIVE' },
        }),
    ])

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'SUPER_ADMIN',
        tenantId,
        action: 'TENANT_ACTIVATED',
    })

    // A reactivated subscription whose period already ended drops straight back to PAST_DUE
    await expireOverdueSubscriptions(tenantId)

    return NextResponse.json({ success: true })
}
