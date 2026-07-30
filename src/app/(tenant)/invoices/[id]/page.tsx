'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatPKTDateTime } from '@/lib/date'

interface InvoiceDetail {
    id: string
    invoiceNumber: string
    buyerName: string | null
    buyerNTN: string | null
    buyerCNIC: string | null
    buyerPhone: string | null
    buyerProvince: string | null
    buyerAddress: string | null
    buyerRegistrationType: string | null
    customer: {
        id: string
        name: string
        ntnCnic: string | null
        phone: string | null
        email: string | null
        province: string | null
        address: string | null
        registrationType: string | null
    } | null
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
        requestBody: unknown
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
                    <div className="h-8 w-48 rounded bg-border" />
                    <div className="h-64 rounded bg-border" />
                </div>
            </div>
        )
    }

    if (!invoice) {
        return (
            <div className="p-6 text-center">
                Invoice not found.
                <button onClick={() => router.back()} className="ml-2 text-muted hover:underline">
                    Go back
                </button>
            </div>
        )
    }

    return (
        <div className="p-6 lg:p-8">
            <button onClick={() => router.back()} className="mb-4 inline-block text-sm text-muted hover:text-ink">
                ← Back to Invoices
            </button>

            <div className="bg-card rounded-card shadow-card p-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <p className="text-xs uppercase tracking-caps-xl text-muted">Invoice detail</p>
                        <h1 className="mt-2 text-3xl font-bold text-ink">{invoice.invoiceNumber}</h1>
                        <p className="mt-1 text-sm text-muted">
                            Created {formatPKTDateTime(invoice.createdAt)} (PKT)
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
                <div className="grid grid-cols-2 gap-4 mb-6 text-sm md:grid-cols-4">
                    <div>
                        <p className="text-muted">Buyer</p>
                        <p className="text-ink">{invoice.buyerName || 'Walk-in Customer'}</p>
                    </div>
                    <div>
                        <p className="text-muted">NTN</p>
                        <p className="text-ink">{invoice.buyerNTN || '—'}</p>
                    </div>
                    <div>
                        <p className="text-muted">Payment</p>
                        <p className="text-ink">{invoice.paymentMethod}</p>
                    </div>
                    <div>
                        <p className="text-muted">Phone</p>
                        <p className="text-ink">{invoice.buyerPhone || invoice.customer?.phone || '—'}</p>
                    </div>
                    <div>
                        <p className="text-muted">Province</p>
                        <p className="text-ink">{invoice.buyerProvince || invoice.customer?.province || '—'}</p>
                    </div>
                    <div>
                        <p className="text-muted">Registration</p>
                        <p className="text-ink">{invoice.buyerRegistrationType || invoice.customer?.registrationType || '—'}</p>
                    </div>
                    <div className="col-span-2 md:col-span-4">
                        <p className="text-muted">Address</p>
                        <p className="text-ink">{invoice.buyerAddress || invoice.customer?.address || '—'}</p>
                    </div>
                </div>

                {/* DI Info */}
                <div className="rounded-card border border-border bg-surface-subtle mb-6 p-4 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="mb-1 text-xs text-muted">PRAL DI Status</p>
                            <p className="text-sm text-ink font-medium">{invoice.diStatus || invoice.status}</p>
                        </div>
                        <div className="text-right">
                            <p className="mb-1 text-xs text-muted">Status Code</p>
                            <p className="text-sm font-mono text-muted">{invoice.diStatusCode || '—'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="mb-1 text-muted">PRAL Invoice Number</p>
                            <p className="text-green-400 font-mono break-all">{invoice.diInvoiceNumber || '—'}</p>
                        </div>
                        <div>
                            <p className="mb-1 text-muted">Confirmed At</p>
                            <p className="text-ink">{invoice.diInvoiceDate ? formatPKTDateTime(invoice.diInvoiceDate) : '—'}</p>
                        </div>
                        <div>
                            <p className="mb-1 text-muted">DI Error Code</p>
                            <p className="text-ink font-mono">{invoice.diErrorCode || '—'}</p>
                        </div>
                        <div>
                            <p className="mb-1 text-muted">Latest Attempt</p>
                            <p className="text-ink">
                                {invoice.latestSubmissionLog
                                    ? `#${invoice.latestSubmissionLog.attempt} · ${formatPKTDateTime(invoice.latestSubmissionLog.createdAt)}`
                                    : '—'}
                            </p>
                        </div>
                    </div>

                    {displayError && (
                        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 space-y-2">
                            <p className="text-xs text-red-600 mb-1">Error Details</p>
                            <p className="text-sm text-red-700 whitespace-pre-wrap">
                                {displayError}
                            </p>
                            {isAuthError(invoice.submissionError || invoice.latestSubmissionLog?.error) && (
                                <a
                                    href="/settings"
                                    className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-cream hover:underline"
                                >
                                    Go to Settings → PRAL DI Setup
                                </a>
                            )}
                        </div>
                    )}

                    <div>
                        <p className="mb-2 text-xs text-muted">Per-item DI Statuses</p>
                        <pre className="max-h-64 overflow-auto rounded-lg border border-border-strong bg-surface p-3 font-mono text-xs leading-relaxed text-ink whitespace-pre-wrap break-words">
                            {formatJson(invoice.diItemStatuses)}
                        </pre>
                    </div>

                    {(invoice.latestSubmissionLog?.requestBody != null || invoice.latestSubmissionLog?.responseBody != null) && (
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            {invoice.latestSubmissionLog?.requestBody != null && (
                                <div>
                                    <p className="mb-2 text-xs text-muted">
                                        Latest PRAL Request
                                        {invoice.latestSubmissionLog.durationMs != null ? ` · ${invoice.latestSubmissionLog.durationMs} ms` : ''}
                                    </p>
                                    <pre className="max-h-80 overflow-auto rounded-lg border border-border-strong bg-surface p-3 font-mono text-xs leading-relaxed text-ink whitespace-pre-wrap break-words">
                                        {formatJson(invoice.latestSubmissionLog.requestBody)}
                                    </pre>
                                </div>
                            )}
                            {invoice.latestSubmissionLog?.responseBody != null && (
                                <div>
                                    <p className="mb-2 text-xs text-muted">
                                        Latest PRAL Response
                                        {invoice.latestSubmissionLog.responseCode ? ` (${invoice.latestSubmissionLog.responseCode})` : ''}
                                        {invoice.latestSubmissionLog.durationMs != null ? ` · ${invoice.latestSubmissionLog.durationMs} ms` : ''}
                                    </p>
                                    <pre className="max-h-80 overflow-auto rounded-lg border border-border-strong bg-surface p-3 font-mono text-xs leading-relaxed text-ink whitespace-pre-wrap break-words">
                                        {formatJson(invoice.latestSubmissionLog.responseBody)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Items */}
                <table className="w-full mb-6">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="pb-2 text-left text-xs font-medium text-muted">Item</th>
                            <th className="pb-2 text-right text-xs font-medium text-muted">Qty</th>
                            <th className="pb-2 text-right text-xs font-medium text-muted">Price</th>
                            <th className="pb-2 text-right text-xs font-medium text-muted">GST</th>
                            <th className="pb-2 text-right text-xs font-medium text-muted">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.items.map((item) => (
                            <tr key={item.id} className="border-b border-border">
                                <td className="py-2 text-sm text-ink">{item.product.name}</td>
                                <td className="py-2 text-right text-sm text-ink">{item.quantity}</td>
                                <td className="py-2 text-right text-sm text-ink">
                                    PKR {item.unitPrice.toLocaleString()}
                                </td>
                                <td className="py-2 text-right text-sm text-muted">{item.gstRate}%</td>
                                <td className="py-2 text-sm text-ink text-right font-medium">
                                    PKR {item.totalPrice.toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="flex flex-col items-end gap-1">
                    <div className="flex gap-8 text-sm">
                        <span className="text-muted">Subtotal</span>
                        <span className="text-ink">PKR {invoice.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-8 text-sm">
                        <span className="text-muted">Tax (GST)</span>
                        <span className="text-ink">PKR {invoice.totalTax.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-8 text-lg font-bold mt-1">
                        <span className="text-ink">Total</span>
                        <span className="text-muted">PKR {invoice.totalAmount.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
