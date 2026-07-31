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

    const hsCode = await prisma.hSCode.findUnique({
        where: { id: hsCodeId },
    })

    if (!hsCode) {
        return NextResponse.json({ error: 'HS Code not found' }, { status: 404 })
    }

    return NextResponse.json(hsCode)
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ hsCodeId: string }> },
) {
    const { actor } = await assertSuperAdmin(req)
    const { hsCodeId } = await params

    let rawBody: unknown
    try {
        rawBody = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parseResult = HSCodeSchema.partial().safeParse(rawBody)
    if (!parseResult.success) {
        const issue = parseResult.error.issues[0]
        return NextResponse.json({ error: `${issue.path.join('.')}: ${issue.message}` }, { status: 422 })
    }

    const data = parseResult.data

    const before = await prisma.hSCode.findUnique({
        where: { id: hsCodeId },
    })

    if (!before) {
        return NextResponse.json({ error: 'HS Code not found' }, { status: 404 })
    }

    // If code is changing, check uniqueness
    if (data.code && data.code !== before.code) {
        const existing = await prisma.hSCode.findUnique({
            where: { code: data.code },
        })
        if (existing) {
            return NextResponse.json({ error: `HS Code "${data.code}" already exists.` }, { status: 400 })
        }
    }

    const updateData: Record<string, unknown> = { ...data }
    if ('effectiveFrom' in data) {
        updateData.effectiveFrom = data.effectiveFrom ? new Date(data.effectiveFrom) : null
    }
    if ('effectiveTo' in data) {
        updateData.effectiveTo = data.effectiveTo ? new Date(data.effectiveTo) : null
    }

    const updated = await prisma.hSCode.update({
        where: { id: hsCodeId },
        data: updateData,
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

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ hsCodeId: string }> },
) {
    const { actor } = await assertSuperAdmin(req)
    const { hsCodeId } = await params

    const hsCode = await prisma.hSCode.findUnique({
        where: { id: hsCodeId },
    })

    if (!hsCode) {
        return NextResponse.json({ error: 'HS Code not found' }, { status: 404 })
    }

    // Check if linked to products
    const linkedProductsCount = await prisma.productHSCode.count({
        where: { hsCodeId },
    })

    if (linkedProductsCount > 0) {
        return NextResponse.json(
            {
                error: `Cannot delete HS Code "${hsCode.code}" because it is currently linked to ${linkedProductsCount} tenant product(s). Deactivate it instead.`,
            },
            { status: 400 },
        )
    }

    await prisma.hSCode.delete({
        where: { id: hsCodeId },
    })

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'SUPER_ADMIN',
        action: 'HSCODE_DELETED',
        entity: 'HSCode',
        entityId: hsCodeId,
        before: hsCode as unknown as object,
    })

    return NextResponse.json({ success: true, message: 'HS Code deleted successfully' })
}

