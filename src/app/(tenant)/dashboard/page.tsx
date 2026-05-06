'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthBucket {
    month: string
    invoices: number
    sales: number
    tax: number
    submitted: number
    failed: number
}

interface EnvStats {
    invoices: number
    sales: number
    tax: number
}

interface StatusMap {
    [status: string]: number
}

interface DashboardData {
    today: { sandbox: EnvStats; production: EnvStats }
    month: { sandbox: EnvStats; production: EnvStats }
    statusBreakdown: { sandbox: StatusMap; production: StatusMap }
    monthly: { sandbox: MonthBucket[]; production: MonthBucket[] }
    catalogue: { products: number; customers: number }
}

interface DIStatus {
    configured: boolean
    environment?: string
    diOnline?: boolean
    circuit?: { state: string }
    queue?: { waiting: number; active: number; failed: number }
    sandboxCompleted?: boolean
    isProductionReady?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toLocaleString()
}

function fmtPKR(n: number) {
    return `PKR ${fmt(n)}`
}

function pct(a: number, b: number) {
    if (b === 0) return '—'
    return `${Math.round((a / b) * 100)}%`
}

function statusColor(s: string) {
    const map: Record<string, string> = {
        SUBMITTED: '#22c55e',
        FAILED: '#ef4444',
        PENDING: '#f59e0b',
        QUEUED: '#3b82f6',
        DRAFT: '#94a3b8',
        VALIDATED: '#6366f1',
        CONFIRMED: '#10b981',
        CANCELLED: '#9ca3af',
    }
    return map[s] ?? '#94a3b8'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
    label,
    value,
    sub,
    style = 'outlined',
    badge,
}: {
    label: string
    value: string
    sub?: string
    style?: 'black' | 'yellow' | 'green' | 'red' | 'blue' | 'outlined'
    badge?: string
}) {
    const base: Record<string, string> = {
        black: 'bg-primary text-white',
        yellow: 'bg-accent text-ink',
        green: 'bg-green-50 text-green-800 border border-green-200',
        red: 'bg-red-50 text-red-800 border border-red-200',
        blue: 'bg-blue-50 text-blue-800 border border-blue-200',
        outlined: 'bg-white border border-border text-ink',
    }
    const subCls: Record<string, string> = {
        black: 'text-white/70',
        yellow: 'text-ink/60',
        green: 'text-green-600',
        red: 'text-red-500',
        blue: 'text-blue-600',
        outlined: 'text-muted',
    }
    return (
        <div className={`rounded-card p-5 shadow-card ${base[style]}`}>
            <div className="flex items-start justify-between gap-2 mb-1">
                <p className={`text-xs font-medium uppercase tracking-wide ${style === 'black' ? 'text-white/70' : style === 'yellow' ? 'text-ink/50' : 'opacity-60 text-current'}`}>
                    {label}
                </p>
                {badge && (
                    <span className="text-micro font-semibold uppercase tracking-wide rounded-full bg-white/20 px-2 py-0.5 shrink-0">
                        {badge}
                    </span>
                )}
            </div>
            <p className="text-2xl font-semibold leading-tight">{value}</p>
            {sub && <p className={`mt-1 text-xs ${subCls[style]}`}>{sub}</p>}
        </div>
    )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <h2 className="text-ui-sm font-semibold text-ink mb-4">{children}</h2>
}

function EnvToggle({
    value,
    onChange,
}: {
    value: 'sandbox' | 'production'
    onChange: (v: 'sandbox' | 'production') => void
}) {
    return (
        <div className="inline-flex rounded-full border border-border bg-surface p-0.5 text-xs font-medium">
            <button
                onClick={() => onChange('sandbox')}
                className={`rounded-full px-3 py-1 transition-colors ${value === 'sandbox' ? 'bg-primary text-white' : 'text-muted hover:text-ink'}`}
            >
                Sandbox
            </button>
            <button
                onClick={() => onChange('production')}
                className={`rounded-full px-3 py-1 transition-colors ${value === 'production' ? 'bg-primary text-white' : 'text-muted hover:text-ink'}`}
            >
                Live
            </button>
        </div>
    )
}

