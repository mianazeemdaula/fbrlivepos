import { NextRequest, NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
    await assertSuperAdmin(req)

    const tenants = await prisma.tenant.findMany({
        include: {
            diCredentials: {
                select: {
                    environment: true,
                    irisRegistrationStatus: true,
                    sandboxCompleted: true,
                    isProductionReady: true,
                    tokenExpiresAt: true,
                    sellerNTN: true,
                },
            },
            _count: { select: { invoices: true } },
        },
    })

    const summary = {
        notConfigured: tenants.filter((t) => !t.diCredentials).length,
        sandbox: tenants.filter((t) => t.diCredentials?.environment === 'SANDBOX').length,
        production: tenants.filter((t) => t.diCredentials?.environment === 'PRODUCTION').length,
        tokensExpiringSoon: tenants.filter((t) => {
            const exp = t.diCredentials?.tokenExpiresAt
            if (!exp) return false
            return exp.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000 // 30 days
        }).length,
    }

    return NextResponse.json({ tenants, summary })
}
