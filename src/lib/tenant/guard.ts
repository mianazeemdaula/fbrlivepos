import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from './context'

export async function withTenantGuard(
    req: NextRequest,
    handler: (params: { tenantId: string; userId: string; role: string }) => Promise<NextResponse>,
) {
    try {
        const { tenant, userId, role } = await getTenantFromSession()
        return handler({ tenantId: tenant.id, userId, role })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        if (message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
}
