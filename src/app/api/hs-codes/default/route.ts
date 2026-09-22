import { NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { getDefaultHSCode } from '@/lib/hscode'

export async function GET() {
    await getTenantFromSession()

    const defaultHS = await getDefaultHSCode()

    if (!defaultHS) {
        return NextResponse.json({ error: 'No HS codes found in database' }, { status: 404 })
    }

    return NextResponse.json({
        id: defaultHS.id,
        code: defaultHS.code,
        description: defaultHS.description,
        shortName: defaultHS.shortName,
        category: defaultHS.category,
        unit: defaultHS.unit,
        defaultTaxRate: defaultHS.defaultTaxRate,
    })
}
