import { NextRequest, NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'
import { SignJWT } from 'jose'
import { writeAuditLog } from '@/lib/admin/audit'

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ tenantId: string }> },
) {
    const { actor } = await assertSuperAdmin(req)
    const { tenantId } = await params

    const tenant = await prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        include: { users: { where: { role: 'TENANT_ADMIN' }, take: 1 } },
    })

    const tenantAdmin = tenant.users[0]
    if (!tenantAdmin) {
        return NextResponse.json({ error: 'No admin user found for this tenant' }, { status: 404 })
    }

    const secret = process.env.IMPERSONATION_TOKEN_SECRET ?? process.env.NEXTAUTH_SECRET
    if (!secret) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const token = await new SignJWT({
        sub: tenantAdmin.id,
        tenantId: tenant.id,
        impersonatedBy: actor.id,
        isImpersonation: true,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('15m')
        .sign(new TextEncoder().encode(secret))

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'SUPER_ADMIN',
        tenantId,
        action: 'IMPERSONATION_START',
        after: { targetUserId: tenantAdmin.id },
    })

    return NextResponse.json({
        redirectUrl: `/auth/impersonate?token=${token}`,
        expiresIn: '15 minutes',
    })
}
