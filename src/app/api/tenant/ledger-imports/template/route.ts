import { NextResponse } from 'next/server'
import { requireLedgerAccess } from '@/lib/ledger/service'
import { buildLedgerTemplate } from '@/lib/ledger/template'

export async function GET() {
    const access = await requireLedgerAccess()
    if (!access.ok) return access.response

    return new NextResponse(new Uint8Array(buildLedgerTemplate()), {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="ledger-import-template.xlsx"',
            'Cache-Control': 'no-store',
        },
    })
}
