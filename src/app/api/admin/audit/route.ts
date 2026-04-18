import { NextRequest, NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
    await assertSuperAdmin(req)
    const { searchParams } = new URL(req.url)

    const page = Number(searchParams.get('page') ?? 1)
    const limit = Number(searchParams.get('limit') ?? 50)
    const action = searchParams.get('action')
    const tenantId = searchParams.get('tenantId')
    const actorId = searchParams.get('actorId')

    const where = {
        ...(action ? { action } : {}),
        ...(tenantId ? { tenantId } : {}),
        ...(actorId ? { actorId } : {}),
    }

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.auditLog.count({ where }),
    ])

    return NextResponse.json({
        data: logs,
        total,
        page,
        pages: Math.ceil(total / limit),
    })
}
