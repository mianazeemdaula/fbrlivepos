'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface ReportInvoice {
    id: string
    invoiceNumber: string
    buyerName: string | null
    buyerNTN: string | null
    subtotal: number | string
    taxAmount: number | string
    discountAmount: number | string
    totalAmount: number | string
    paymentMethod: string
    status: string
    diInvoiceNumber: string | null
    confirmedAt: string | null
    createdAt: string
    items: { name: string; quantity: number; unitPrice: number; taxAmount: number; lineTotal: number }[]
}

interface ReportMeta {
    total: number
    totalPages: number
}

const PAYMENT_METHODS = ['', 'CASH', 'CARD', 'BANK_TRANSFER']

function fmt(n: number | string) {
    return Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function InvoiceReportPage() {
    const today = new Date().toISOString().slice(0, 10)
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

    const [from, setFrom] = useState(firstOfMonth)
    const [to, setTo] = useState(today)
    const [search, setSearch] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('')
    const [invoices, setInvoices] = useState<ReportInvoice[]>([])
    const [meta, setMeta] = useState<ReportMeta>({ total: 0, totalPages: 1 })
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [businessName, setBusinessName] = useState('')
    const [sellerNTN, setSellerNTN] = useState('')
    const printRef = useRef<HTMLDivElement>(null)

    // Load business info once
    useEffect(() => {
        fetch('/api/tenant/profile').then(r => r.ok ? r.json() : null).then(d => {
            if (d?.name) setBusinessName(d.name)
        }).catch(() => { })
        fetch('/api/tenant/fbr-credentials').then(r => r.ok ? r.json() : null).then(d => {
            if (d?.sellerNTN) setSellerNTN(d.sellerNTN)
        }).catch(() => { })
    }, [])

    const loadReport = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                status: 'CONFIRMED',
                limit: '200',
                page: String(page),
            })
            if (from) params.set('from', from)
            if (to) params.set('to', to)
            if (search.trim()) params.set('q', search.trim())
            if (paymentMethod) params.set('paymentMethod', paymentMethod)

            const res = await fetch(`/api/invoices?${params}`)
            if (res.ok) {
                const data = await res.json()
                setInvoices(data.invoices ?? data.data ?? [])
                setMeta({
                    total: data.meta?.total ?? data.total ?? 0,
                    totalPages: data.meta?.totalPages ?? data.pages ?? 1,
                })
            }
        } catch { /* ignore */ } finally {
            setLoading(false)
        }
    }, [from, to, search, paymentMethod, page])

    useEffect(() => { void loadReport() }, [loadReport])

    // Aggregate totals — coerce to Number because Prisma Decimal fields
    // serialize as strings in JSON and would concatenate instead of adding.
    const totals = invoices.reduce(
        (acc, inv) => ({
            subtotal: acc.subtotal + Number(inv.subtotal),
            tax: acc.tax + Number(inv.taxAmount),
            discount: acc.discount + Number(inv.discountAmount),
            total: acc.total + Number(inv.totalAmount),
        }),
        { subtotal: 0, tax: 0, discount: 0, total: 0 },
    )

    function handlePrint() {
        window.print()
    }

    function handleDownloadCSV() {
        const headers = [
            'Invoice #', 'Date', 'FBR Invoice #', 'Buyer Name', 'Buyer NTN',
            'Payment', 'Subtotal (PKR)', 'Discount (PKR)', 'GST (PKR)', 'Total (PKR)',
        ]
        const rows = invoices.map(inv => [
            inv.invoiceNumber,
            new Date(inv.createdAt).toLocaleDateString('en-PK'),
            inv.diInvoiceNumber ?? '',
            inv.buyerName ?? '',
            inv.buyerNTN ?? '',
            inv.paymentMethod,
            Number(inv.subtotal).toFixed(2),
            Number(inv.discountAmount).toFixed(2),
            Number(inv.taxAmount).toFixed(2),
            Number(inv.totalAmount).toFixed(2),
        ])
        // Summary row
        rows.push([])
        rows.push(['', '', '', '', '', 'TOTALS',
            totals.subtotal.toFixed(2),
            totals.discount.toFixed(2),
            totals.tax.toFixed(2),
            totals.total.toFixed(2),
        ])

        const csv = [headers, ...rows]
            .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
            .join('\n')

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `FBR-Invoices-${from}-to-${to}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <>
            {/* ── Print-only header ───────────────────────────────────────── */}
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    body { background: white; }
                    @page { margin: 18mm 14mm; }
                }
                .print-only { display: none; }
            `}</style>

            <div className="p-6 lg:p-8">
                {/* ── Screen header ───────────────────────────────────────── */}
                <div className="no-print mb-6 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-caps text-muted">FBR Submitted</p>
                        <h1 className="text-page-title font-normal text-ink">Invoice Report</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownloadCSV}
                            disabled={invoices.length === 0}
                            className="flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-ui-xs font-medium text-ink hover:bg-surface disabled:opacity-40 transition-colors"
                        >
                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download CSV
                        </button>
                        <button
                            onClick={handlePrint}
                            disabled={invoices.length === 0}
                            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-ui-xs font-medium text-white hover:bg-primary-dark disabled:opacity-40 transition-colors"
                        >
                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
                            </svg>
                            Print
                        </button>
                    </div>
                </div>

                {/* ── Filters ─────────────────────────────────────────────── */}
                <div className="no-print mb-5 flex flex-wrap items-end gap-3 rounded-card border border-border bg-white p-4 shadow-card">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted">From</label>
                        <input
                            type="date"
                            value={from}
                            onChange={e => { setFrom(e.target.value); setPage(1) }}
                            className="rounded-input border border-border bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted">To</label>
                        <input
                            type="date"
                            value={to}
                            onChange={e => { setTo(e.target.value); setPage(1) }}
                            className="rounded-input border border-border bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted">Payment</label>
                        <select
                            value={paymentMethod}
                            onChange={e => { setPaymentMethod(e.target.value); setPage(1) }}
                            className="rounded-input border border-border bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus:border-primary"
                        >
                            {PAYMENT_METHODS.map(m => (
                                <option key={m} value={m}>{m || 'All methods'}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="mb-1 block text-xs font-medium text-muted">Search buyer / invoice #</label>
                        <input
                            type="text"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1) }}
                            placeholder="Name, NTN, or invoice number…"
                            className="w-full rounded-input border border-border bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-primary"
                        />
                    </div>
                    <button
                        onClick={loadReport}
                        className="rounded-full bg-primary px-4 py-2 text-ui-xs font-medium text-white hover:bg-primary-dark transition-colors"
                    >
                        Apply
                    </button>
                </div>

                {/* ── Print header (hidden on screen) ─────────────────────── */}
                <div ref={printRef} className="print-only mb-6">
                    <h2 className="text-xl font-bold text-center">{businessName}</h2>
                    {sellerNTN && <p className="text-sm text-center text-gray-500">NTN: {sellerNTN}</p>}
                    <h3 className="mt-3 text-base font-semibold text-center">FBR Submitted Invoices Report</h3>
                    <p className="text-sm text-center text-gray-500">
                        Period: {from} to {to}
                        {paymentMethod ? ` · Payment: ${paymentMethod}` : ''}
                        {search ? ` · Search: "${search}"` : ''}
                    </p>
                    <p className="text-xs text-center text-gray-400 mt-1">
                        Generated: {new Date().toLocaleString('en-PK')} · {meta.total} invoice{meta.total !== 1 ? 's' : ''}
                    </p>
                    <hr className="mt-3 border-gray-300" />
                </div>

                {/* ── Summary cards ───────────────────────────────────────── */}
                <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Invoices', value: String(meta.total) },
                        { label: 'Subtotal', value: `PKR ${fmt(totals.subtotal)}` },
                        { label: 'GST', value: `PKR ${fmt(totals.tax)}` },
                        { label: 'Total (incl. GST)', value: `PKR ${fmt(totals.total)}` },
                    ].map(card => (
                        <div key={card.label} className="rounded-card border border-border bg-white p-4 shadow-card">
                            <p className="text-xs font-medium uppercase tracking-caps text-muted">{card.label}</p>
                            <p className="mt-1 text-lg font-semibold text-ink truncate">{card.value}</p>
                        </div>
                    ))}
                </div>

                {/* ── Table ───────────────────────────────────────────────── */}
                <div className="rounded-card border border-border bg-white shadow-card overflow-x-auto">
                    {loading ? (
                        <div className="p-8 text-center text-sm text-muted">Loading…</div>
                    ) : invoices.length === 0 ? (
                        <div className="p-12 text-center text-sm text-muted">
                            No FBR-submitted invoices found for the selected filters.
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border-muted">
                                    <th className="px-4 py-3 text-left text-ui-xs font-semibold text-muted whitespace-nowrap">#</th>
                                    <th className="px-4 py-3 text-left text-ui-xs font-semibold text-muted whitespace-nowrap">Invoice #</th>
                                    <th className="px-4 py-3 text-left text-ui-xs font-semibold text-muted whitespace-nowrap">Date</th>
                                    <th className="px-4 py-3 text-left text-ui-xs font-semibold text-muted whitespace-nowrap">FBR Invoice #</th>
                                    <th className="px-4 py-3 text-left text-ui-xs font-semibold text-muted whitespace-nowrap">Buyer</th>
                                    <th className="px-4 py-3 text-left text-ui-xs font-semibold text-muted whitespace-nowrap">NTN / CNIC</th>
                                    <th className="px-4 py-3 text-left text-ui-xs font-semibold text-muted whitespace-nowrap">Payment</th>
                                    <th className="px-4 py-3 text-right text-ui-xs font-semibold text-muted whitespace-nowrap">Subtotal</th>
                                    <th className="px-4 py-3 text-right text-ui-xs font-semibold text-muted whitespace-nowrap">Discount</th>
                                    <th className="px-4 py-3 text-right text-ui-xs font-semibold text-muted whitespace-nowrap">GST</th>
                                    <th className="px-4 py-3 text-right text-ui-xs font-semibold text-muted whitespace-nowrap">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv, idx) => (
                                    <tr key={inv.id} className="border-b border-border-muted hover:bg-surface-subtle transition-colors">
                                        <td className="px-4 py-2.5 text-xs text-muted">{(page - 1) * 200 + idx + 1}</td>
                                        <td className="px-4 py-2.5 font-medium text-ink whitespace-nowrap">{inv.invoiceNumber}</td>
                                        <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">
                                            {new Date(inv.createdAt).toLocaleDateString('en-PK')}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs font-mono text-success whitespace-nowrap">
                                            {inv.diInvoiceNumber ?? <span className="text-muted">—</span>}
                                        </td>
                                        <td className="px-4 py-2.5 text-ink max-w-[180px] truncate">{inv.buyerName || '—'}</td>
                                        <td className="px-4 py-2.5 text-xs text-muted font-mono">{inv.buyerNTN || '—'}</td>
                                        <td className="px-4 py-2.5 text-xs text-muted">{inv.paymentMethod}</td>
                                        <td className="px-4 py-2.5 text-right text-ink">PKR {fmt(inv.subtotal)}</td>
                                        <td className="px-4 py-2.5 text-right text-muted">
                                            {Number(inv.discountAmount) > 0 ? `PKR ${fmt(inv.discountAmount)}` : '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-ink">PKR {fmt(inv.taxAmount)}</td>
                                        <td className="px-4 py-2.5 text-right font-semibold text-ink">PKR {fmt(inv.totalAmount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            {/* Totals footer */}
                            <tfoot>
                                <tr className="border-t-2 border-border bg-surface-subtle font-semibold">
                                    <td colSpan={7} className="px-4 py-3 text-sm text-ink">
                                        Totals — {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
                                        {meta.total > invoices.length && (
                                            <span className="ml-2 text-xs font-normal text-muted">
                                                (showing {invoices.length} of {meta.total})
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right text-ink">PKR {fmt(totals.subtotal)}</td>
                                    <td className="px-4 py-3 text-right text-muted">
                                        {totals.discount > 0 ? `PKR ${fmt(totals.discount)}` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-right text-ink">PKR {fmt(totals.tax)}</td>
                                    <td className="px-4 py-3 text-right text-ink">PKR {fmt(totals.total)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>

                {/* ── Pagination ──────────────────────────────────────────── */}
                {meta.totalPages > 1 && (
                    <div className="no-print mt-4 flex justify-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="rounded-full border border-border bg-white px-3 py-1.5 text-ui-xs text-ink disabled:opacity-40 hover:bg-surface transition-colors"
                        >
                            Previous
                        </button>
                        <span className="px-3 py-1.5 text-ui-xs text-muted">
                            Page {page} of {meta.totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                            disabled={page === meta.totalPages}
                            className="rounded-full border border-border bg-white px-3 py-1.5 text-ui-xs text-ink disabled:opacity-40 hover:bg-surface transition-colors"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </>
    )
}
