'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface TenantDetail {
    id: string
    businessName: string
    email: string
    phone: string | null
    ntn: string | null
    address: string | null
    isActive: boolean
    diConfigured: boolean
    createdAt: string
    subscription?: {
        plan?: { id: string; name: string }
        status: string
        currentPeriodEnd: string | null
    }
    _count?: { invoices: number; users: number; products: number }
}

interface Plan {
    id: string
    name: string
    monthlyPrice: number
}

export default function TenantDetailPage() {
    const params = useParams()
    const router = useRouter()
    const [tenant, setTenant] = useState<TenantDetail | null>(null)
    const [plans, setPlans] = useState<Plan[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState('')

    useEffect(() => {
        async function load() {
            try {
                const [tenantRes, plansRes] = await Promise.all([
                    fetch(`/api/admin/tenants/${params.tenantId}`),
                    fetch('/api/admin/subscriptions'),
                ])
                if (tenantRes.ok) setTenant(await tenantRes.json().then((d) => d.tenant))
                if (plansRes.ok) setPlans(await plansRes.json().then((d) => d.plans || []))
            } catch {
                // Ignore
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [params.tenantId])

    async function handleSuspend() {
        setActionLoading('suspend')
        try {
            const res = await fetch(`/api/admin/tenants/${params.tenantId}/suspend`, { method: 'POST' })
            if (res.ok) {
                setTenant((t) => t ? { ...t, isActive: false } : t)
            }
        } catch {
            // Ignore
        } finally {
            setActionLoading('')
        }
    }

    async function handleActivate() {
        setActionLoading('activate')
        try {
            const res = await fetch(`/api/admin/tenants/${params.tenantId}/activate`, { method: 'POST' })
            if (res.ok) {
                setTenant((t) => t ? { ...t, isActive: true } : t)
            }
        } catch {
            // Ignore
        } finally {
            setActionLoading('')
        }
    }

    async function handleChangePlan(planId: string) {
        setActionLoading('plan')
        try {
            await fetch(`/api/admin/tenants/${params.tenantId}/subscription`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId }),
            })
            // Reload tenant data
            const res = await fetch(`/api/admin/tenants/${params.tenantId}`)
            if (res.ok) setTenant(await res.json().then((d) => d.tenant))
        } catch {
            // Ignore
        } finally {
            setActionLoading('')
        }
    }

    async function handleImpersonate() {
        setActionLoading('impersonate')
        try {
            const res = await fetch(`/api/admin/tenants/${params.tenantId}/impersonate`, { method: 'POST' })
            if (res.ok) {
                const data = await res.json()
                // Open in new tab with impersonation token
                window.open(`/dashboard?impersonate=${data.token}`, '_blank')
            }
        } catch {
            // Ignore
        } finally {
            setActionLoading('')
        }
    }

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-48 rounded bg-white/10" />
                    <div className="h-64 rounded bg-white/10" />
                </div>
            </div>
        )
    }

    if (!tenant) {
        return (
            <div className="p-8 text-center text-[#8d897d]">
                Tenant not found.
                <button onClick={() => router.back()} className="ml-2 text-[#f0d9a0] hover:underline">
                    Go back
                </button>
            </div>
        )
    }

    return (
        <div className="max-w-4xl p-8">
            <button onClick={() => router.back()} className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#8d897d] transition-colors hover:text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                Back to Tenants
            </button>

            <div className="flex justify-between items-start mb-8">
                <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Tenant detail</p>
                    <h1 className="brand-heading mt-2 text-3xl font-bold text-white">{tenant.businessName}</h1>
                    <p className="mt-0.5 text-sm text-[#c1bcaf]">{tenant.email}</p>
                </div>
                <span
                    className={`text-xs px-3 py-1 rounded-full font-medium ${tenant.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                >
                    {tenant.isActive ? 'Active' : 'Suspended'}
                </span>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <InfoCard label="Invoices" value={String(tenant._count?.invoices ?? 0)} />
                <InfoCard label="Users" value={String(tenant._count?.users ?? 0)} />
                <InfoCard label="Products" value={String(tenant._count?.products ?? 0)} />
                <InfoCard label="PRAL DI" value={tenant.diConfigured ? 'Configured' : 'Not Set'} accent={tenant.diConfigured ? 'emerald' : 'amber'} />
            </div>

            {/* Details */}
            <div className="app-panel mb-6 rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-white mb-4">Business Details</h2>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
                    <div><dt className="text-xs text-[#8d897d]">NTN</dt><dd className="mt-0.5 font-mono text-sm text-[#d8d0bf]">{tenant.ntn || '—'}</dd></div>
                    <div><dt className="text-xs text-[#8d897d]">Phone</dt><dd className="mt-0.5 text-sm text-[#d8d0bf]">{tenant.phone || '—'}</dd></div>
                    <div className="col-span-2"><dt className="text-xs text-[#8d897d]">Address</dt><dd className="mt-0.5 text-sm text-[#d8d0bf]">{tenant.address || '—'}</dd></div>
                    <div><dt className="text-xs text-[#8d897d]">Joined</dt><dd className="mt-0.5 text-sm text-[#d8d0bf]">{new Date(tenant.createdAt).toLocaleDateString()}</dd></div>
                </dl>
            </div>

            {/* Subscription */}
            <div className="app-panel mb-6 rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-white mb-4">Subscription</h2>
                <p className="mb-4 text-sm text-[#c1bcaf]">
                    Current plan: <span className="text-white font-medium">{tenant.subscription?.plan?.name || 'Free'}</span>
                    <span className="mx-2 text-[#8d897d]">·</span>
                    Status: <span className="text-[#d8d0bf]">{tenant.subscription?.status || 'N/A'}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                    {plans.map((plan) => (
                        <button
                            key={plan.id}
                            onClick={() => handleChangePlan(plan.id)}
                            disabled={actionLoading === 'plan' || tenant.subscription?.plan?.id === plan.id}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tenant.subscription?.plan?.id === plan.id
                                ? 'border border-[rgba(200,164,90,0.28)] bg-[rgba(200,164,90,0.16)] text-[#f0d9a0]'
                                : 'border border-white/10 bg-white/6 text-[#d8d0bf] hover:bg-white/10'
                                }`}
                        >
                            {plan.name} — PKR {plan.monthlyPrice.toLocaleString()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className="app-panel rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-white mb-4">Actions</h2>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={handleImpersonate}
                        disabled={!!actionLoading}
                        className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                        {actionLoading === 'impersonate' ? 'Loading...' : 'Impersonate'}
                    </button>
                    {tenant.isActive ? (
                        <button
                            onClick={handleSuspend}
                            disabled={!!actionLoading}
                            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            {actionLoading === 'suspend' ? 'Suspending...' : 'Suspend Tenant'}
                        </button>
                    ) : (
                        <button
                            onClick={handleActivate}
                            disabled={!!actionLoading}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            {actionLoading === 'activate' ? 'Activating...' : 'Activate Tenant'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

function InfoCard({ label, value, accent }: { label: string; value: string; accent?: 'emerald' | 'amber' }) {
    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-lg font-bold ${accent === 'emerald' ? 'text-emerald-400' : accent === 'amber' ? 'text-amber-400' : 'text-white'}`}>{value}</p>
        </div>
    )
}
