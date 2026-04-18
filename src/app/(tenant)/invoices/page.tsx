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
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">Invoices</h1>
                <Link
                    href="/pos"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                    New Invoice (POS)
                </Link>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-800">
                            <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Invoice #</th>
                            <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Buyer</th>
                            <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Amount</th>
                            <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Payment</th>
                            <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">DI Status</th>
                            <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="border-b border-slate-800/50">
                                    <td colSpan={6} className="px-4 py-3">
                                        <div className="h-4 bg-slate-800 rounded animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : invoices.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                                    No invoices yet. Create your first invoice from the POS terminal.
                                </td>
                            </tr>
                        ) : (
                            invoices.map((inv) => (
                                <tr key={inv.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                    <td className="px-4 py-3">
                                        <Link href={`/invoices/${inv.id}`} className="text-sm text-blue-400 hover:underline">
                                            {inv.invoiceNumber}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-300">
                                        {inv.buyerName || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-white font-medium">
                                        PKR {inv.totalAmount.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-400">{inv.paymentMethod}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge(inv.status)}`}
                                        >
                                            {inv.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-400">
                                        {new Date(inv.createdAt).toLocaleDateString() + " " + new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 rounded bg-slate-800 text-sm text-slate-300 disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="px-3 py-1.5 text-sm text-slate-400">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1.5 rounded bg-slate-800 text-sm text-slate-300 disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    )
}
