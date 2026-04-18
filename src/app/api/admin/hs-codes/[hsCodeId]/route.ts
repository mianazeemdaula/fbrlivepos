import { NextRequest, NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { HSCodeSchema } from '@/lib/admin/hscode.schema'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/admin/audit'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ hsCodeId: string }> },
) {
    await assertSuperAdmin(req)
    const { hsCodeId } = await params

    const hsCode = await prisma.hSCode.findUniqueOrThrow({
        where: { id: hsCodeId },
    })

    return NextResponse.json(hsCode)
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ hsCodeId: string }> },
) {
    const { actor } = await assertSuperAdmin(req)
    const { hsCodeId } = await params
    const body = HSCodeSchema.partial().parse(await req.json())

    const before = await prisma.hSCode.findUniqueOrThrow({
        where: { id: hsCodeId },
    })

    const updated = await prisma.hSCode.update({
        where: { id: hsCodeId },
        data: body,
    })

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'SUPER_ADMIN',
        action: 'HSCODE_UPDATED',
        entity: 'HSCode',
        entityId: hsCodeId,
        before: before as unknown as object,
        after: updated as unknown as object,
    })

    return NextResponse.json(updated)
}
