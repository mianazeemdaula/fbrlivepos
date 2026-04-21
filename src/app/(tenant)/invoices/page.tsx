'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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

    useEffect(() => {
        async function load() {
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
        load()
    }, [page])

    const statusBadge = (status: string) => {
        const colors: Record<string, string> = {
            PENDING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
            SUBMITTED: 'bg-green-500/10 text-green-400 border-green-500/30',
            FAILED: 'bg-red-500/10 text-red-400 border-red-500/30',
        }
        return colors[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/30'
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
                    className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--accent-soft)]"
                >
                    New Invoice (POS)
                </Link>
            </div>

            <div className="app-panel overflow-hidden rounded-2xl">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#8d897d]">Invoice #</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#8d897d]">Buyer</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#8d897d]">Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#8d897d]">Payment</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#8d897d]">DI Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#8d897d]">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="border-b border-white/10">
                                    <td colSpan={6} className="px-4 py-3">
                                        <div className="h-4 rounded bg-white/10 animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : invoices.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-[#8d897d]">
                                    No invoices yet. Create your first invoice from the POS terminal.
                                </td>
                            </tr>
                        ) : (
                            invoices.map((inv) => (
                                <tr key={inv.id} className="border-b border-white/10 transition-colors hover:bg-white/6">
                                    <td className="px-4 py-3">
                                        <Link href={`/invoices/${inv.id}`} className="text-sm text-[#f0d9a0] hover:underline">
                                            {inv.invoiceNumber}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-[#d8d0bf]">
                                        {inv.buyerName || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-white font-medium">
                                        PKR {inv.totalAmount.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-[#c1bcaf]">{inv.paymentMethod}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge(inv.status)}`}
                                        >
                                            {inv.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-[#c1bcaf]">
                                        {new Date(inv.createdAt).toLocaleDateString() + " " + new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
        </div>
    )
}
