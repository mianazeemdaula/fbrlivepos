import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'

const UpdateProfileSchema = z.object({
    preferredIdType: z.enum(['NTN', 'CNIC']).optional(),
})

export async function GET() {
    const { tenant } = await getTenantFromSession()
    return NextResponse.json({
        preferredIdType: tenant.preferredIdType ?? 'NTN',
    })
}

export async function PATCH(req: NextRequest) {
    const { tenant } = await getTenantFromSession()
    const body = UpdateProfileSchema.parse(await req.json())

    const updated = await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
            ...(body.preferredIdType !== undefined ? { preferredIdType: body.preferredIdType } : {}),
        },
        select: { preferredIdType: true },
    })

    return NextResponse.json({ preferredIdType: updated.preferredIdType ?? 'NTN' })
}
