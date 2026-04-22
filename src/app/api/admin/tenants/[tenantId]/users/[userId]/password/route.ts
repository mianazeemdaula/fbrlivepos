import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { writeAuditLog } from '@/lib/admin/audit'
import { prisma } from '@/lib/db/prisma'
import { hash } from '@/lib/crypto/password'

const changePasswordSchema = z.object({
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
})

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ tenantId: string; userId: string }> },
) {
    const { actor } = await assertSuperAdmin(req)
    const { tenantId, userId } = await params

    const parsed = changePasswordSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
        where: {
            id: userId,
            tenantId,
        },
        select: {
            id: true,
            email: true,
            role: true,
        },
    })

    if (!user) {
        return NextResponse.json({ error: 'User not found for this tenant' }, { status: 404 })
    }

    const hashedPassword = await hash(parsed.data.password)

    await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
    })

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'SUPER_ADMIN',
        tenantId,
        action: 'USER_PASSWORD_CHANGED_BY_ADMIN',
        entity: 'USER',
        entityId: user.id,
        after: {
            targetEmail: user.email,
            targetRole: user.role,
        },
    })

    return NextResponse.json({ success: true })
}
