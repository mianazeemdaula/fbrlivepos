import { NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { DICircuitBreakerRegistry } from '@/lib/di/circuit-breaker'

export async function POST() {
    const { tenant } = await getTenantFromSession()

    DICircuitBreakerRegistry.getInstance().reset(tenant.id)

    return NextResponse.json({ success: true, message: 'DI circuit breaker reset to CLOSED state.' })
}
