'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const InvoiceDIModal = dynamic(() => import('./InvoiceDIModal'), { ssr: false })

interface Invoice {
    id: string
    invoiceNumber: string
    buyerName: string | null
    subtotal: number
    totalTax: number
    totalAmount: number
    paymentMethod: string
    status: string
    diInvoiceNumber: string | null
    createdAt: string
}

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [search, setSearch] = useState('')
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)

    // Modals
    const [viewDIId, setViewDIId] = useState<string | null>(null)

    const loadInvoices = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ page: String(page), limit: '20' })
            if (search) params.set('q', search)
            const res = await fetch(`/api/invoices?${params}`)
            if (res.ok) {
                const data = await res.json()
                setInvoices(data.invoices ?? data.data ?? [])
                setTotalPages(data.pages ?? data.meta?.totalPages ?? 1)
            }
        } catch {
            // Ignore
        } finally {
            setLoading(false)
        }
    }, [page, search])

    useEffect(() => { loadInvoices() }, [loadInvoices])

    useEffect(() => {
        const timer = setTimeout(() => { setPage(1) }, 300)
        return () => clearTimeout(timer)
    }, [search])

    async function handleAction(invoiceId: string, action: 'validate' | 'confirm') {
        setActionLoading(invoiceId + action)
        setActionError(null)
        try {
            const res = await fetch(`/api/invoices/${invoiceId}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            })
            const data = await res.json()
            if (!res.ok) {
                setActionError(data.error || `Action failed (${res.status})`)
            } else {
                await loadInvoices()
            }
        } catch {
            setActionError('Network error. Please try again.')
        } finally {
            setActionLoading(null)
        }
    }

    async function handlePrint(invoiceId: string) {
        window.open(`/invoice-print/${invoiceId}`, '_blank', 'noopener,noreferrer')
    }

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <p className="text-xs font-medium uppercase tracking-caps text-muted">Sales ledger</p>
                    <h1 className="text-page-title font-normal text-ink">Invoices</h1>
                </div>
                <Link
                    href="/pos"
                    className="rounded-full bg-primary px-4 py-2 text-ui-xs font-medium text-white hover:bg-primary-dark transition-colors"
                >
                    + New Invoice
                </Link>
            </div>

            {/* Search */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search by invoice # or buyer name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full max-w-md rounded-input border border-border bg-white px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-primary"
                />
            </div>

            {actionError && (
                <div className="mb-4 rounded-input border border-error-bg bg-error-bg px-4 py-3 text-sm text-error flex items-center justify-between">
                    {actionError}
                    <button onClick={() => setActionError(null)} className="ml-3 text-error hover:text-error-dark">✕</button>
                </div>
            )}

            {/* Table card */}
            <div className="bg-white rounded-card shadow-card overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border-muted">
                            <th className="px-4 py-3 text-left text-ui-xs font-normal text-muted">Invoice #</th>
                            <th className="px-4 py-3 text-left text-ui-xs font-normal text-muted">Buyer</th>
                            <th className="px-4 py-3 text-left text-ui-xs font-normal text-muted">Amount</th>
                            <th className="px-4 py-3 text-left text-ui-xs font-normal text-muted">Payment</th>
                            <th className="px-4 py-3 text-left text-ui-xs font-normal text-muted">Status</th>
                            <th className="px-4 py-3 text-left text-ui-xs font-normal text-muted">Date</th>
                            <th className="px-4 py-3 text-right text-ui-xs font-normal text-muted">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="border-b border-border-muted">
                                    <td colSpan={7} className="px-4 py-3">
                                        <div className="h-4 rounded-full bg-border animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : invoices.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-muted text-sm">
                                    No invoices yet. Create your first invoice from the POS terminal.
                                </td>
                            </tr>
                        ) : (
                            invoices.map((inv) => (
                                <tr key={inv.id} className="border-b border-border-muted transition-colors hover:bg-surface-subtle">
                                    <td className="px-4 py-3">
                                        <Link href={`/invoices/${inv.id}`} className="text-ui-xs font-medium text-ink hover:underline">
                                            {inv.invoiceNumber}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-muted">{inv.buyerName || '—'}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-ink">PKR {inv.totalAmount.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-ui-xs text-muted">{inv.paymentMethod}</td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={inv.status} />
                                    </td>
                                    <td className="px-4 py-3 text-ui-xs text-muted">
                                        {new Date(inv.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {inv.status === 'DRAFT' && (
                                                <button
                                                    onClick={() => handleAction(inv.id, 'validate')}
                                                    disabled={actionLoading === inv.id + 'validate'}
                                                    className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface disabled:opacity-50 transition-colors"
                                                >
                                                    {actionLoading === inv.id + 'validate' ? '...' : 'Validate'}
                                                </button>
                                            )}
                                            {inv.status === 'VALIDATED' && (
                                                <button
                                                    onClick={() => handleAction(inv.id, 'confirm')}
                                                    disabled={actionLoading === inv.id + 'confirm'}
                                                    className="rounded-full border border-success-bg bg-success-bg px-2.5 py-1 text-xs font-medium text-success hover:bg-primary-light disabled:opacity-50 transition-colors"
                                                >
                                                    {actionLoading === inv.id + 'confirm' ? '...' : 'Confirm'}
                                                </button>
                                            )}
                                            {inv.status === 'FAILED' && (
                                                <button
                                                    onClick={() => handleAction(inv.id, 'validate')}
                                                    disabled={actionLoading === inv.id + 'validate'}
                                                    className="rounded-full border border-error-bg bg-error-bg px-2.5 py-1 text-xs font-medium text-error hover:bg-error-border disabled:opacity-50 transition-colors"
                                                >
                                                    {actionLoading === inv.id + 'validate' ? '...' : 'Retry'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setViewDIId(inv.id)}
                                                className="flex h-7 w-7 items-center justify-center rounded-input border border-border text-muted hover:bg-surface hover:text-ink transition-colors"
                                                title="View DI response"
                                            >
                                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handlePrint(inv.id)}
                                                className="flex h-7 w-7 items-center justify-center rounded-input border border-border text-muted hover:bg-surface hover:text-ink transition-colors"
                                                title="Print invoice"
                                            >
                                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6v-8z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="mt-4 flex justify-center gap-2">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="rounded-full border border-border bg-white px-3 py-1.5 text-ui-xs text-ink disabled:opacity-40 hover:bg-surface transition-colors"
                    >
                        Previous
                    </button>
                    <span className="px-3 py-1.5 text-ui-xs text-muted">Page {page} of {totalPages}</span>
                    <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="rounded-full border border-border bg-white px-3 py-1.5 text-ui-xs text-ink disabled:opacity-40 hover:bg-surface transition-colors"
                    >
                        Next
                    </button>
                </div>
            )}

            {viewDIId && <InvoiceDIModal invoiceId={viewDIId} onClose={() => setViewDIId(null)} />}
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        DRAFT: 'bg-surface-subtle text-muted',
        VALIDATED: 'bg-blue-50 text-blue-500',
        CONFIRMED: 'bg-success-bg text-success',
        SUBMITTED: 'bg-success-bg text-success',
        PENDING: 'bg-accent-light text-warning',
        FAILED: 'bg-error-bg text-error',
    }
    const s = styles[status] || 'bg-surface-subtle text-muted'
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${s}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
            {status}
        </span>
    )
}
