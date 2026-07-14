'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useCartStore } from '@/stores/cart'
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

    const {
        items, buyerName, buyerNTN, buyerProvince, buyerAddress,
        buyerRegistrationType, customerId, paymentMethod,
        addItem, removeItem,
        setBuyerInfo, setCustomer, setPaymentMethod,
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

    return (
        <>
            <div className="flex h-[calc(100vh-6rem)] flex-col lg:flex-row overflow-hidden bg-canvas">

                {/* ══ LEFT SIDE: Cart Items ══ */}
                <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-canvas">
                    {/* TOP BAR */}
                    <div className="shrink-0 border-b border-border bg-surface px-6 py-4 flex items-center justify-between gap-4">
                        <div>
                            <h1 className="text-lg font-semibold text-ink">POS Terminal</h1>
                            <p className="text-xs text-muted">Manage items and draft FBR invoices</p>
                        </div>
                        <button
                            onClick={() => setShowProductModal(true)}
                            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark shadow-sm shrink-0 flex items-center gap-1.5"
                        >
                            <span>+ Add Product</span>
                        </button>
                    </div>

                    {/* CART ITEMS (scrollable) */}
                    <div className="min-h-0 flex-1 overflow-auto">
                        {items.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center bg-card m-6 rounded-2xl border border-dashed border-border-strong">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-3xl">🛒</div>
                                <div>
                                    <p className="text-base font-medium text-ink-secondary">Cart is empty</p>
                                    <p className="text-sm text-muted">Click the button below to add your first product to this sale</p>
                                </div>
                                <button
                                    onClick={() => setShowProductModal(true)}
                                    className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark shadow-sm"
                                >
                                    + Add Product
                                </button>
                            </div>
                        ) : (
                            <div className="p-6">
                                <table className="w-full border-collapse text-sm table-fixed bg-white rounded-2xl overflow-hidden border border-border shadow-card">
                                    <thead>
                                        <tr className="border-b border-border bg-surface sticky top-0 z-10">
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-caps text-muted w-[34%]">Product</th>
                                            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-caps text-muted w-[14%]">Unit Price</th>
                                            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-caps text-muted w-[8%]">Qty</th>
                                            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-caps text-muted w-[12%]">Rate</th>
                                            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-caps text-muted w-[12%]">Discount</th>
                                            <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-caps text-muted w-[16%]">Total</th>
                                            <th className="px-3 py-3 w-10" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, idx) => {
                                            return (
                                                <tr key={item.productId} className={`border-b border-border-muted transition-colors hover:bg-surface-subtle ${idx % 2 === 0 ? '' : 'bg-surface-subtle/40'}`}>
                                                    {/* Product */}
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-ink truncate">{item.name}</p>
                                                        <p className="text-xs text-muted font-mono truncate">{item.hsCode}</p>
                                                        <p className="text-[11px] text-muted truncate">{item.diSaleType || 'Goods at standard rate (default)'}</p>
                                                        {(item.sroScheduleNo || item.sroItemSerialNo) && (
                                                            <p className="text-[11px] text-muted truncate">
                                                                SRO: {item.sroScheduleNo || 'N/A'} · SR#: {item.sroItemSerialNo || 'N/A'}
                                                            </p>
                                                        )}
                                                    </td>

                                                    {/* Unit Price */}
                                                    <td className="px-3 py-3">
                                                        <span className="text-sm font-medium text-ink">PKR {item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                                    </td>

                                                    {/* Qty */}
                                                    <td className="px-3 py-3">
                                                        <span className="text-sm font-medium text-ink">{item.quantity}</span>
                                                    </td>

                                                    {/* Rate */}
                                                    <td className="px-3 py-3">
                                                        <p className="text-sm font-medium text-ink">{(item.diRate ?? '').trim() || `${item.taxRate}%`}</p>
                                                        <p className="text-xs text-muted">Tax {item.taxRate}%</p>
                                                    </td>

                                                    {/* Discount */}
                                                    <td className="px-3 py-3">
                                                        <span className="text-sm text-ink">PKR {item.discount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                                    </td>

                                                    {/* Total */}
                                                    <td className="px-3 py-3 text-right">
                                                        <p className="text-sm font-bold text-ink">PKR {getItemLineTotal(item).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                                                        <p className="text-xs text-muted">+{getItemSalesTax(item).toLocaleString(undefined, { maximumFractionDigits: 2 })} tax</p>
                                                    </td>

                                                    {/* Remove */}
                                                    <td className="px-3 py-3 text-center">
                                                        <button
                                                            onClick={() => removeItem(item.productId)}
                                                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-error-bg text-xs text-error transition-colors hover:bg-error hover:text-white mx-auto"
                                                        >✕</button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* ══ RIGHT SIDE: Checkout Sidebar ══ */}
                <div className="w-full lg:w-96 shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-surface flex flex-col p-6 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] overflow-y-auto">
                    
                    {/* Customer Section */}
                    <div className="mb-6">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">Customer Details</label>
                        <button
                            type="button"
                            onClick={() => setShowCustomerModal(true)}
                            className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left transition-colors hover:border-border-strong"
                        >
                            {customerId ? (
                                <>
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary font-bold text-sm">
                                        {buyerName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-ink">{buyerName}</span>
                                        {buyerNTN ? (
                                            <span className="block font-mono text-xs text-muted">{buyerNTN}</span>
                                        ) : (
                                            <span className="block text-xs text-muted">Walk-in Customer</span>
                                        )}
                                    </div>
                                    {buyerRegistrationType && (
                                        <span className="shrink-0 rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                                            {buyerRegistrationType}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border-strong text-muted text-sm">+</span>
                                    <span className="text-sm text-muted">Add / Select Customer</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Invoice Configuration */}
                    <div className="mb-6 space-y-4">
                        <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">Invoice Type</label>
                            <div className="flex gap-1 rounded-xl border border-border bg-canvas p-1">
                                {(['Sale Invoice', 'Debit Note'] as const).map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setInvoiceType(t)}
                                        className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${invoiceType === t ? 'bg-primary text-white shadow-sm' : 'text-ink-secondary hover:text-ink'}`}
                                    >{t}</button>
                                ))}
                            </div>
                        </div>

                        {invoiceType === 'Debit Note' && (
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">FBR Invoice Reference #</label>
                                <input
                                    value={invoiceRefNo}
                                    onChange={e => setInvoiceRefNo(e.target.value)}
                                    placeholder="Original Invoice Number (22/28 chars)"
                                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-primary"
                                />
                            </div>
                        )}

                        <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">Payment Method</label>
                            <select
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value as 'CASH' | 'CARD' | 'BANK_TRANSFER')}
                                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-primary"
                            >
                                <option value="CASH">Cash</option>
                                <option value="CARD">Card</option>
                                <option value="BANK_TRANSFER">Bank Transfer</option>
                            </select>
                        </div>
                    </div>

                    {/* Summary & Checkout Actions */}
                    <div className="mt-auto border-t border-border pt-6 space-y-4">
                        <div className="space-y-2.5">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted">Subtotal</span>
                                <span className="font-medium text-ink">PKR {subtotal().toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                            
                            <div className="flex justify-between text-sm">
                                <span className="text-muted">Discount</span>
                                {discountTotal() > 0 ? (
                                    <span className="font-semibold text-success">−PKR {discountTotal().toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                ) : (
                                    <span className="text-muted">—</span>
                                )}
                            </div>

                            <div className="flex justify-between text-sm">
                                <span className="text-muted">Sales Tax</span>
                                <span className="font-medium text-ink">PKR {taxAmount().toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>

                            <div className="flex justify-between items-baseline border-t border-border-muted pt-3">
                                <span className="text-sm font-semibold text-ink">Total</span>
                                <span className="text-2xl font-bold text-primary">PKR {total().toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>

                        {/* Message banner */}
                        {message && (
                            <div className={`rounded-xl p-3 text-xs font-medium ${message.type === 'success' ? 'bg-success-bg text-success border border-success-border' : 'bg-error-bg text-error border border-error-border'}`}>
                                {message.text}
                            </div>
                        )}

                        {/* Save Draft Action */}
                        <button
                            type="button"
                            onClick={handleDraft}
                            disabled={items.length === 0 || draftLoading}
                            className="w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {draftLoading ? 'Saving…' : 'Save Draft'}
                        </button>
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