function StatusBar({ breakdown }: { breakdown: StatusMap }) {
    const order = ['SUBMITTED', 'CONFIRMED', 'VALIDATED', 'PENDING', 'QUEUED', 'FAILED', 'DRAFT', 'CANCELLED']
    const total = Object.values(breakdown).reduce((s, v) => s + v, 0)
    if (total === 0) return <p className="text-xs text-muted">No invoices yet.</p>

    return (
        <div className="space-y-2">
            {order.map((status) => {
                const count = breakdown[status] ?? 0
                if (count === 0) return null
                const width = Math.max(2, (count / total) * 100)
                return (
                    <div key={status} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 text-xs font-medium text-muted capitalize">
                            {status.charAt(0) + status.slice(1).toLowerCase()}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${width}%`, background: statusColor(status) }}
                            />
                        </div>
                        <span className="w-8 text-right text-xs font-semibold text-ink">{count}</span>
                        <span className="w-8 text-right text-xs text-muted">{pct(count, total)}</span>
                    </div>
                )
            })}
        </div>
    )
}

function CustomTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean
    payload?: { name: string; value: number; color: string }[]
    label?: string
}) {
    if (!active || !payload?.length) return null
    return (
        <div className="rounded-card border border-border bg-white p-3 shadow-card text-xs">
            <p className="font-semibold text-ink mb-2">{label}</p>
            {payload.map((p) => (
                <p key={p.name} style={{ color: p.color }}>
                    {p.name}: <span className="font-semibold">{typeof p.value === 'number' && p.name.toLowerCase().includes('sales') ? fmtPKR(p.value) : p.value}</span>
                </p>
            ))}
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null)
    const [diStatus, setDiStatus] = useState<DIStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [chartEnv, setChartEnv] = useState<'sandbox' | 'production'>('sandbox')
    const [statsEnv, setStatsEnv] = useState<'sandbox' | 'production'>('sandbox')

    useEffect(() => {
        async function load() {
            try {
                const [statsRes, diRes] = await Promise.all([
                    fetch('/api/tenant/dashboard/stats'),
                    fetch('/api/tenant/fbr/status'),
                ])
                const statsData = statsRes.ok ? await statsRes.json() : null
                const diData = diRes.ok ? await diRes.json() : null

                if (statsData) setData(statsData)
                if (diData) {
                    setDiStatus(diData)
                    if (diData.environment === 'PRODUCTION') {
                        setChartEnv('production')
                        setStatsEnv('production')
                    }
                }
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const isLive = diStatus?.environment === 'PRODUCTION'
    const envLabel = isLive ? 'Live' : 'Sandbox'
    const circuitState = diStatus?.circuit?.state ?? 'UNKNOWN'
    const diConnected =
        circuitState === 'CLOSED' || circuitState === 'HALF_OPEN' || circuitState === 'CONNECTED'

    const currentStats = data ? (statsEnv === 'sandbox' ? data.month.sandbox : data.month.production) : null
    const todayStats = data ? (statsEnv === 'sandbox' ? data.today.sandbox : data.today.production) : null
    const statusBreakdown = data ? (statsEnv === 'sandbox' ? data.statusBreakdown.sandbox : data.statusBreakdown.production) : {}
    const chartData = data ? (chartEnv === 'sandbox' ? data.monthly.sandbox : data.monthly.production) : []

    const submittedMonth = statusBreakdown['SUBMITTED'] ?? 0
    const failedMonth = statusBreakdown['FAILED'] ?? 0
    const totalMonth = currentStats?.invoices ?? 0
    const successRate = totalMonth > 0 ? Math.round((submittedMonth / totalMonth) * 100) : 0

    if (loading) {
        return (
            <div className="p-6 lg:p-8">
                <div className="mb-8">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Tenant overview</p>
                    <h1 className="mt-1 text-2xl font-normal text-ink">Dashboard</h1>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-card p-5 animate-pulse shadow-card">
                            <div className="mb-3 h-3 w-24 rounded-full bg-border" />
                            <div className="h-7 w-16 rounded-full bg-border" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 lg:p-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Tenant overview</p>
                    <h1 className="mt-1 text-2xl font-normal text-ink">Dashboard</h1>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${!diStatus?.configured
                                ? 'bg-gray-100 text-gray-600'
                                : diConnected
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                            }`}
                    >
                        <span
                            className={`h-1.5 w-1.5 rounded-full ${!diStatus?.configured ? 'bg-gray-400' : diConnected ? 'bg-green-500' : 'bg-red-500'
                                }`}
                        />
                        {!diStatus?.configured ? 'DI Not Configured' : diConnected ? `${envLabel} Connected` : `${envLabel} ${circuitState}`}
                    </span>
                    {(diStatus?.queue?.waiting ?? 0) > 0 && (
                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                            {diStatus!.queue!.waiting} pending
                        </span>
                    )}
                    {(diStatus?.queue?.failed ?? 0) > 0 && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                            {diStatus!.queue!.failed} failed in queue
                        </span>
                    )}
                </div>
            </div>

            {/* Setup banner */}
            {!diStatus?.configured && (
                <div className="rounded-card border border-border bg-accent/10 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-sm font-medium text-ink">PRAL DI setup is still pending</p>
                            <p className="mt-1 text-sm text-muted">
                                You can manage products and use the dashboard now. Finish DI credentials in Settings before live submissions.
                            </p>
                        </div>
                        <Link
                            href="/settings"
                            className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors shrink-0"
                        >
                            Open Settings
                        </Link>
                    </div>
                </div>
            )}

            {/* Stats environment selector */}
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted font-medium uppercase tracking-wide">Statistics</p>
                <EnvToggle value={statsEnv} onChange={setStatsEnv} />
            </div>

            {/* 8 stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    label="Today's Sales"
                    value={fmtPKR(todayStats?.sales ?? 0)}
                    sub={`${todayStats?.invoices ?? 0} invoices`}
                    style="black"
                    badge={statsEnv === 'production' ? 'Live' : 'SBX'}
                />
                <StatCard
                    label="Today's Tax"
                    value={fmtPKR(todayStats?.tax ?? 0)}
                    sub="GST collected today"
                    style="outlined"
                />
                <StatCard
                    label="Month Sales"
                    value={fmtPKR(currentStats?.sales ?? 0)}
                    sub={`${currentStats?.invoices ?? 0} invoices`}
                    style="yellow"
                    badge={statsEnv === 'production' ? 'Live' : 'SBX'}
                />
                <StatCard
                    label="Month Tax"
                    value={fmtPKR(currentStats?.tax ?? 0)}
                    sub="GST collected this month"
                    style="outlined"
                />
                <StatCard
                    label="Submitted"
                    value={String(submittedMonth)}
                    sub={`of ${totalMonth} invoices`}
                    style="green"
                />
                <StatCard
                    label="Failed"
                    value={String(failedMonth)}
                    sub="DI submission errors"
                    style={failedMonth > 0 ? 'red' : 'outlined'}
                />
                <StatCard
                    label="Success Rate"
                    value={totalMonth > 0 ? `${successRate}%` : '—'}
                    sub="submitted / total"
                    style={successRate >= 90 ? 'green' : successRate >= 60 ? 'yellow' : totalMonth > 0 ? 'red' : 'outlined'}
                />
                <StatCard
                    label="Products"
                    value={String(data?.catalogue.products ?? 0)}
                    sub={`${data?.catalogue.customers ?? 0} customers`}
                    style="outlined"
                />
            </div>

            {/* Monthly charts */}
            <div className="bg-white rounded-card shadow-card p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                    <SectionTitle>Monthly Trends — Last 6 Months</SectionTitle>
                    <EnvToggle value={chartEnv} onChange={setChartEnv} />
                </div>

                {/* Revenue + Tax area chart */}
                <div className="mb-8">
                    <p className="text-xs text-muted font-medium uppercase tracking-wide mb-3">Revenue &amp; Tax (PKR)</p>
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#1d1d1f" stopOpacity={0.15} />
                                    <stop offset="95%" stopColor="#1d1d1f" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradTax" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f5a623" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#f5a623" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <YAxis
                                tickFormatter={(v) => fmt(v)}
                                tick={{ fontSize: 11 }}
                                tickLine={false}
                                axisLine={false}
                                width={52}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Area
                                type="monotone"
                                dataKey="sales"
                                name="Sales"
                                stroke="#1d1d1f"
                                strokeWidth={2}
                                fill="url(#gradSales)"
                            />
                            <Area
                                type="monotone"
                                dataKey="tax"
                                name="Tax"
                                stroke="#f5a623"
                                strokeWidth={2}
                                fill="url(#gradTax)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Invoice count bar chart */}
                <div>
                    <p className="text-xs text-muted font-medium uppercase tracking-wide mb-3">Invoice Counts</p>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="invoices" name="Total" fill="#e5e7eb" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="submitted" name="Submitted" fill="#22c55e" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Status breakdown + quick actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status breakdown */}
                <div className="bg-white rounded-card shadow-card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <SectionTitle>Invoice Status Breakdown</SectionTitle>
                        <EnvToggle value={statsEnv} onChange={setStatsEnv} />
                    </div>
                    <StatusBar breakdown={statusBreakdown} />
                    <div className="mt-5 pt-5 border-t border-border grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-muted mb-1">Sandbox total</p>
                            <p className="text-sm font-semibold text-ink">
                                {Object.values(data?.statusBreakdown.sandbox ?? {}).reduce((s, v) => s + v, 0)} invoices
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-muted mb-1">Live total</p>
                            <p className="text-sm font-semibold text-ink">
                                {Object.values(data?.statusBreakdown.production ?? {}).reduce((s, v) => s + v, 0)} invoices
                            </p>
                        </div>
                    </div>
                </div>

                {/* Quick actions + DI readiness */}
                <div className="space-y-6">
                    <div className="bg-white rounded-card shadow-card p-6">
                        <SectionTitle>Quick Actions</SectionTitle>
                        <div className="grid grid-cols-2 gap-3">
                            <QuickAction href="/pos" label="Open POS" />
                            <QuickAction href="/invoices" label="View Invoices" />
                            <QuickAction href="/products" label="Manage Products" />
                            <QuickAction href="/settings" label="DI Settings" />
                            <QuickAction href="/customers" label="Customers" />
                            <QuickAction href="/sandbox-scenarios" label="Sandbox Tests" />
                        </div>
                    </div>

                    <div className="bg-white rounded-card shadow-card p-6">
                        <SectionTitle>DI Readiness</SectionTitle>
                        <div className="space-y-3">
                            <ReadinessRow
                                done={diStatus?.configured ?? false}
                                label="DI credentials configured"
                                href="/settings"
                            />
                            <ReadinessRow
                                done={diStatus?.sandboxCompleted ?? false}
                                label="Sandbox scenarios passed"
                                href="/sandbox-scenarios"
                            />
                            <ReadinessRow
                                done={diStatus?.isProductionReady ?? false}
                                label="Production access approved"
                                href="/settings"
                            />
                            <ReadinessRow
                                done={(data?.catalogue.products ?? 0) > 0}
                                label="Products added to catalogue"
                                href="/products"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function QuickAction({ href, label }: { href: string; label: string }) {
    return (
        <Link
            href={href}
            className="flex items-center justify-center rounded-input border border-border px-4 py-3 text-xs font-medium text-ink hover:bg-surface transition-colors"
        >
            {label}
        </Link>
    )
}

function ReadinessRow({ done, label, href }: { done: boolean; label: string; href: string }) {
    return (
        <div className="flex items-center gap-3">
            <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-green-100 text-green-600' : 'bg-border text-muted'
                    }`}
            >
                {done ? '✓' : '·'}
            </span>
            <span className={`flex-1 text-sm ${done ? 'text-ink' : 'text-muted'}`}>{label}</span>
            {!done && (
                <Link href={href} className="text-xs font-medium text-primary hover:underline">
                    Fix
                </Link>
            )}
        </div>
    )
}
