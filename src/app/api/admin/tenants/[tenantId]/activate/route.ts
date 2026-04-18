import { NextRequest, NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/admin/audit'

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
        prisma.tenantSubscription.update({
            where: { tenantId },
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

    return NextResponse.json({ success: true })
}
