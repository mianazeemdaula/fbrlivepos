import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
    await getTenantFromSession()

    const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
    const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 100)))

    const schedules = await prisma.dISROSchedule.findMany({
        where: q
            ? {
                OR: [
                    { description: { contains: q, mode: 'insensitive' } },
                    { id: Number.isNaN(Number(q)) ? undefined : Number(q) },
                ],
            }
            : undefined,
        orderBy: [{ description: 'asc' }, { id: 'asc' }],
        take: limit,
        select: {
            id: true,
            description: true,
        },
    })

    return NextResponse.json({
        data: schedules,
    })
}