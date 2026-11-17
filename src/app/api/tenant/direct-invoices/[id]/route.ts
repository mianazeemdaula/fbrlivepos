import { NextResponse } from 'next/server'
import { requireLedgerAccess } from '@/lib/ledger/service'
import { loadDirectBatch } from '@/lib/direct/service'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
    const access = await requireLedgerAccess()
    if (!access.ok) return access.response
    const { id } = await params

    const batch = await loadDirectBatch(access.tenant.id, id)
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    return NextResponse.json({ batch })
}
