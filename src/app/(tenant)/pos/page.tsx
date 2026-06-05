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
    const [catalogProducts, setCatalogProducts] = useState<Product[]>([])
    const [localProducts, setLocalProducts] = useState<Product[]>([])
    const [search, setSearch] = useState('')
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

    const searchProducts = useCallback(async (q: string) => {
        try {
            const res = await fetch(`/api/products?q=${encodeURIComponent(q)}&limit=30`)
            if (res.ok) {
                const data = await res.json()
                setCatalogProducts(data.data || [])
            }
        } catch { /* ignore */ }
    }, [])

    const products = useMemo(() => {
        const byId = new Map<string, Product>()
        for (const product of localProducts) {
            byId.set(product.id, product)
        }
        for (const product of catalogProducts) {
            if (!byId.has(product.id)) {
                byId.set(product.id, product)
            }
        }
        return Array.from(byId.values())
    }, [catalogProducts, localProducts])

    const filteredProducts = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return products
        return products.filter((product) => (
            product.name.toLowerCase().includes(term)
            || product.hsCode.toLowerCase().includes(term)
            || (product.diSaleType || '').toLowerCase().includes(term)
        ))
    }, [products, search])

    useEffect(() => { searchProducts('') }, [searchProducts])
    useEffect(() => {
        const timer = setTimeout(() => searchProducts(search), 300)
        return () => clearTimeout(timer)
    }, [search, searchProducts])

    function handleAddProduct(product: Product) {
        addItem({
            productId: product.id,
            name: product.name,
            hsCode: product.hsCode,
            price: product.price,
            taxRate: product.taxRate,
            diRate: product.diRate ?? null,
            diSaleType: product.diSaleType ?? null,
            diFixedNotifiedValueOrRetailPrice: product.diFixedNotifiedValueOrRetailPrice ?? null,
            sroScheduleNo: product.sroScheduleNo ?? null,
            sroItemSerialNo: product.sroItemSerialNo ?? null,
            isLocalOnly: Boolean(product.isLocalOnly),
            unit: product.unit,
            valueSalesExcludingST: product.valueSalesExcludingST,
            salesTaxApplicable: product.salesTaxApplicable,
            furtherTax: product.furtherTax,
            fedPayable: product.fedPayable,
            extraTax: product.extraTax,
            totalTax: product.totalTax,
            totalInvoiceValue: product.totalInvoiceValue,
            furtherTaxPercent: product.furtherTaxPercent,
            fedPercent: product.fedPercent,
            extraTaxPercent: product.extraTaxPercent,
            isExempt: product.isExempt,
        })
    }

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
            <div className="flex h-[calc(100vh-6rem)] flex-col overflow-hidden bg-canvas">

                {/* ══ TOP BAR: Customer | Search | New Product ══ */}
                <div className="shrink-0 border-b border-border bg-surface px-4 py-3">
                    <div className="flex items-center gap-3">

                        {/* Customer selector */}
                        <button
                            type="button"
                            onClick={() => setShowCustomerModal(true)}
                            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-border-strong"
                        >
                            {customerId ? (
                                <>
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-micro text-white">✓</span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-ink">{buyerName}</span>
                                        {buyerNTN && <span className="block font-mono text-xs text-muted">{buyerNTN}</span>}
                                    </span>
                                    {buyerRegistrationType && (
                                        <span className="shrink-0 rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary">
                                            {buyerRegistrationType}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-border-strong text-xs text-muted">+</span>
                                    <span className="text-sm text-muted">Add Customer</span>
                                </>
                            )}
                        </button>

                        {/* Product search with dropdown */}
                        <div className="relative flex min-w-0 flex-2 flex-col">
                            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
                                <svg className="h-4 w-4 shrink-0 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search products by name, SKU, HS code…"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
                                />
                                {search && (
                                    <button onClick={() => setSearch('')} className="shrink-0 text-muted hover:text-ink">✕</button>
                                )}
                            </div>
                            {search && filteredProducts.length > 0 && (
                                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-xl border border-border bg-card shadow-modal">
                                    {filteredProducts.map(product => (
                                        <button
                                            key={product.id}
                                            onClick={() => { handleAddProduct(product); setSearch('') }}
                                            className="flex w-full items-center gap-3 border-b border-border-muted px-4 py-2.5 text-left last:border-0 hover:bg-surface"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-ink">{product.name}</p>
                                                <p className="text-xs text-muted">{product.hsCode}{product.diSaleType ? ` · ${product.diSaleType}` : ''}</p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="text-sm font-semibold text-ink">PKR {product.price.toLocaleString()}</p>
                                                <p className="text-xs text-muted">{product.taxRate}% tax</p>
                                                {product.isLocalOnly && <p className="text-micro font-medium uppercase tracking-wider text-amber-600">Local Only</p>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {search && filteredProducts.length === 0 && (
                                <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted shadow-card">
                                    No products found for &ldquo;{search}&rdquo;
                                </div>
                            )}
                        </div>

                        {/* New product button */}
                        <button
                            onClick={() => setShowProductModal(true)}
                            className="shrink-0 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-ink-secondary transition-colors hover:border-primary hover:text-primary"
                        >
                            + New Product
                        </button>
                    </div>
                </div>

                {/* ══ CART ITEMS (scrollable) ══ */}
                <div className="min-h-0 flex-1 overflow-auto">
                    {items.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-3xl">🛒</div>
                            <p className="text-base font-medium text-ink-secondary">Cart is empty</p>
                            <p className="text-sm text-muted">Search and add products above</p>
                        </div>
                    ) : (
                        <div>
                            <table className="w-full border-collapse text-sm table-fixed">
                                <thead>
                                    <tr className="border-b border-border bg-surface sticky top-0 z-10">
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-caps text-muted w-[34%]">Product</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-caps text-muted w-[14%]">Unit Price</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-caps text-muted w-[8%]">Qty</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-caps text-muted w-[12%]">Rate</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-caps text-muted w-[12%]">Discount</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-caps text-muted w-[16%]">Total</th>
                                        <th className="px-3 py-2.5 w-10" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => {
                                        return (
                                            <tr key={item.productId} className={`border-b border-border-muted transition-colors hover:bg-surface-subtle ${idx % 2 === 0 ? '' : 'bg-surface-subtle/40'}`}>
                                                {/* Product */}
                                                <td className="px-4 py-2.5">
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
                                                <td className="px-3 py-2.5">
                                                    <span className="text-sm font-medium text-ink">PKR {item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                                </td>

                                                {/* Qty */}
                                                <td className="px-3 py-2.5">
                                                    <span className="text-sm font-medium text-ink">{item.quantity}</span>
                                                </td>

                                                {/* Rate */}
                                                <td className="px-3 py-2.5">
                                                    <p className="text-sm font-medium text-ink">{(item.diRate ?? '').trim() || `${item.taxRate}%`}</p>
                                                    <p className="text-xs text-muted">Tax {item.taxRate}%</p>
                                                </td>

                                                {/* Discount */}
                                                <td className="px-3 py-2.5">
                                                    <span className="text-sm text-ink">PKR {item.discount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                                </td>

                                                {/* Total */}
                                                <td className="px-3 py-2.5 text-right">
                                                    <p className="text-sm font-bold text-ink">PKR {getItemLineTotal(item).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                                                    <p className="text-xs text-muted">+{getItemSalesTax(item).toLocaleString(undefined, { maximumFractionDigits: 2 })} tax</p>
                                                </td>

                                                {/* Remove */}
                                                <td className="px-3 py-2.5 text-center">
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

                {/* ══ FIXED BOTTOM PANEL ══ */}
                <div className="shrink-0 z-20 border-t border-border bg-surface shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">

                    {/* Invoice type + payment */}
                    <div className="flex items-center gap-3 border-b border-border-muted px-4 py-2.5">
                        <div className="flex gap-1 rounded-lg border border-border bg-canvas p-0.5">
                            {(['Sale Invoice', 'Debit Note'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setInvoiceType(t)}
                                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${invoiceType === t ? 'bg-primary text-white shadow-sm' : 'text-ink-secondary hover:text-ink'}`}
                                >{t}</button>
                            ))}
                        </div>
                        <select
                            value={paymentMethod}
                            onChange={e => setPaymentMethod(e.target.value as 'CASH' | 'CARD' | 'BANK_TRANSFER')}
                            className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-primary"
                        >
                            <option value="CASH">Cash</option>
                            <option value="CARD">Card</option>
                            <option value="BANK_TRANSFER">Bank Transfer</option>
                        </select>
                    </div>

                    {invoiceType === 'Debit Note' && (
                        <div className="border-b border-border-muted px-4 py-2">
                            <input
                                value={invoiceRefNo}
                                onChange={e => setInvoiceRefNo(e.target.value)}
                                placeholder="Original FBR Invoice Number (22 or 28 chars)"
                                className="w-full rounded-lg border border-accent/40 bg-accent-light px-3 py-2 text-xs text-ink placeholder:text-muted focus:outline-none"
                            />
                        </div>
                    )}

                    {/* Totals row */}
                    <div className="grid grid-cols-4 divide-x divide-border-muted px-4 py-3">
                        <div className="pr-3">
                            <p className="text-xs ">Subtotal</p>
                            <p className="text-sm font-semibold text-ink">PKR {subtotal().toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="px-3">
                            <p className="text-xs">Discount</p>
                            {discountTotal() > 0
                                ? <p className="text-sm font-semibold text-success">−PKR {discountTotal().toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                                : <p className="text-sm font-semibold ">—</p>
                            }
                        </div>
                        <div className="px-3">
                            <p className="text-xs">Sales Tax</p>
                            <p className="text-sm font-semibold text-ink">PKR {taxAmount().toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="pl-3">
                            <p className="text-xs">Total</p>
                            <p className="text-base font-bold text-primary">PKR {total().toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        </div>
                    </div>

                    {/* Message banner */}
                    {message && (
                        <div className={`mx-4 mb-2 rounded-lg p-2 text-xs ${message.type === 'success' ? 'bg-success-bg text-success border border-success-border' : 'bg-error-bg text-error border border-error-border'}`}>
                            {message.text}
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 px-4 pb-4">
                        <button
                            onClick={handleDraft}
                            disabled={items.length === 0 || draftLoading}
                            className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
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
