import { prisma } from '@/lib/db/prisma'
import { headers } from 'next/headers'

interface AuditEntry {
    actorId: string
    actorEmail: string
    actorRole: string
    tenantId?: string
    action: string
    entity?: string
    entityId?: string
    before?: object
    after?: object
}

export async function writeAuditLog(entry: AuditEntry) {
    const h = await headers()
    await prisma.auditLog
        .create({
            data: {
                ...entry,
                ipAddress: h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? undefined,
                userAgent: h.get('user-agent') ?? undefined,
            },
        })
        .catch(console.error) // Never throw — audit failures must not break requests
}
