import { auth } from '@/lib/auth'
import { NextRequest } from 'next/server'
import { writeAuditLog } from './audit'

export async function assertSuperAdmin(req: NextRequest) {
    const session = await auth()

    if (!session?.user) {
        throw new Response('Unauthorized', { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
        await writeAuditLog({
            actorId: session.user.id,
            actorEmail: session.user.email ?? '',
            actorRole: session.user.role,
            action: 'UNAUTHORIZED_ADMIN_ACCESS',
            after: { path: req.nextUrl.pathname },
        })
        throw new Response('Forbidden', { status: 403 })
    }

    return { actor: session.user }
}
