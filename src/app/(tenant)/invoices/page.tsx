'use client'

import { useEffect, useState } from 'react'
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
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)

    // Modals
    const [viewDIId, setViewDIId] = useState<string | null>(null)

    async function loadInvoices() {
        setLoading(true)
        try {
            const res = await fetch(`/api/invoices?page=${page}&limit=20`)
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
    }

    useEffect(() => { loadInvoices() }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

    const statusBadge = (status: string) => {
        const colors: Record<string, string> = {
            DRAFT: 'bg-white/8 text-[#c1bcaf] border-white/10',
            VALIDATED: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
            CONFIRMED: 'bg-green-500/10 text-green-400 border-green-500/30',
            PENDING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
            SUBMITTED: 'bg-green-500/10 text-green-400 border-green-500/30',
            FAILED: 'bg-red-500/10 text-red-400 border-red-500/30',
        }
        return colors[status] || 'bg-white/8 text-[#c1bcaf] border-white/10'
    }

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
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Sales ledger</p>
                    <h1 className="brand-heading mt-2 text-3xl font-bold text-white">Invoices</h1>
                </div>
                <Link
                    href="/pos"
                    className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-(--accent-soft)"
                >
                    New Invoice (POS)
                </Link>
            </div>

            {actionError && (
                <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {actionError}
                    <button onClick={() => setActionError(null)} className="ml-3 text-red-400 hover:text-red-300">✕</button>
                </div>
            )}

            <div className="app-panel overflow-hidden rounded-2xl">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="px-2 py-3 text-left text-xs font-medium text-[#8d897d]">Invoice #</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-[#8d897d]">Buyer</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-[#8d897d]">Amount</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-[#8d897d]">Payment</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-[#8d897d]">DI Status</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-[#8d897d]">Date</th>
                            <th className="px-2 py-3 text-right text-xs font-medium text-[#8d897d]">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="border-b border-white/10">
                                    <td colSpan={7} className="px-4 py-3">
                                        <div className="h-4 rounded bg-white/10 animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : invoices.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-[#8d897d]">
                                    No invoices yet. Create your first invoice from the POS terminal.
                                </td>
                            </tr>
                        ) : (
                            invoices.map((inv) => (
                                <tr key={inv.id} className="border-b border-white/10 transition-colors hover:bg-white/6">
                                    <td className="px-2 py-3">
                                        <Link href={`/invoices/${inv.id}`} className="text-xs text-[#f0d9a0] hover:underline">
                                            {inv.invoiceNumber}
                                        </Link>
                                    </td>
                                    <td className="px-2 py-3 text-sm text-[#d8d0bf]">
                                        {inv.buyerName || '—'}
                                    </td>
                                    <td className="px-2 py-3 text-xs text-white font-medium">
                                        PKR {inv.totalAmount.toLocaleString()}
                                    </td>
                                    <td className="px-2 py-3 text-xs text-[#c1bcaf]">{inv.paymentMethod}</td>
                                    <td className="px-2 py-3">
                                        <span className={`text-xs px-1 py-0.5 rounded-full border ${statusBadge(inv.status)}`}>
                                            {inv.status}
                                        </span>
                                    </td>
                                    <td className="px-2 py-3 text-xs text-[#c1bcaf]">
                                        {new Date(inv.createdAt).toLocaleDateString() + ' ' + new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="px-2 py-3">
                                        <div className="flex items-center justify-end gap-2 flex-wrap">
                                            {/* Lifecycle action buttons */}
                                            {inv.status === 'DRAFT' && (
                                                <button
                                                    onClick={() => handleAction(inv.id, 'validate')}
                                                    disabled={actionLoading === inv.id + 'validate'}
                                                    title="Validate with PRAL DI"
                                                    className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
                                                >
                                                    {actionLoading === inv.id + 'validate' ? '...' : 'Validate'}
                                                </button>
                                            )}
                                            {inv.status === 'VALIDATED' && (
                                                <button
                                                    onClick={() => handleAction(inv.id, 'confirm')}
                                                    disabled={actionLoading === inv.id + 'confirm'}
                                                    title="Confirm & submit to FBR"
                                                    className="rounded-lg border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400 hover:bg-green-500/20 disabled:opacity-50"
                                                >
                                                    {actionLoading === inv.id + 'confirm' ? '...' : 'Confirm to FBR'}
                                                </button>
                                            )}
                                            {(inv.status === 'FAILED') && (
                                                <button
                                                    onClick={() => handleAction(inv.id, 'validate')}
                                                    disabled={actionLoading === inv.id + 'validate'}
                                                    title="Retry submission"
                                                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                                                >
                                                    {actionLoading === inv.id + 'validate' ? '...' : 'Retry'}
                                                </button>
                                            )}
                                            {/* {(inv.status === 'CONFIRMED' || inv.status === 'SUBMITTED') && inv.diInvoiceNumber && (
                                                <span className="text-xs text-[#8d897d]" title="FBR Invoice Number">{inv.diInvoiceNumber}</span>
                                            )} */}
                                            {/* View DI response */}
                                            <button
                                                onClick={() => setViewDIId(inv.id)}
                                                title="View DI response"
                                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/6 text-[#8d897d] hover:bg-white/12 hover:text-white"
                                            >
                                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            </button>
                                            {/* Print */}
                                            <button
                                                onClick={() => handlePrint(inv.id)}
                                                title="Print invoice"
                                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/6 text-[#8d897d] hover:bg-white/12 hover:text-white"
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

            {totalPages > 1 && (
                <div className="mt-4 flex justify-center gap-2">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-sm text-[#d8d0bf] disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="px-3 py-1.5 text-sm text-[#8d897d]">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-sm text-[#d8d0bf] disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* DI Response Modal */}
            {viewDIId && (
                <InvoiceDIModal
                    invoiceId={viewDIId}
                    onClose={() => setViewDIId(null)}
                />
            )}
        </div>
    )
}
