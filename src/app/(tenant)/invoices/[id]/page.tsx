'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface InvoiceDetail {
    id: string
    invoiceNumber: string
    buyerName: string | null
    buyerNTN: string | null
    buyerCNIC: string | null
    subtotal: number
    totalTax: number
    totalAmount: number
    paymentMethod: string
    status: string
    submissionError: string | null
    diInvoiceNumber: string | null
    diInvoiceDate: string | null
    diStatusCode: string | null
    diStatus: string | null
    diItemStatuses: unknown
    diErrorCode: string | null
    diErrorMessage: string | null
    qrCodeData: string | null
    createdAt: string
    latestSubmissionLog: {
        attempt: number
        responseCode: number | null
        responseBody: unknown
        error: string | null
        durationMs: number | null
        createdAt: string
    } | null
    items: Array<{
        id: string
        quantity: number
        unitPrice: number
        gstRate: number
        totalPrice: number
        product: { name: string; sku: string }
    }>
}

export default function InvoiceDetailPage() {
    const params = useParams()
    const router = useRouter()
    const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
    const [loading, setLoading] = useState(true)

    const formatJson = (value: unknown) => {
        if (value == null) {
            return '—'
        }

        try {
            return JSON.stringify(value, null, 2)
        } catch {
            return String(value)
        }
    }

    // Strip internal error class name prefixes (e.g. "DIAuthError: ...")
    const cleanErrorMessage = (msg: string | null | undefined): string | null => {
        if (!msg) return null
        return msg.replace(/^(DIAuthError|DIConfigError|DIServerError|Error):\s*/i, '')
    }

    const isAuthError = (msg: string | null | undefined): boolean => {
        if (!msg) return false
        return /unauthorized|token.*expired|not.*whitelisted|401/i.test(msg)
    }

    const displayError = cleanErrorMessage(
        invoice?.diErrorMessage || invoice?.submissionError || invoice?.latestSubmissionLog?.error,
    )

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/invoices/${params.id}`)
                if (res.ok) {
                    const data = await res.json()
                    setInvoice(data.invoice)
                }
            } catch {
                // Ignore
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [params.id])

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-slate-800 rounded w-48" />
                    <div className="h-64 bg-slate-800 rounded" />
                </div>
            </div>
        )
    }

    if (!invoice) {
        return (
            <div className="p-6 text-center text-slate-500">
                Invoice not found.
                <button onClick={() => router.back()} className="text-blue-400 ml-2 hover:underline">
                    Go back
                </button>
            </div>
        )
    }

    return (
        <div className="p-6 max-w-4xl">
            <button onClick={() => router.back()} className="text-sm text-slate-400 hover:text-white mb-4 inline-block">
                ← Back to Invoices
            </button>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white">{invoice.invoiceNumber}</h1>
                        <p className="text-sm text-slate-400 mt-1">
                            Created {new Date(invoice.createdAt).toLocaleString()}
                        </p>
                    </div>
                    <span
                        className={`text-xs px-3 py-1 rounded-full border ${invoice.status === 'SUBMITTED'
                            ? 'bg-green-500/10 text-green-400 border-green-500/30'
                            : invoice.status === 'FAILED'
                                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                            }`}
                    >
                        {invoice.status}
                    </span>
                </div>

                {/* Buyer Info */}
                <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
                    <div>
                        <p className="text-slate-500">Buyer</p>
                        <p className="text-white">{invoice.buyerName || 'Walk-in Customer'}</p>
                    </div>
                    <div>
                        <p className="text-slate-500">NTN</p>
                        <p className="text-white">{invoice.buyerNTN || '—'}</p>
                    </div>
                    <div>
                        <p className="text-slate-500">Payment</p>
                        <p className="text-white">{invoice.paymentMethod}</p>
                    </div>
                </div>

                {/* DI Info */}
                <div className="bg-slate-800 rounded-lg p-4 mb-6 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs text-slate-400 mb-1">PRAL DI Status</p>
                            <p className="text-sm text-white font-medium">{invoice.diStatus || invoice.status}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-400 mb-1">Status Code</p>
                            <p className="text-sm text-white font-mono">{invoice.diStatusCode || '—'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-slate-400 mb-1">PRAL Invoice Number</p>
                            <p className="text-green-400 font-mono break-all">{invoice.diInvoiceNumber || '—'}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 mb-1">Confirmed At</p>
                            <p className="text-white">{invoice.diInvoiceDate ? new Date(invoice.diInvoiceDate).toLocaleString() : '—'}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 mb-1">DI Error Code</p>
                            <p className="text-white font-mono">{invoice.diErrorCode || '—'}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 mb-1">Latest Attempt</p>
                            <p className="text-white">
                                {invoice.latestSubmissionLog
                                    ? `#${invoice.latestSubmissionLog.attempt} · ${new Date(invoice.latestSubmissionLog.createdAt).toLocaleString()}`
                                    : '—'}
                            </p>
                        </div>
                    </div>

                    {displayError && (
                        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 space-y-2">
                            <p className="text-xs text-red-300 mb-1">Error Details</p>
                            <p className="text-sm text-red-200 whitespace-pre-wrap">
                                {displayError}
                            </p>
                            {isAuthError(invoice.submissionError || invoice.latestSubmissionLog?.error) && (
                                <a
                                    href="/settings"
                                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline"
                                >
                                    Go to Settings → PRAL DI Setup
                                </a>
                            )}
                        </div>
                    )}

                    <div>
                        <p className="text-xs text-slate-400 mb-2">Per-item DI Statuses</p>
                        <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 border border-slate-700 p-3 text-xs text-slate-300 whitespace-pre-wrap wrap-break-word">
                            {formatJson(invoice.diItemStatuses)}
                        </pre>
                    </div>

                    {invoice.latestSubmissionLog?.responseBody != null && (
                        <div>
                            <p className="text-xs text-slate-400 mb-2">
                                Latest PRAL Response
                                {invoice.latestSubmissionLog.responseCode ? ` (${invoice.latestSubmissionLog.responseCode})` : ''}
                                {invoice.latestSubmissionLog.durationMs != null ? ` · ${invoice.latestSubmissionLog.durationMs} ms` : ''}
                            </p>
                            <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 border border-slate-700 p-3 text-xs text-slate-300 whitespace-pre-wrap wrap-break-word">
                                {formatJson(invoice.latestSubmissionLog.responseBody)}
                            </pre>
                        </div>
                    )}
                </div>

                {/* Items */}
                <table className="w-full mb-6">
                    <thead>
                        <tr className="border-b border-slate-800">
                            <th className="text-left text-xs font-medium text-slate-400 pb-2">Item</th>
                            <th className="text-right text-xs font-medium text-slate-400 pb-2">Qty</th>
                            <th className="text-right text-xs font-medium text-slate-400 pb-2">Price</th>
                            <th className="text-right text-xs font-medium text-slate-400 pb-2">GST</th>
                            <th className="text-right text-xs font-medium text-slate-400 pb-2">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.items.map((item) => (
                            <tr key={item.id} className="border-b border-slate-800/50">
                                <td className="py-2 text-sm text-white">{item.product.name}</td>
                                <td className="py-2 text-sm text-slate-300 text-right">{item.quantity}</td>
                                <td className="py-2 text-sm text-slate-300 text-right">
                                    PKR {item.unitPrice.toLocaleString()}
                                </td>
                                <td className="py-2 text-sm text-slate-400 text-right">{item.gstRate}%</td>
                                <td className="py-2 text-sm text-white text-right font-medium">
                                    PKR {item.totalPrice.toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="flex flex-col items-end gap-1">
                    <div className="flex gap-8 text-sm">
                        <span className="text-slate-400">Subtotal</span>
                        <span className="text-white">PKR {invoice.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-8 text-sm">
                        <span className="text-slate-400">Tax (GST)</span>
                        <span className="text-white">PKR {invoice.totalTax.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-8 text-lg font-bold mt-1">
                        <span className="text-white">Total</span>
                        <span className="text-blue-400">PKR {invoice.totalAmount.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
