'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { formatPKTDateTime } from '@/lib/date'

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

function getPageNumbers(current: number, total: number): (number | '...')[] {
    if (total <= 5) {
        return Array.from({ length: total }, (_, i) => i + 1)
    }

    const pages: (number | '...')[] = [1]

    if (current > 3) {
        pages.push('...')
    }

    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)

    for (let i = start; i <= end; i++) {
        pages.push(i)
    }

    if (current < total - 2) {
        pages.push('...')
    }

    if (total > 1) {
        pages.push(total)
    }

    return pages
}

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(20)
    const [totalPages, setTotalPages] = useState(1)
    const [totalInvoices, setTotalInvoices] = useState(0)
    const [search, setSearch] = useState('')
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    const [environment, setEnvironment] = useState<'SANDBOX' | 'PRODUCTION' | null>(null)
    const [invoiceLimit, setInvoiceLimit] = useState<{ current: number; max: number | null } | null>(null)

    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
    const [deleteLoading, setDeleteLoading] = useState<string | null>(null)

    // Modals
    const [viewDIId, setViewDIId] = useState<string | null>(null)

    useEffect(() => {
        fetch('/api/tenant/fbr-credentials')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (d?.environment) setEnvironment(d.environment)
            })
            .catch(() => {})
    }, [])

    const loadInvoices = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ page: String(page), limit: String(limit) })
            if (search) params.set('q', search)
            const res = await fetch(`/api/invoices?${params}`)
            if (res.ok) {
                const data = await res.json()
                setInvoices(data.invoices ?? data.data ?? [])
                setTotalPages(data.pages ?? data.meta?.totalPages ?? 1)
                setTotalInvoices(data.total ?? data.meta?.total ?? 0)
                if (data.meta?.invoiceLimit) setInvoiceLimit(data.meta.invoiceLimit)
            }
        } catch {
            // Ignore
        } finally {
            setLoading(false)
        }
    }, [page, limit, search])

    useEffect(() => {
        loadInvoices()
    }, [loadInvoices])

    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1)
        }, 300)
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

    async function handleDelete(invoiceId: string) {
        setDeleteLoading(invoiceId)
        setActionError(null)
        try {
            const res = await fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) {
                setActionError(data.error || `Delete failed (${res.status})`)
            } else {
                await loadInvoices()
            }
        } catch {
            setActionError('Network error. Please try again.')
        } finally {
            setDeleteLoading(null)
            setDeleteConfirm(null)
        }
    }

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <p className="text-xs font-medium uppercase tracking-caps text-muted">Sales ledger</p>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-page-title font-normal text-ink">Invoices</h1>
                        {environment && (
                            <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                                    environment === 'PRODUCTION'
                                        ? 'border-success-border bg-success-bg text-success'
                                        : 'border-border-muted bg-surface-subtle text-gold'
                                }`}
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {environment === 'PRODUCTION' ? 'Live' : 'Sandbox'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Search & Actions inline */}
                <div className="flex flex-1 items-center justify-end gap-3 flex-wrap min-w-[280px]">
                    <div className="relative w-full max-w-sm">
                        <input
                            type="text"
                            placeholder="Search by invoice # or buyer name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded-full border border-border bg-white px-4 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-primary"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-ink"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {invoiceLimit && (
                        <span
                            className={`text-xs font-medium whitespace-nowrap ${
                                invoiceLimit.max !== null && invoiceLimit.current >= invoiceLimit.max
                                    ? 'text-error'
                                    : 'text-muted'
                            }`}
                        >
                            {invoiceLimit.current}
                            {invoiceLimit.max !== null ? ` / ${invoiceLimit.max}` : ''} this month
                        </span>
                    )}

                    <Link
                        href="/pos"
                        className="rounded-full bg-primary px-4 py-2 text-ui-xs font-medium text-white hover:bg-primary-dark transition-colors whitespace-nowrap"
                    >
                        + New Invoice
                    </Link>
                </div>
            </div>

            {actionError && (
                <div className="mb-4 rounded-input border border-error-bg bg-error-bg px-4 py-3 text-sm text-error flex items-center justify-between">
                    {actionError}
                    <button onClick={() => setActionError(null)} className="ml-3 text-error hover:text-error-dark">
                        ✕
                    </button>
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
                            <th className="px-4 py-3 text-left text-ui-xs font-normal text-muted">Date & Time (PKT)</th>
                            <th className="px-4 py-3 text-right text-ui-xs font-normal text-muted">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: limit > 10 ? 10 : limit }).map((_, i) => (
                                <tr key={i} className="border-b border-border-muted">
                                    <td colSpan={7} className="px-4 py-3">
                                        <div className="h-4 rounded-full bg-border animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : invoices.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-muted text-sm">
                                    No invoices found. Create your first invoice from the POS terminal.
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
                                    <td className="px-4 py-3 text-ui-xs text-muted whitespace-nowrap">
                                        {formatPKTDateTime(inv.createdAt)}
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
                                            {(inv.status === 'DRAFT' || inv.status === 'FAILED') && (
                                                deleteConfirm === inv.id ? (
                                                    <span className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleDelete(inv.id)}
                                                            disabled={deleteLoading === inv.id}
                                                            className="rounded-full border border-error bg-error px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition-colors"
                                                        >
                                                            {deleteLoading === inv.id ? '...' : 'Confirm'}
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(null)}
                                                            className="rounded-full border border-border px-2 py-1 text-xs font-medium text-muted hover:bg-surface transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => setDeleteConfirm(inv.id)}
                                                        className="flex h-7 w-7 items-center justify-center rounded-input border border-border text-muted hover:border-error hover:bg-error-bg hover:text-error transition-colors"
                                                        title="Delete invoice"
                                                    >
                                                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                )
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

            {/* Pagination Controls */}
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-card border border-border bg-white px-4 py-3 shadow-card">
                {/* Showing info */}
                <div className="text-xs text-muted">
                    {totalInvoices > 0 ? (
                        <span>
                            Showing <strong className="font-medium text-ink">{(page - 1) * limit + 1}</strong> to{' '}
                            <strong className="font-medium text-ink">{Math.min(page * limit, totalInvoices)}</strong> of{' '}
                            <strong className="font-medium text-ink">{totalInvoices}</strong> invoices
                        </span>
                    ) : (
                        <span>No invoices found</span>
                    )}
                </div>

                {/* Pagination Controls */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Rows per page selector */}
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                        <span>Show</span>
                        <select
                            value={limit}
                            onChange={(e) => {
                                setLimit(Number(e.target.value))
                                setPage(1)
                            }}
                            className="rounded-input border border-border bg-white px-2 py-1 text-xs text-ink focus:outline-none focus:border-primary"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                        <span>per page</span>
                    </div>

                    {/* Page selector dropdown */}
                    {totalPages > 1 && (
                        <div className="flex items-center gap-1.5 text-xs text-muted border-l border-border-muted pl-3">
                            <span>Go to page</span>
                            <select
                                value={page}
                                onChange={(e) => setPage(Number(e.target.value))}
                                className="rounded-input border border-border bg-white px-2 py-1 text-xs text-ink focus:outline-none focus:border-primary"
                            >
                                {Array.from({ length: totalPages }).map((_, i) => (
                                    <option key={i + 1} value={i + 1}>
                                        Page {i + 1}
                                    </option>
                                ))}
                            </select>
                            <span>of {totalPages}</span>
                        </div>
                    )}

                    {/* Buttons */}
                    {totalPages > 1 && (
                        <div className="flex items-center gap-1 border-l border-border-muted pl-3">
                            <button
                                onClick={() => setPage(1)}
                                disabled={page === 1}
                                title="First Page"
                                className="h-7 px-2 rounded-lg border border-border bg-white text-xs text-ink disabled:opacity-30 hover:bg-surface transition-colors"
                            >
                                «
                            </button>
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                title="Previous Page"
                                className="h-7 px-2.5 rounded-lg border border-border bg-white text-xs text-ink disabled:opacity-30 hover:bg-surface transition-colors"
                            >
                                Prev
                            </button>

                            {/* Page numbers */}
                            {getPageNumbers(page, totalPages).map((pNum, idx) =>
                                pNum === '...' ? (
                                    <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted">
                                        ...
                                    </span>
                                ) : (
                                    <button
                                        key={pNum}
                                        onClick={() => setPage(Number(pNum))}
                                        className={`min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors ${
                                            page === pNum
                                                ? 'bg-primary text-white'
                                                : 'border border-border bg-white text-ink hover:bg-surface'
                                        }`}
                                    >
                                        {pNum}
                                    </button>
                                )
                            )}

                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                title="Next Page"
                                className="h-7 px-2.5 rounded-lg border border-border bg-white text-xs text-ink disabled:opacity-30 hover:bg-surface transition-colors"
                            >
                                Next
                            </button>
                            <button
                                onClick={() => setPage(totalPages)}
                                disabled={page === totalPages}
                                title="Last Page"
                                className="h-7 px-2 rounded-lg border border-border bg-white text-xs text-ink disabled:opacity-30 hover:bg-surface transition-colors"
                            >
                                »
                            </button>
                        </div>
                    )}
                </div>
            </div>

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
