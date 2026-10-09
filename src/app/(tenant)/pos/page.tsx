'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useCartStore, todayInvoiceDate } from '@/stores/cart'
import { normalizeNtnCnic } from '@/lib/validation/pakistan'
import DirectProductModal, { type DirectPosProduct } from './DirectProductModal'

const CustomerModal = dynamic(() => import('./CustomerModal'), { ssr: false })

interface Product {
    id: string
    name: string
    hsCode: string
    price: number
    taxRate: number
    diRate?: string | null // FBR rate string e.g. "18%", "Exempt"
    diSaleType?: string | null
    diFixedNotifiedValueOrRetailPrice?: number | null // 3rd Schedule: retail/notified price per unit (callers multiply by qty for tax calc)
    sroScheduleNo?: string | null
    sroItemSerialNo?: string | null
    isLocalOnly?: boolean
    unit: string
    valueSalesExcludingST?: number
    salesTaxApplicable?: number
    furtherTax?: number
    fedPayable?: number
    extraTax?: number
    totalTax?: number
    totalInvoiceValue?: number
    furtherTaxPercent?: number
    fedPercent?: number
    extraTaxPercent?: number
    isExempt?: boolean
}

export default function POSPage() {
    const [localProducts, setLocalProducts] = useState<Product[]>([])
    const [showCustomerModal, setShowCustomerModal] = useState(false)
    const [showProductModal, setShowProductModal] = useState(false)
    const [draftLoading, setDraftLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [invoiceType, setInvoiceType] = useState<'Sale Invoice' | 'Debit Note'>('Sale Invoice')
    const [invoiceRefNo, setInvoiceRefNo] = useState('')
    const [showDetails, setShowDetails] = useState(false)
    const terminalRef = useRef<HTMLDivElement>(null)
    const [terminalHeight, setTerminalHeight] = useState('calc(100dvh - 6rem)')

    // Size the terminal to the viewport space left under the header and any banners above it.
    useLayoutEffect(() => {
        const el = terminalRef.current
        if (!el) return
        const fit = () => setTerminalHeight(`calc(100dvh - ${Math.max(0, el.getBoundingClientRect().top + window.scrollY)}px)`)
        fit()
        const observer = new ResizeObserver(fit)
        observer.observe(document.body)
        window.addEventListener('resize', fit)
        return () => {
            observer.disconnect()
            window.removeEventListener('resize', fit)
        }
    }, [])

    const {
        items, buyerName, buyerNTN, buyerProvince, buyerAddress,
        buyerRegistrationType, customerId, paymentMethod, invoiceDate,
        addItem, removeItem,
        setBuyerInfo, setCustomer, setPaymentMethod, setInvoiceDate,
        subtotal, discountTotal, taxAmount, total, clearCart,
    } = useCartStore()

    function handleProductSaved(p: DirectPosProduct) {
        setShowProductModal(false)
        setLocalProducts((prev) => {
            if (prev.some((existing) => existing.id === p.id)) return prev
            return [{
                id: p.id,
                name: p.name,
                hsCode: p.hsCode,
                price: p.price,
                taxRate: p.taxRate,
                diRate: p.diRate ?? null,
                diSaleType: p.diSaleType ?? null,
                diFixedNotifiedValueOrRetailPrice: p.diFixedNotifiedValueOrRetailPrice ?? null,
                sroScheduleNo: p.sroScheduleNo ?? null,
                sroItemSerialNo: p.sroItemSerialNo ?? null,
                isLocalOnly: true,
                unit: p.unit,
                valueSalesExcludingST: p.valueSalesExcludingST,
                salesTaxApplicable: p.salesTaxApplicable,
                furtherTax: p.furtherTax,
                fedPayable: p.fedPayable,
                extraTax: p.extraTax,
                totalTax: p.totalTax,
                totalInvoiceValue: p.totalInvoiceValue,
                furtherTaxPercent: p.furtherTaxPercent,
                fedPercent: p.fedPercent,
                extraTaxPercent: p.extraTaxPercent,
                isExempt: p.isExempt,
            }, ...prev]
        })
        addItem({
            productId: p.id,
            name: p.name,
            hsCode: p.hsCode,
            price: p.price,
            taxRate: p.taxRate,
            diRate: p.diRate ?? null,
            diSaleType: p.diSaleType ?? null,
            diFixedNotifiedValueOrRetailPrice: p.diFixedNotifiedValueOrRetailPrice ?? null,
            sroScheduleNo: p.sroScheduleNo ?? null,
            sroItemSerialNo: p.sroItemSerialNo ?? null,
            isLocalOnly: true,
            unit: p.unit,
            quantity: p.qty,
            discount: p.discount,
            valueSalesExcludingST: p.valueSalesExcludingST,
            salesTaxApplicable: p.salesTaxApplicable,
            furtherTax: p.furtherTax,
            fedPayable: p.fedPayable,
            extraTax: p.extraTax,
            totalTax: p.totalTax,
            totalInvoiceValue: p.totalInvoiceValue,
            furtherTaxPercent: p.furtherTaxPercent,
            fedPercent: p.fedPercent,
            extraTaxPercent: p.extraTaxPercent,
            isExempt: p.isExempt,
        })
    }

    function getItemSalesTax(item: typeof items[number]) {
        return item.totalTax ?? item.salesTaxApplicable ?? 0
    }

    function getItemLineTotal(item: typeof items[number]) {
        return item.totalInvoiceValue ?? item.itemTotal ?? (item.price * item.quantity - item.discount + getItemSalesTax(item))
    }

    async function handleSaveNewCustomerFromModal(form: {
        name: string; ntnCnic: string; phone: string
        province: string; registrationType: string; address: string
    }) {
        const res = await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: form.name.trim(),
                ntnCnic: form.ntnCnic || undefined,
                phone: form.phone || undefined,
                province: form.province || undefined,
                address: form.address || undefined,
                registrationType: form.registrationType || undefined,
            }),
        })
        const data = await res.json()
        if (!res.ok) return { error: data.error || 'Failed to save customer.' }
        setCustomer(data.customer)
        setMessage({ type: 'success', text: `${data.customer.name} added.` })
    }

    async function buildInvoiceBody() {
        return {
            buyerName: buyerName || undefined,
            buyerNTN: normalizeNtnCnic(buyerNTN) || undefined,
            buyerPhone: undefined,
            buyerProvince: buyerProvince || undefined,
            buyerAddress: buyerAddress || undefined,
            buyerRegistrationType: buyerRegistrationType || undefined,
            customerId: customerId || undefined,
            paymentMethod,
            invoiceDate,
            invoiceType,
            invoiceRefNo: invoiceType === 'Debit Note' ? (invoiceRefNo || undefined) : undefined,
            items: items.map((i) => ({
                productId: i.isLocalOnly ? undefined : i.productId,
                name: i.name,
                hsCode: i.hsCode,
                price: i.price,
                quantity: i.quantity,
                discount: i.discount,
                taxRate: i.taxRate,
                diRate: i.diRate ?? undefined,
                diSaleType: i.diSaleType ?? undefined,
                unit: i.unit,
                diFixedNotifiedValueOrRetailPrice: i.diFixedNotifiedValueOrRetailPrice ?? null,
                sroScheduleNo: i.sroScheduleNo ?? null,
                sroItemSerialNo: i.sroItemSerialNo ?? null,
                valueSalesExcludingST: i.valueSalesExcludingST,
                salesTaxApplicable: i.salesTaxApplicable,
                furtherTax: i.furtherTax,
                fedPayable: i.fedPayable,
                extraTax: i.extraTax,
                totalTax: i.totalTax,
                totalInvoiceValue: i.totalInvoiceValue,
            })),
        }
    }

    async function handleDraft() {
        if (items.length === 0) return
        setDraftLoading(true)
        setMessage(null)
        try {
            const body = { ...(await buildInvoiceBody()), status: 'DRAFT' }
            const res = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            const data = await res.json()
            if (!res.ok) { setMessage({ type: 'error', text: data.error || 'Failed to save draft' }); return }
            setMessage({ type: 'success', text: `Draft ${data.invoice.invoiceNumber || 'saved locally'}.` })
            clearCart()
        } catch { setMessage({ type: 'error', text: 'Network error.' }) } finally { setDraftLoading(false) }
    }

    const selectedCustomer = customerId
        ? { id: customerId, name: buyerName, ntnCnic: buyerNTN || null, registrationType: buyerRegistrationType || null }
        : null

    const fmt = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

    const checkoutFields = (
        <div className="space-y-3">
            {/* Customer */}
            <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">Customer</label>
                <button
                    type="button"
                    onClick={() => setShowCustomerModal(true)}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2 text-left transition-colors hover:border-border-strong"
                >
                    {customerId ? (
                        <>
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">
                                {buyerName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-medium text-ink">{buyerName}</span>
                                {buyerNTN ? (
                                    <span className="block font-mono text-[11px] text-muted">{buyerNTN}</span>
                                ) : (
                                    <span className="block text-[11px] text-muted">Walk-in Customer</span>
                                )}
                            </div>
                            {buyerRegistrationType && (
                                <span className="shrink-0 rounded-full bg-primary-light px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                                    {buyerRegistrationType}
                                </span>
                            )}
                        </>
                    ) : (
                        <>
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border-strong text-xs text-muted">+</span>
                            <span className="text-xs text-muted">Walk-in · tap to select customer</span>
                        </>
                    )}
                </button>
            </div>

            {/* Invoice type */}
            <div className="flex gap-1 rounded-lg border border-border bg-canvas p-0.5">
                {(['Sale Invoice', 'Debit Note'] as const).map(t => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setInvoiceType(t)}
                        className={`flex-1 rounded-md py-1 text-[11px] font-medium transition-colors ${invoiceType === t ? 'bg-primary text-white shadow-sm' : 'text-ink-secondary hover:text-ink'}`}
                    >{t}</button>
                ))}
            </div>

            {invoiceType === 'Debit Note' && (
                <input
                    value={invoiceRefNo}
                    onChange={e => setInvoiceRefNo(e.target.value)}
                    placeholder="Original FBR invoice # (22/28 chars)"
                    aria-label="FBR invoice reference number"
                    className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                />
            )}

            {/* Date + payment */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">Invoice Date</label>
                    <input
                        type="date"
                        value={invoiceDate}
                        max={todayInvoiceDate()}
                        onChange={e => setInvoiceDate(e.target.value || todayInvoiceDate())}
                        className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">Payment</label>
                    <select
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value as 'CASH' | 'CARD' | 'BANK_TRANSFER')}
                        className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                    >
                        <option value="CASH">Cash</option>
                        <option value="CARD">Card</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                    </select>
                </div>
            </div>
        </div>
    )

    return (
        <>
            {/* Fills exactly the space below the header/banners so the page itself never scrolls */}
            <div
                ref={terminalRef}
                style={{ height: terminalHeight }}
                className="flex min-h-[420px] flex-col overflow-hidden bg-canvas lg:flex-row"
            >

                {/* ══ LEFT: Cart ══ */}
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    {/* Toolbar */}
                    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-white px-3 py-2 lg:px-4">
                        <div className="flex min-w-0 items-baseline gap-2">
                            <h1 className="text-sm font-semibold tracking-tight text-ink">POS Terminal</h1>
                            <span className="truncate text-[11px] text-muted">
                                {items.length} line{items.length === 1 ? '' : 's'} · {itemCount} item{itemCount === 1 ? '' : 's'}
                            </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                            {items.length > 0 && (
                                <button
                                    type="button"
                                    onClick={clearCart}
                                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-error-bg hover:text-error"
                                >
                                    Clear
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowProductModal(true)}
                                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
                            >
                                + Add Product
                            </button>
                        </div>
                    </div>

                    {/* Cart lines (only this area scrolls) */}
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {items.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-2xl">🛒</div>
                                <p className="text-sm font-medium text-ink-secondary">Cart is empty</p>
                                <p className="text-xs text-muted">Add a product to start this sale.</p>
                                <button
                                    type="button"
                                    onClick={() => setShowProductModal(true)}
                                    className="mt-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
                                >
                                    + Add Product
                                </button>
                            </div>
                        ) : (
                            <table className="w-full table-fixed border-collapse text-xs">
                                <thead className="sticky top-0 z-10 bg-surface-subtle">
                                    <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted">
                                        <th className="w-8 px-2 py-1.5 text-left font-semibold">#</th>
                                        <th className="px-2 py-1.5 text-left font-semibold">Product</th>
                                        <th className="hidden w-24 px-2 py-1.5 text-left font-semibold xl:table-cell">HS Code</th>
                                        <th className="hidden w-24 px-2 py-1.5 text-right font-semibold md:table-cell">Price</th>
                                        <th className="w-12 px-2 py-1.5 text-right font-semibold">Qty</th>
                                        <th className="hidden w-16 px-2 py-1.5 text-left font-semibold md:table-cell">Rate</th>
                                        <th className="hidden w-20 px-2 py-1.5 text-right font-semibold xl:table-cell">Disc.</th>
                                        <th className="hidden w-24 px-2 py-1.5 text-right font-semibold sm:table-cell">Tax</th>
                                        <th className="w-24 px-2 py-1.5 text-right font-semibold">Total</th>
                                        <th className="w-8 px-1 py-1.5" />
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    {items.map((item, index) => {
                                        const sroInfo = item.sroScheduleNo || item.sroItemSerialNo
                                            ? `SRO: ${item.sroScheduleNo || 'N/A'} · SR#: ${item.sroItemSerialNo || 'N/A'}`
                                            : undefined
                                        const saleType = item.diSaleType || 'Goods at standard rate (default)'
                                        const rate = (item.diRate ?? '').trim() || `${item.taxRate}%`
                                        return (
                                            <tr key={item.productId} className="border-b border-border-muted align-top transition-colors hover:bg-surface-subtle">
                                                <td className="px-2 py-1.5 tabular-nums text-muted">{index + 1}</td>
                                                <td className="min-w-0 px-2 py-1.5">
                                                    <span className="block truncate font-medium text-ink" title={item.name}>{item.name}</span>
                                                    <span className="block truncate text-[10px] text-muted" title={sroInfo ? `${saleType} — ${sroInfo}` : saleType}>
                                                        <span className="xl:hidden">{item.hsCode} · </span>
                                                        <span className="md:hidden">{fmt(item.price)} × {item.quantity} · {rate} · </span>
                                                        {saleType}
                                                    </span>
                                                </td>
                                                <td className="hidden truncate px-2 py-1.5 font-mono text-[11px] text-muted xl:table-cell">{item.hsCode}</td>
                                                <td className="hidden whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-ink md:table-cell">{fmt(item.price)}</td>
                                                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-ink">{item.quantity}</td>
                                                <td className="hidden truncate px-2 py-1.5 text-ink md:table-cell" title={`Tax ${item.taxRate}%`}>{rate}</td>
                                                <td className="hidden whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-ink xl:table-cell">{item.discount > 0 ? fmt(item.discount) : '—'}</td>
                                                <td className="hidden whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-muted sm:table-cell">{fmt(getItemSalesTax(item))}</td>
                                                <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold tabular-nums text-ink">{fmt(getItemLineTotal(item))}</td>
                                                <td className="px-1 py-1.5 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(item.productId)}
                                                        className="mx-auto flex h-5 w-5 items-center justify-center rounded text-[10px] text-muted transition-colors hover:bg-error-bg hover:text-error"
                                                        title="Remove item"
                                                        aria-label={`Remove ${item.name}`}
                                                    >✕</button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* ══ RIGHT: Checkout ══ */}
                <div className="flex shrink-0 flex-col border-t border-border bg-surface shadow-[0_-4px_16px_rgba(0,0,0,0.04)] lg:w-80 lg:border-l lg:border-t-0 lg:shadow-none xl:w-88">
                    {/* Details: always shown on desktop, collapsible on small screens */}
                    <div className="hidden min-h-0 flex-1 overflow-y-auto p-3 lg:block">
                        {checkoutFields}
                    </div>
                    {showDetails && (
                        <div className="max-h-[45vh] overflow-y-auto border-b border-border p-3 lg:hidden">
                            {checkoutFields}
                        </div>
                    )}

                    {/* Totals + action */}
                    <div className="space-y-2 p-3 lg:border-t lg:border-border">
                        <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                                <span className="text-muted">Subtotal</span>
                                <span className="tabular-nums text-ink">{fmt(subtotal())}</span>
                            </div>
                            {discountTotal() > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-muted">Discount</span>
                                    <span className="tabular-nums text-success">−{fmt(discountTotal())}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-muted">Sales Tax</span>
                                <span className="tabular-nums text-ink">{fmt(taxAmount())}</span>
                            </div>
                        </div>
                        <div className="flex items-baseline justify-between rounded-lg bg-ink px-3 py-2 text-white">
                            <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Total PKR</span>
                            <span className="text-xl font-bold tabular-nums">{fmt(total())}</span>
                        </div>

                        {message && (
                            <div className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${message.type === 'success' ? 'border border-success-border bg-success-bg text-success' : 'border border-error-border bg-error-bg text-error'}`}>
                                {message.text}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setShowDetails((open) => !open)}
                                aria-expanded={showDetails}
                                className="shrink-0 rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-medium text-ink-secondary transition-colors hover:text-ink lg:hidden"
                            >
                                {showDetails ? 'Hide details' : 'Details'}
                            </button>
                            <button
                                type="button"
                                onClick={handleDraft}
                                disabled={items.length === 0 || draftLoading}
                                className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {draftLoading ? 'Saving…' : 'Save Draft'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Customer Modal */}
            {showCustomerModal && (
                <CustomerModal
                    selectedCustomer={selectedCustomer}
                    onSelectCustomer={c => setCustomer(c)}
                    onClearCustomer={() => setCustomer(null)}
                    onSaveNewCustomer={handleSaveNewCustomerFromModal}
                    onClose={() => setShowCustomerModal(false)}
                />
            )}

            {/* Product Modal */}
            {showProductModal && (
                <DirectProductModal
                    onCreate={handleProductSaved}
                    onClose={() => setShowProductModal(false)}
                />
            )}
        </>
    )
}
