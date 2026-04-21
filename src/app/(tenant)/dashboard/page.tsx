'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface DashboardStats {
    todayInvoices: number
    todaySales: number
    monthInvoices: number
    monthSales: number
    diStatus: string
    diConfigured: boolean
    pendingSubmissions: number
    productCount: number
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadStats() {
            try {
                const [invoicesRes, diRes, productsRes] = await Promise.all([
                    fetch('/api/invoices?limit=1'),
                    fetch('/api/tenant/fbr/status'),
                    fetch('/api/products?limit=1'),
                ])

                const invoicesData = invoicesRes.ok ? await invoicesRes.json() : null
                const diData = diRes.ok ? await diRes.json() : null
                const productsData = productsRes.ok ? await productsRes.json() : null

                setStats({
                    todayInvoices: invoicesData?.meta?.todayCount ?? 0,
                    todaySales: invoicesData?.meta?.todaySales ?? 0,
                    monthInvoices: invoicesData?.meta?.monthCount ?? 0,
                    monthSales: invoicesData?.meta?.monthSales ?? 0,
                    diStatus: diData?.circuit?.state ?? (diData?.configured ? 'CONNECTED' : 'NOT_CONFIGURED'),
                    diConfigured: diData?.configured ?? false,
                    pendingSubmissions: diData?.queue?.waiting ?? 0,
                    productCount: productsData?.meta?.total ?? productsData?.total ?? 0,
                })
            } catch {
                setStats({
                    todayInvoices: 0,
                    todaySales: 0,
                    monthInvoices: 0,
                    monthSales: 0,
                    diStatus: 'UNKNOWN',
                    diConfigured: false,
                    pendingSubmissions: 0,
                    productCount: 0,
                })
            } finally {
                setLoading(false)
            }
        }

        loadStats()
    }, [])

    return (
        <div className="p-6 lg:p-8">
            <div className="mb-8">
                <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Tenant overview</p>
                <h1 className="brand-heading mt-2 text-3xl font-bold text-white">Dashboard</h1>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="app-panel rounded-2xl p-5 animate-pulse">
                            <div className="mb-3 h-4 w-24 rounded bg-white/10" />
                            <div className="h-8 w-16 rounded bg-white/10" />
                        </div>
                    ))}
                </div>
            ) : (
                <>
                    {!stats?.diConfigured && (
                        <div className="mb-6 rounded-2xl border border-[#f0d9a03a] bg-[#f0d9a00f] p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-sm font-medium text-[#f0d9a0]">PRAL DI setup is still pending</p>
                                    <p className="mt-1 text-sm text-[#d8d0bf]">
                                        You can manage products and use the dashboard now, then finish DI credentials in Settings before live submissions.
                                    </p>
                                </div>
                                <Link
                                    href="/settings"
                                    className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--accent-soft)]"
                                >
                                    Open Settings
                                </Link>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <StatCard
                            label="Today's Sales"
                            value={`PKR ${(stats?.todaySales ?? 0).toLocaleString()}`}
                            sub={`${stats?.todayInvoices ?? 0} invoices`}
                        />
                        <StatCard
                            label="This Month"
                            value={`PKR ${(stats?.monthSales ?? 0).toLocaleString()}`}
                            sub={`${stats?.monthInvoices ?? 0} invoices`}
                        />
                        <StatCard
                            label="PRAL DI Status"
                            value={stats?.diStatus === 'CLOSED' || stats?.diStatus === 'HALF_OPEN' ? 'Connected' : stats?.diStatus === 'CONNECTED' ? 'Connected' : stats?.diStatus === 'NOT_CONFIGURED' ? 'Not Configured' : stats?.diStatus ?? 'N/A'}
                            sub={`${stats?.pendingSubmissions ?? 0} pending`}
                            valueColor={stats?.diStatus === 'CLOSED' || stats?.diStatus === 'HALF_OPEN' || stats?.diStatus === 'CONNECTED' ? 'text-green-400' : 'text-yellow-400'}
                        />
                        <StatCard
                            label="Products"
                            value={String(stats?.productCount ?? 0)}
                            sub="in catalogue"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="app-panel rounded-2xl p-5">
                            <h2 className="mb-4 text-lg font-semibold text-white">Quick Actions</h2>
                            <div className="grid grid-cols-2 gap-3">
                                <QuickAction href="/pos" icon="🖥️" label="Open POS" />
                                <QuickAction href="/invoices" icon="📄" label="View Invoices" />
                                <QuickAction href="/products" icon="📦" label="Manage Products" />
                                <QuickAction href="/settings" icon="⚙️" label="DI Settings" />
                            </div>
                        </div>

                        <div className="app-panel rounded-2xl p-5">
                            <h2 className="mb-4 text-lg font-semibold text-white">Getting Started</h2>
                            <div className="space-y-3">
                                <Step
                                    number={1}
                                    title="Configure PRAL DI Credentials"
                                    description="Go to Settings to enter your IRIS security token and business details."
                                />
                                <Step
                                    number={2}
                                    title="Add Products"
                                    description="Add your products with GST rates and HS codes."
                                />
                                <Step
                                    number={3}
                                    title="Start Selling"
                                    description="Use the POS terminal to create invoices automatically submitted to PRAL."
                                />
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

function StatCard({
    label,
    value,
    sub,
    valueColor = 'text-white',
}: {
    label: string
    value: string
    sub: string
    valueColor?: string
}) {
    return (
        <div className="app-panel rounded-2xl p-5">
            <p className="mb-1 text-sm text-[#c1bcaf]">{label}</p>
            <p className={`metric-value text-2xl font-bold ${valueColor}`}>{value}</p>
            <p className="mt-1 text-xs text-[#8d897d]">{sub}</p>
        </div>
    )
}

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
    return (
        <a
            href={href}
            className="flex items-center gap-2 rounded-xl bg-white/6 px-4 py-3 text-sm text-[#d8d0bf] transition-colors hover:bg-white/10 hover:text-white"
        >
            <span>{icon}</span>
            {label}
        </a>
    )
}

function Step({
    number,
    title,
    description,
}: {
    number: number
    title: string
    description: string
}) {
    return (
        <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f0d9a01a] text-xs font-bold text-[#f0d9a0]">
                {number}
            </div>
            <div>
                <p className="text-sm font-medium text-white">{title}</p>
                <p className="text-xs text-[#c1bcaf]">{description}</p>
            </div>
        </div>
    )
}
