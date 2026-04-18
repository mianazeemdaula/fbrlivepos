import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/admin/audit'

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ tenantId: string }> },
) {
    const { actor } = await assertSuperAdmin(req)
    const { tenantId } = await params
    const { reason } = z
        .object({ reason: z.string().min(5).optional() })
        .parse(await req.json().catch(() => ({})))

    await prisma.$transaction([
        prisma.tenant.update({
            where: { id: tenantId },
            data: { isActive: false },
        }),
        prisma.tenantSubscription.update({
            where: { tenantId },
            data: { status: 'SUSPENDED' },
        }),
    ])

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'SUPER_ADMIN',
        tenantId,
        action: 'TENANT_SUSPENDED',
        after: { reason: reason ?? 'Suspended by super admin' },
    })

    return NextResponse.json({ success: true })
}
