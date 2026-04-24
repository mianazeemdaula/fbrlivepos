import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
    await getTenantFromSession()

    const { searchParams } = new URL(req.url)
    const activity = searchParams.get('activity') ?? ''
    const sector = searchParams.get('sector') ?? ''

    const where = {
        ...(activity ? { businessActivity: activity } : {}),
        ...(sector ? { sector } : {}),
    }

    const rows = await prisma.dIBusinessScenario.findMany({
        where,
        include: { scenario: true },
        orderBy: { scenarioId: 'asc' },
    })

    const scenarios = rows.map(r => ({
        scenarioId: r.scenarioId,
        description: r.scenario.description,
        saleType: r.scenario.saleType,
        notes: r.scenario.notes,
    }))

    return NextResponse.json({ scenarios })
}
