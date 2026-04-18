import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'
import { decryptCredential } from '@/lib/crypto/credentials'
import { verifyBuyer } from '@/lib/di/buyer-validation'

const VerifyBuyerSchema = z.object({
    ntnCnic: z.string().regex(/^(\d{7}|\d{9}|\d{13})$/, 'Must be 7-digit NTN, 9-digit registration, or 13-digit CNIC'),
    customerId: z.string().optional(),
})

export async function POST(req: NextRequest) {
    const { tenant } = await getTenantFromSession()
    const body = VerifyBuyerSchema.parse(await req.json())

    // Get tenant's DI credentials for the token
    const creds = await prisma.dICredentials.findUnique({
        where: { tenantId: tenant.id },
    })

    if (!creds) {
        return NextResponse.json(
            { error: 'DI credentials not configured. Set up PRAL DI in Settings first.' },
            { status: 422 },
        )
    }

    const tokenField = creds.environment === 'SANDBOX'
        ? creds.encryptedSandboxToken
        : creds.encryptedProductionToken

    if (!tokenField) {
        return NextResponse.json(
            { error: 'No DI token configured. Please add your IRIS security token in Settings.' },
            { status: 422 },
        )
    }

    const token = decryptCredential(tokenField)

    // Call FBR APIs to verify the buyer
    const result = await verifyBuyer(body.ntnCnic, token)

    // If a customerId is provided, update the customer record with verification results
    if (body.customerId) {
        const customer = await prisma.customer.findFirst({
            where: { id: body.customerId, tenantId: tenant.id },
        })

        if (customer) {
            await prisma.customer.update({
                where: { id: body.customerId },
                data: {
                    fbrVerified: result.registrationType !== 'unknown',
                    fbrVerifiedAt: new Date(),
                    registrationType: result.registrationType !== 'unknown' ? result.registrationType : undefined,
                    atlStatus: result.atlStatus !== 'unknown' ? result.atlStatus : undefined,
                    fbrRegistrationNo: result.registrationNo,
                    fbrRegistrationType: result.registrationType !== 'unknown' ? result.registrationType : undefined,
                },
            })
        }
    }

    return NextResponse.json({
        ntnCnic: body.ntnCnic,
        registrationType: result.registrationType,
        atlStatus: result.atlStatus,
        registrationNo: result.registrationNo,
        verified: result.registrationType !== 'unknown',
    })
}
