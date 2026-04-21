import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'
import { decryptCredential } from '@/lib/crypto/credentials'

const FBR_BASE = 'https://gw.fbr.gov.pk'

export async function POST(req: NextRequest) {
    const { tenant } = await getTenantFromSession()

    const creds = await prisma.dICredentials.findUnique({
        where: { tenantId: tenant.id },
    })

    if (!creds) {
        return NextResponse.json(
            { success: false, error: 'No DI credentials configured. Please set up your PRAL DI credentials.' },
            { status: 422 },
        )
    }

    const tokenField = creds.environment === 'SANDBOX'
        ? creds.encryptedSandboxToken
        : creds.encryptedProductionToken

    if (!tokenField) {
        return NextResponse.json(
            { success: false, error: `No ${creds.environment.toLowerCase()} token configured. Please enter your IRIS security token.` },
            { status: 422 },
        )
    }

    try {
        const token = decryptCredential(tokenField);
        // Test the token by calling the provinces reference API
        const start = Date.now()
        const res = await fetch(`${FBR_BASE}/pdi/v1/provinces`, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: AbortSignal.timeout(10_000),
        })

        const latencyMs = Date.now() - start

        if (res.status === 401) {
            throw new Error('Token is unauthorized. Please check your IRIS security token.')
        }

        if (!res.ok) {
            throw new Error(`PRAL DI endpoint returned ${res.status}`)
        }

        await prisma.dICredentials.update({
            where: { tenantId: tenant.id },
            data: {
                lastVerifiedAt: new Date(),
                verificationError: null,
            },
        })

        return NextResponse.json({
            success: true,
            latencyMs,
            message: 'PRAL DI connection verified successfully',
        })
    } catch (err) {
        await prisma.dICredentials.update({
            where: { tenantId: tenant.id },
            data: {
                verificationError: String(err),
            },
        })

        return NextResponse.json(
            { success: false, error: String(err) },
            { status: 422 },
        )
    }
}
