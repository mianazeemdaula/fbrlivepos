import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { syncAllReferenceData } from '../../../../../workers/di-reference-sync.worker'

export async function POST() {
    const session = await auth()

    if (!session?.user || (session.user as { role?: string }).role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!process.env.PRAL_PLATFORM_TOKEN) {
        return NextResponse.json(
            { error: 'PRAL_PLATFORM_TOKEN not configured on server.' },
            { status: 500 },
        )
    }

    try {
        await syncAllReferenceData()
        return NextResponse.json({ success: true, message: 'FBR reference data synced.' })
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
