import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

export async function getTenantFromSession() {
    const session = await auth()
    if (!session?.user?.tenantId) {
        throw new Error('UNAUTHORIZED')
    }

    const tenant = await prisma.tenant.findUniqueOrThrow({
        where: { id: session.user.tenantId, isActive: true },
    })

    return {
        tenant,
        userId: session.user.id,
        role: session.user.role,
    }
}

export function assertTenantOwnership(
    resourceTenantId: string,
    sessionTenantId: string,
) {
    if (resourceTenantId !== sessionTenantId) {
        throw new Error('FORBIDDEN: Cross-tenant access denied')
    }
}
