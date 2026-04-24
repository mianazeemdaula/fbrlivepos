import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
    await getTenantFromSession()

    const scenarios = await prisma.dIScenario.findMany({
        select: { saleType: true },
        distinct: ['saleType'],
        orderBy: { saleType: 'asc' },
    })

    const saleTypes = scenarios.map((s) => s.saleType).filter(Boolean)

    return NextResponse.json({ data: saleTypes })
}
