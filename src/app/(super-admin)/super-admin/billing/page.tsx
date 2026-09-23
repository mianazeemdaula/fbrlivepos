'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { PaginationControls } from '@/components/pagination-controls'
import { SubscriptionStatusBadge } from '../tenants/[tenantId]/SubscriptionManager'

interface BillingRecord {
    id: string
    tenantId: string
    amount: number
    status: string
    description: string
    periodStart: string
    periodEnd: string
    paidAt: string | null
    paymentMethod: string | null
    paymentRef: string | null
    createdAt: string
    subscription?: {
        tenant?: { name?: string }
        plan?: { name?: string }
    }
}

interface TenantSubscriptionRow {
    id: string
    tenant: { id: string; name: string; email: string; isActive: boolean }
    plan: { id: string; name: string; priceMonthly: number; priceYearly: number }
    status: string
    billingCycle: 'MONTHLY' | 'YEARLY'
    expiresAt: string
    daysLeft: number
}

type View = 'expiring' | 'expired' | 'suspended' | 'all' | 'payments'

const LIMIT = 25
const RECORD_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'WAIVED']

const RECORD_STATUS_STYLE: Record<string, string> = {
    PAID: 'bg-emerald-50 text-emerald-700',
    PENDING: 'bg-amber-50 text-amber-700',
    FAILED: 'bg-rose-50 text-rose-700',
    REFUNDED: 'bg-slate-100 text-slate-600',
    WAIVED: 'bg-sky-50 text-sky-700',
}

