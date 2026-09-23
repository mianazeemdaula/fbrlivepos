import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/admin/audit'
import { applyPaidPeriod } from '@/lib/billing/subscription'

const UpdateRecordSchema = z.object({
    status: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'WAIVED']),
    paymentMethod: z.string().trim().min(1).optional(),
    paymentRef: z.string().trim().optional(),
})

// PATCH — change a billing record's status (e.g. mark a pending record as paid)
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ recordId: string }> },
) {
    const { actor } = await assertSuperAdmin(req)
    const { recordId } = await params

    const parsed = UpdateRecordSchema.safeParse(await req.json())
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
    }
    const body = parsed.data

    const before = await prisma.billingRecord.findUnique({ where: { id: recordId } })
    if (!before) return NextResponse.json({ error: 'Billing record not found' }, { status: 404 })

    const becamePaid = body.status === 'PAID' && before.status !== 'PAID'

    const record = await prisma.$transaction(async (tx) => {
        const updated = await tx.billingRecord.update({
            where: { id: recordId },
            data: {
                status: body.status,
                paidAt: body.status === 'PAID' ? (before.paidAt ?? new Date()) : before.paidAt,
                paymentMethod: body.paymentMethod ?? before.paymentMethod,
                paymentRef: body.paymentRef ?? before.paymentRef,
            },
        })

        // A newly paid record extends the subscription to cover its period
        if (becamePaid) {
            const sub = await tx.tenantSubscription.findUniqueOrThrow({ where: { id: before.subscriptionId } })
            await applyPaidPeriod(tx, sub, before.periodStart, before.periodEnd)
        }

        return updated
    })

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'SUPER_ADMIN',
        tenantId: record.tenantId,
        action: 'BILLING_RECORD_UPDATED',
        entity: 'BillingRecord',
        entityId: record.id,
        before: before as unknown as object,
        after: record as unknown as object,
    })

    return NextResponse.json({ ...record, amount: Number(record.amount) })
}
