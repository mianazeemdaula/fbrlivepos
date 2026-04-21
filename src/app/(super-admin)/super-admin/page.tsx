'use client'

import { useEffect, useState } from 'react'

interface PlatformStats {
    mrr: number
    totalTenants: number
    activeTenants: number
    totalInvoicesMonth: number
    totalRevenue: number
}

function normalizePlatformStats(payload: unknown): PlatformStats {
    const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}

    return {
        mrr: Number(data.mrr ?? 0),
        totalTenants: Number(data.totalTenants ?? 0),
        activeTenants: Number(data.activeTenants ?? data.activeSubscriptions ?? 0),
        totalInvoicesMonth: Number(data.totalInvoicesMonth ?? data.totalInvoicesToday ?? 0),
        totalRevenue: Number(data.totalRevenue ?? 0),
    }
}

export default function AdminOverviewPage() {
    const [stats, setStats] = useState<PlatformStats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch('/api/admin/analytics/mrr')
                const contentType = res.headers.get('content-type') ?? ''

                if (res.ok && contentType.includes('application/json')) {
                    setStats(normalizePlatformStats(await res.json()))
                }
            } catch {
                // Ignore
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Super admin</p>
                <h1 className="brand-heading text-3xl font-bold text-white">Platform Overview</h1>
                <p className="mt-1 text-sm text-[#c1bcaf]">Real-time metrics across all tenants</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="app-panel rounded-2xl p-5 animate-pulse">
                            <div className="mb-4 h-3.5 w-24 rounded bg-white/10" />
                            <div className="mb-2 h-7 w-20 rounded bg-white/10" />
                            <div className="h-3 w-16 rounded bg-white/10" />
                        </div>
                    ))
                ) : (
                    <>
                        <StatCard
                            label="Monthly Recurring Revenue"
                            value={`PKR ${(stats?.mrr ?? 0).toLocaleString()}`}
                            accent="indigo"
                            icon={
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                </svg>
                            }
                        />
                        <StatCard
                            label="Total Tenants"
                            value={String(stats?.totalTenants ?? 0)}
                            sub={`${stats?.activeTenants ?? 0} active`}
                            accent="emerald"
                            icon={
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                    <polyline points="9 22 9 12 15 12 15 22" />
                                </svg>
                            }
                        />
                        <StatCard
                            label="Invoices This Month"
                            value={String(stats?.totalInvoicesMonth ?? 0)}
                            accent="sky"
                            icon={
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                                </svg>
                            }
                        />
                        <StatCard
                            label="Revenue This Month"
                            value={`PKR ${(stats?.totalRevenue ?? 0).toLocaleString()}`}
                            accent="violet"
                            icon={
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                                    <polyline points="16 7 22 7 22 13" />
                                </svg>
                            }
                        />
                    </>
                )}
            </div>

            {/* Quick links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <QuickLink
                    href="/super-admin/tenants"
                    title="Manage Tenants"
                    description="View, suspend, or configure tenant accounts"
                    icon={
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                    }
                />
                <QuickLink
                    href="/super-admin/subscriptions"
                    title="Subscription Plans"
                    description="Create and manage pricing plans"
                    icon={
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                            <line x1="1" y1="10" x2="23" y2="10" />
                        </svg>
                    }
                />
                <QuickLink
                    href="/super-admin/audit"
                    title="Audit Log"
                    description="Track all platform-level actions"
                    icon={
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                    }
                />
            </div>
        </div>
    )
}

function StatCard({
    label,
    value,
    sub,
    accent,
    icon,
}: {
    label: string
    value: string
    sub?: string
    accent: 'indigo' | 'emerald' | 'sky' | 'violet'
    icon: React.ReactNode
}) {
    const accentMap = {
        indigo: 'text-indigo-400 bg-indigo-500/10',
        emerald: 'text-emerald-400 bg-emerald-500/10',
        sky: 'text-sky-400 bg-sky-500/10',
        violet: 'text-violet-400 bg-violet-500/10',
    }
    return (
        <div className="app-panel rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-medium leading-tight text-[#c1bcaf]">{label}</p>
                <span className={`p-1.5 rounded-lg ${accentMap[accent]}`}>{icon}</span>
            </div>
            <p className="metric-value text-2xl font-bold">{value}</p>
            {sub && <p className="mt-1 text-xs text-[#8d897d]">{sub}</p>}
        </div>
    )
}

function QuickLink({ href, title, description, icon }: { href: string; title: string; description: string; icon: React.ReactNode }) {
    return (
        <a href={href} className="app-panel group block rounded-2xl p-5 transition-all hover:border-[rgba(200,164,90,0.28)] hover:bg-[rgba(29,44,34,0.88)]">
            <div className="flex items-center gap-3 mb-2">
                <span className="text-[#f0d9a0] transition-colors group-hover:text-[#f6e7bf]">{icon}</span>
                <h3 className="text-sm font-semibold text-white">{title}</h3>
            </div>
            <p className="text-xs text-[#8d897d]">{description}</p>
        </a>
    )
}