function formatDate(iso?: string | null) {
    return iso ? new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

export default function BillingPage() {
    const [view, setView] = useState<View>('expiring')
    const [summary, setSummary] = useState({ active: 0, expiring: 0, expired: 0 })
    const [subs, setSubs] = useState<TenantSubscriptionRow[]>([])
    const [records, setRecords] = useState<BillingRecord[]>([])
    const [recordFilter, setRecordFilter] = useState('all')
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const [error, setError] = useState('')

    const loadSubscriptions = useCallback(async (filter: Exclude<View, 'payments'>) => {
        const res = await fetch(`/api/admin/tenant-subscriptions?filter=${filter}`)
        if (!res.ok) throw new Error('Failed to load subscriptions')
        const data = await res.json()
        setSubs(data.data || [])
        setSummary(data.summary || { active: 0, expiring: 0, expired: 0 })
    }, [])

    const loadRecords = useCallback(async () => {
        const params = new URLSearchParams({ page: String(page) })
        if (recordFilter !== 'all') params.set('status', recordFilter)
        const res = await fetch(`/api/admin/billing?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to load billing records')
        const data = await res.json()
        setRecords(data.data || [])
        setTotal(data.total ?? 0)
        setTotalPages(data.pages ?? 1)
    }, [page, recordFilter])

    useEffect(() => {
        let cancelled = false
        async function load() {
            setLoading(true)
            setError('')
            try {
                if (view === 'payments') {
                    await loadRecords()
                } else {
                    await loadSubscriptions(view)
                }
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [view, loadRecords, loadSubscriptions])

    async function updateRecordStatus(recordId: string, status: string) {
        setError('')
        const res = await fetch(`/api/admin/billing/${recordId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        })
        if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            setError(data.error || 'Failed to update billing record')
            return
        }
        await loadRecords()
    }

    const from = total === 0 ? 0 : (page - 1) * LIMIT + 1
    const to = Math.min(page * LIMIT, total)

    const tabs: Array<{ id: View; label: string; count?: number }> = [
        { id: 'expiring', label: 'Expiring soon', count: summary.expiring },
        { id: 'expired', label: 'Expired', count: summary.expired },
        { id: 'suspended', label: 'Suspended / cancelled' },
        { id: 'all', label: 'All subscriptions' },
        { id: 'payments', label: 'Payments' },
    ]

    return (
        <div className="p-4 lg:p-6">
            <div className="mb-4">
                <h1 className="text-page-title font-semibold tracking-tight text-ink">Billing</h1>
                <p className="mt-0.5 text-ui-xs text-muted">Subscriptions, expiry dates and payments across all tenants</p>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <SummaryCard label="Active subscriptions" value={summary.active} />
                <SummaryCard label="Expiring in 7 days" value={summary.expiring} tone="amber" />
                <SummaryCard label="Expired (unpaid)" value={summary.expired} tone="rose" />
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-white p-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => { setView(tab.id); setPage(1) }}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${view === tab.id ? 'bg-primary text-white' : 'text-ink-secondary hover:bg-surface'}`}
                        >
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className={`ml-1.5 rounded-full px-1.5 text-[10px] ${view === tab.id ? 'bg-white/20' : 'bg-surface'}`}>{tab.count}</span>
                            )}
                        </button>
                    ))}
                </div>
                {view === 'payments' && (
                    <select
                        value={recordFilter}
                        onChange={(e) => { setRecordFilter(e.target.value); setPage(1) }}
                        className="rounded-input border border-border bg-white px-3 py-2 text-sm text-ink"
                    >
                        <option value="all">All statuses</option>
                        {RECORD_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                )}
            </div>

            {error && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>
            )}

            <div className="overflow-x-auto rounded-card border border-border bg-white shadow-card">
                {view === 'payments' ? (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border bg-surface-subtle">
                                <Th>Tenant</Th>
                                <Th>Plan</Th>
                                <Th>Description</Th>
                                <Th>Amount</Th>
                                <Th>Period</Th>
                                <Th>Method</Th>
                                <Th>Reference</Th>
                                <Th>Status</Th>
                                <Th />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <LoadingRows cols={9} /> : records.length === 0 ? (
                                <EmptyRow cols={9} text="No billing records found." />
                            ) : records.map((r) => (
                                <tr key={r.id} className="border-b border-border transition-colors hover:bg-surface-subtle">
                                    <td className="max-w-[200px] truncate px-3 py-2 text-sm font-medium text-ink">
                                        <Link href={`/super-admin/tenants/${r.tenantId}`} className="hover:text-primary">
                                            {r.subscription?.tenant?.name || 'Unknown tenant'}
                                        </Link>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{r.subscription?.plan?.name ?? '—'}</td>
                                    <td className="px-3 py-2 text-sm text-ink">{r.description}</td>
                                    <td className="px-3 py-2 text-sm font-semibold tabular-nums text-ink">PKR {Number(r.amount).toLocaleString()}</td>
                                    <td className="px-3 py-2 text-xs text-muted">{formatDate(r.periodStart)} – {formatDate(r.periodEnd)}</td>
                                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{r.paymentMethod?.replace('_', ' ') ?? '—'}</td>
                                    <td className="max-w-[160px] truncate px-3 py-2 text-xs text-muted" title={r.paymentRef ?? undefined}>{r.paymentRef || '—'}</td>
                                    <td className="px-3 py-2">
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RECORD_STATUS_STYLE[r.status] ?? ''}`}>{r.status}</span>
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <select
                                            value=""
                                            onChange={(e) => e.target.value && updateRecordStatus(r.id, e.target.value)}
                                            className="rounded-lg border border-border bg-white px-2 py-1 text-xs text-ink"
                                            aria-label="Change status"
                                        >
                                            <option value="">Change…</option>
                                            {RECORD_STATUSES.filter((s) => s !== r.status).map((status) => (
                                                <option key={status} value={status}>{status === 'PAID' ? 'Mark paid' : status}</option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border bg-surface-subtle">
                                <Th>Tenant</Th>
                                <Th>Email</Th>
                                <Th>Plan</Th>
                                <Th>Price</Th>
                                <Th>Cycle</Th>
                                <Th>Expires</Th>
                                <Th>Days Left</Th>
                                <Th>Status</Th>
                                <Th />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <LoadingRows cols={9} /> : subs.length === 0 ? (
                                <EmptyRow cols={9} text="No subscriptions in this view." />
                            ) : subs.map((sub) => (
                                <tr key={sub.id} className="border-b border-border transition-colors hover:bg-surface-subtle">
                                    <td className="max-w-[200px] truncate px-3 py-2 text-sm font-medium text-ink" title={sub.tenant.name}>{sub.tenant.name}</td>
                                    <td className="max-w-[220px] truncate px-3 py-2 text-xs text-muted" title={sub.tenant.email}>{sub.tenant.email}</td>
                                    <td className="whitespace-nowrap px-3 py-2 text-sm text-ink">{sub.plan.name}</td>
                                    <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-muted">
                                        PKR {(sub.billingCycle === 'YEARLY' ? sub.plan.priceYearly : sub.plan.priceMonthly).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-muted">{sub.billingCycle === 'YEARLY' ? 'Yearly' : 'Monthly'}</td>
                                    <td className="whitespace-nowrap px-3 py-2 text-sm text-ink">{formatDate(sub.expiresAt)}</td>
                                    <td className={`whitespace-nowrap px-3 py-2 text-xs ${sub.daysLeft < 0 ? 'text-rose-600' : sub.daysLeft <= 7 ? 'text-amber-600' : 'text-muted'}`}>
                                        {sub.daysLeft < 0 ? `${Math.abs(sub.daysLeft)} days ago` : sub.daysLeft === 0 ? 'Today' : `${sub.daysLeft} days`}
                                    </td>
                                    <td className="px-3 py-2"><SubscriptionStatusBadge status={sub.status} /></td>
                                    <td className="px-3 py-2 text-right">
                                        <Link
                                            href={`/super-admin/tenants/${sub.tenant.id}`}
                                            className="text-xs font-semibold text-primary hover:text-primary-dark"
                                        >
                                            Manage / renew →
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {view === 'payments' && !loading && total > 0 && (
                <PaginationControls
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    summary={`Showing ${from}-${to} of ${total.toLocaleString()} billing records`}
                />
            )}
        </div>
    )
}

function Th({ children }: { children?: React.ReactNode }) {
    return <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">{children}</th>
}

function LoadingRows({ cols }: { cols: number }) {
    return (
        <>
            {Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                    <td colSpan={cols} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-border" /></td>
                </tr>
            ))}
        </>
    )
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
    return (
        <tr>
            <td colSpan={cols} className="px-4 py-12 text-center text-sm text-muted">{text}</td>
        </tr>
    )
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: 'amber' | 'rose' }) {
    const color = tone === 'amber' ? 'text-amber-600' : tone === 'rose' ? 'text-rose-600' : 'text-ink'
    return (
        <div className="rounded-card border border-border bg-white p-4 shadow-card">
            <p className="text-xs font-medium text-muted">{label}</p>
            <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
        </div>
    )
}
