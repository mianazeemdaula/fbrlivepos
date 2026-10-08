import { NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { isFeatureEnabled } from '@/lib/features/flags'
import { LEDGER_IMPORT_FLAG } from '@/lib/ledger/service'

// Which optional (super-admin controlled) features the signed-in tenant can use.
export async function GET() {
    try {
        const { tenant } = await getTenantFromSession()
        return NextResponse.json({
            ledgerImport: await isFeatureEnabled(tenant.id, LEDGER_IMPORT_FLAG),
        })
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
}
