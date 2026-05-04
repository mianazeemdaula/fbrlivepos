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
            {/* Page header */}
            <div className="mb-8">
                <p className="text-xs font-medium uppercase tracking-caps text-muted">Tenant overview</p>
                <h1 className="mt-1 text-page-title font-normal text-ink">Dashboard</h1>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-card p-5 animate-pulse shadow-card">
                            <div className="mb-3 h-3 w-24 rounded-full bg-border" />
                            <div className="h-7 w-16 rounded-full bg-border" />
                        </div>
                    ))}
                </div>
            ) : (
                <>
                    {!stats?.diConfigured && (
                        <div className="mb-6 rounded-card border border-border bg-accent-light p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-sm font-medium text-ink">PRAL DI setup is still pending</p>
                                    <p className="mt-1 text-sm text-muted">
                                        You can manage products and use the dashboard now, then finish DI credentials in Settings before live submissions.
                                    </p>
                                </div>
                                <Link
                                    href="/settings"
                                    className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors"
                                >
                                    Open Settings
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* Stats row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <StatCard label="Today's Sales" value={`PKR ${(stats?.todaySales ?? 0).toLocaleString()}`} sub={`${stats?.todayInvoices ?? 0} invoices`} style="black" />
                        <StatCard label="This Month" value={`PKR ${(stats?.monthSales ?? 0).toLocaleString()}`} sub={`${stats?.monthInvoices ?? 0} invoices`} style="yellow" />
                        <StatCard
                            label="PRAL DI Status"
                            value={stats?.diStatus === 'CLOSED' || stats?.diStatus === 'HALF_OPEN' || stats?.diStatus === 'CONNECTED' ? 'Connected' : stats?.diStatus === 'NOT_CONFIGURED' ? 'Not Configured' : stats?.diStatus ?? 'N/A'}
                            sub={`${stats?.pendingSubmissions ?? 0} pending`}
                            style={stats?.diStatus === 'CLOSED' || stats?.diStatus === 'HALF_OPEN' || stats?.diStatus === 'CONNECTED' ? 'green' : 'outlined'}
                        />
                        <StatCard label="Products" value={String(stats?.productCount ?? 0)} sub="in catalogue" style="outlined" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-card shadow-card p-6">
                            <h2 className="mb-4 text-ui-sm font-semibold text-ink">Quick Actions</h2>
                            <div className="grid grid-cols-2 gap-3">
                                <QuickAction href="/pos" label="Open POS" />
                                <QuickAction href="/invoices" label="View Invoices" />
                                <QuickAction href="/products" label="Manage Products" />
                                <QuickAction href="/settings" label="DI Settings" />
                            </div>
                        </div>

                        <div className="bg-white rounded-card shadow-card p-6">
                            <h2 className="mb-4 text-ui-sm font-semibold text-ink">Getting Started</h2>
                            <div className="space-y-4">
                                <Step number={1} title="Configure PRAL DI Credentials" description="Go to Settings to enter your IRIS security token and business details." />
                                <Step number={2} title="Add Products" description="Add your products with GST rates and HS codes." />
                                <Step number={3} title="Start Selling" description="Use the POS terminal to create invoices automatically submitted to PRAL." />
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

function StatCard({ label, value, sub, style = 'outlined' }: { label: string; value: string; sub: string; style?: 'black' | 'yellow' | 'green' | 'outlined' }) {
    const styles = {
        black: 'bg-primary text-white',
        yellow: 'bg-accent text-ink',
        green: 'bg-success-bg text-success',
        outlined: 'bg-white border border-border text-ink',
    }
    return (
        <div className={`rounded-card p-5 shadow-card ${styles[style]}`}>
            <p className={`mb-1 text-xs font-medium uppercase tracking-caps-xs ${style === 'black' ? 'text-white' : style === 'yellow' ? 'text-ink/60' : style === 'green' ? 'text-success/70' : 'text-muted'}`}>{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
            <p className={`mt-1 text-xs ${style === 'black' ? 'text-muted' : 'text-current opacity-60'}`}>{sub}</p>
        </div>
    )
}

function QuickAction({ href, label }: { href: string; label: string }) {
    return (
        <a
            href={href}
            className="flex items-center justify-center rounded-input border border-border px-4 py-3 text-ui-xs font-medium text-ink hover:bg-surface transition-colors"
        >
            {label}
        </a>
    )
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
    return (
        <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                {number}
            </div>
            <div>
                <p className="text-sm font-medium text-ink">{title}</p>
                <p className="text-ui-xs text-muted">{description}</p>
            </div>
        </div>
    )
}
