import { NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { getDIClientForTenant } from '@/lib/di/client'
import { getQueueStatsForTenant } from '@/lib/fbr/queue'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
    const { tenant } = await getTenantFromSession()

    try {
        const creds = await prisma.dICredentials.findUnique({
            where: { tenantId: tenant.id },
        })

        if (!creds) {
            return NextResponse.json({
                diOnline: false,
                configured: false,
                circuit: { state: 'NOT_CONFIGURED' },
                queue: { waiting: 0, active: 0, failed: 0 },
            })
        }

        const hasToken = creds.environment === 'SANDBOX'
            ? !!creds.encryptedSandboxToken
            : !!creds.encryptedProductionToken

        if (!hasToken) {
            return NextResponse.json({
                diOnline: false,
                configured: true,
                tokenMissing: true,
                environment: creds.environment,
                circuit: { state: 'NO_TOKEN' },
                queue: { waiting: 0, active: 0, failed: 0 },
            })
        }

        const diClient = await getDIClientForTenant(tenant.id)
        const [circuitState, queueStats] = await Promise.all([
            Promise.resolve(diClient.getCircuitState()),
            getQueueStatsForTenant(tenant.id),
        ])

        return NextResponse.json({
            diOnline: circuitState.state !== 'OPEN',
            configured: true,
            environment: creds.environment,
            isProductionReady: creds.isProductionReady,
            sandboxCompleted: creds.sandboxCompleted,
            circuit: circuitState,
            queue: queueStats,
        })
    } catch {
        return NextResponse.json({
            diOnline: false,
            circuit: { state: 'UNKNOWN' },
            queue: { waiting: 0, active: 0, failed: 0 },
        })
    }
}
