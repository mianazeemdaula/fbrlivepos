'use client'

import { useEffect, useState } from 'react'
import { PaginationControls } from '@/components/pagination-controls'

interface BillingRecord {
    id: string
    amount: number
    status: string
    billingCycle: string
    periodStart: string
    periodEnd: string
    paidAt: string | null
    tenant: { businessName: string }
    plan: { name: string }
}

const LIMIT = 25

export default function BillingPage() {
    const [records, setRecords] = useState<BillingRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const params = new URLSearchParams({ page: String(page) })
                if (filter !== 'all') params.set('status', filter)
                const res = await fetch(`/api/admin/billing?${params.toString()}`)
                if (res.ok) {
                    const data = await res.json()
                    setRecords((data.data || []).map((record: {
                        id: string
                        amount: number
                        status: string
                        billingCycle: string
                        periodStart: string
                        periodEnd: string
                        paidAt: string | null
                        subscription?: {
                            tenant?: { name?: string }
                            plan?: { name?: string }
                        }
                    }) => ({
                        id: record.id,
                        amount: record.amount,
                        status: record.status,
                        billingCycle: record.billingCycle,
                        periodStart: record.periodStart,
                        periodEnd: record.periodEnd,
                        paidAt: record.paidAt,
                        tenant: { businessName: record.subscription?.tenant?.name || 'Unknown tenant' },
                        plan: { name: record.subscription?.plan?.name || 'Unknown plan' },
                    })))
                    setTotal(data.total ?? 0)
                    setTotalPages(data.pages ?? 1)
                }
            } catch {
                // Ignore
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [filter, page])

    async function handleMarkPaid(recordId: string) {
        try {
            await fetch('/api/admin/billing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recordId, action: 'mark_paid' }),
            })
            setRecords((prev) =>
                prev.map((r) =>
                    r.id === recordId ? { ...r, status: 'PAID', paidAt: new Date().toISOString() } : r
                )
            )
        } catch {
            // Ignore
        }
    }

    const from = total === 0 ? 0 : (page - 1) * LIMIT + 1
    const to = Math.min(page * LIMIT, total)

    return (
        <div className="p-8">
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <p className="text-xs font-medium uppercase tracking-caps text-muted">Revenue</p>
                    <h1 className="text-page-title font-normal text-ink">Billing</h1>
                    <p className="mt-1 text-sm text-muted">Track and manage tenant billing records</p>
                </div>
                <select
                    value={filter}
                    onChange={(e) => {
                        setFilter(e.target.value)
                        setPage(1)
                    }}
                    className="rounded-input border border-border bg-white px-3 py-2 text-sm text-ink"
                >
                    <option value="all">All records</option>
                    <option value="PENDING">Pending</option>
                    <option value="PAID">Paid</option>
                    <option value="OVERDUE">Overdue</option>
                </select>
            </div>

            <div className="bg-white rounded-card shadow-card overflow-hidden rounded-2xl">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Tenant</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Plan</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Period</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Status</th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <tr key={i} className="border-b border-border">
                                    <td colSpan={6} className="px-4 py-3">
                                        <div className="h-4 rounded bg-border animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : records.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted">
                                    No billing records found.
                                </td>
                            </tr>
                        ) : (
                            records.map((r) => (
                                <tr key={r.id} className="border-b border-border transition-colors hover:bg-surface-subtle">
                                    <td className="px-4 py-3 text-sm text-ink font-medium">{r.tenant.businessName}</td>
                                    <td className="px-4 py-3 text-sm text-ink">{r.plan.name}</td>
                                    <td className="px-4 py-3 text-sm text-ink font-semibold">
                                        PKR {r.amount.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-muted">
                                        {new Date(r.periodStart).toLocaleDateString()} — {new Date(r.periodEnd).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === 'PAID'
                                                ? 'bg-emerald-500/10 text-emerald-400'
                                                : r.status === 'OVERDUE'
                                                    ? 'bg-red-500/10 text-red-400'
                                                    : 'bg-amber-500/10 text-amber-400'
                                                }`}
                                        >
                                            {r.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {r.status !== 'PAID' && (
                                            <button
                                                onClick={() => handleMarkPaid(r.id)}
                                                className="text-xs font-medium text-muted transition-colors hover:text-cream"
                                            >
                                                Mark Paid
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {!loading && total > 0 && (
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
