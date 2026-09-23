import { NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { getSubscriptionAccess } from '@/lib/billing/subscription'

// GET — current tenant's subscription status and expiry, used for in-app banners
export async function GET() {
    const { tenant } = await getTenantFromSession()
    const access = await getSubscriptionAccess(tenant.id)
    return NextResponse.json(access)
}
