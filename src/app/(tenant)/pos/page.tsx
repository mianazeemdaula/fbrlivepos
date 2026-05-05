'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useCartStore } from '@/stores/cart'
import { isValidNtnCnic, normalizeNtnCnic } from '@/lib/validation/pakistan'
import { ProductFormModal, type SavedProduct } from '@/components/products/ProductFormModal'

const CustomerModal = dynamic(() => import('./CustomerModal'), { ssr: false })

interface Product {
    id: string
    name: string
    hsCode: string
    price: number
    taxRate: number
    diRate?: string | null // FBR rate string e.g. "18%", "Exempt"
    diSaleType?: string | null
    diFixedNotifiedValueOrRetailPrice?: number | null // 3rd Schedule: retail/notified price per unit
    unit: string
}

export default function POSPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [search, setSearch] = useState('')
    const [showCustomerModal, setShowCustomerModal] = useState(false)
    const [showProductModal, setShowProductModal] = useState(false)
    const [draftLoading, setDraftLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [isValidating, setIsValidating] = useState(false)
    const [validationState, setValidationState] = useState<'IDLE' | 'VALID' | 'FAILED'>('IDLE')
    const [validationLog, setValidationLog] = useState<{ error: string, details?: any, rawResponse?: any, payload?: any } | null>(null)
    const [draftInvoiceId, setDraftInvoiceId] = useState<string | null>(null)
    const [isConfirming, setIsConfirming] = useState(false)
    const [invoiceType, setInvoiceType] = useState<'Sale Invoice' | 'Debit Note'>('Sale Invoice')
    const [invoiceRefNo, setInvoiceRefNo] = useState('')
    const [preferredIdType, setPreferredIdType] = useState<string>('NTN')

    const {
        items, buyerName, buyerNTN, buyerProvince, buyerAddress,
        buyerRegistrationType, customerId, paymentMethod,
        addItem, removeItem, updateQuantity, updateDiscount, updatePrice, updateTaxRate,
        setBuyerInfo, setCustomer, setPaymentMethod,
        subtotal, discountTotal, taxAmount, total, clearCart,
    } = useCartStore()

    const searchProducts = useCallback(async (q: string) => {
        try {
            const res = await fetch(`/api/products?q=${encodeURIComponent(q)}&limit=30`)
            if (res.ok) {
                const data = await res.json()
                setProducts(data.data || [])
            }
        } catch { /* ignore */ }
    }, [])

    useEffect(() => { searchProducts('') }, [searchProducts])
    useEffect(() => {
        fetch('/api/tenant/profile').then(r => r.json()).then(d => {
            if (d.preferredIdType) setPreferredIdType(d.preferredIdType)
        }).catch(() => { })
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => searchProducts(search), 300)
        return () => clearTimeout(timer)
    }, [search, searchProducts])

    useEffect(() => {
        setValidationState('IDLE')
        setValidationLog(null)
    }, [items, customerId, paymentMethod, buyerNTN, buyerRegistrationType, invoiceType, invoiceRefNo])

    function handleAddProduct(product: Product) {
        addItem({ productId: product.id, name: product.name, hsCode: product.hsCode, price: product.price, taxRate: product.taxRate, diRate: product.diRate ?? null, diSaleType: product.diSaleType ?? null, diFixedNotifiedValueOrRetailPrice: product.diFixedNotifiedValueOrRetailPrice ?? null, unit: product.unit })
    }

    function handleProductSaved(p: SavedProduct) {
        setShowProductModal(false)
        setProducts(prev => {
            if (prev.some(x => x.id === p.id)) return prev
            return [{ id: p.id, name: p.name, hsCode: p.hsCode, price: p.price, taxRate: p.taxRate, diRate: p.diRate ?? null, diSaleType: p.diSaleType ?? null, diFixedNotifiedValueOrRetailPrice: p.diFixedNotifiedValueOrRetailPrice ?? null, unit: p.unit }, ...prev]
        })
        addItem({ productId: p.id, name: p.name, hsCode: p.hsCode, price: p.price, taxRate: p.taxRate, diRate: p.diRate ?? null, diSaleType: p.diSaleType ?? null, diFixedNotifiedValueOrRetailPrice: p.diFixedNotifiedValueOrRetailPrice ?? null, unit: p.unit })
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
            items: items.map(i => ({ productId: i.productId, quantity: i.quantity, discount: i.discount })),
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
            setDraftInvoiceId(data.invoice.id)
            setValidationState('IDLE')
            setValidationLog(null)
            clearCart()
        } catch { setMessage({ type: 'error', text: 'Network error.' }) } finally { setDraftLoading(false) }
    }

    async function handleValidate() {
        if (items.length === 0) return
        const norm = normalizeNtnCnic(buyerNTN)
        if (norm && !isValidNtnCnic(norm)) {
            setMessage({ type: 'error', text: `${preferredIdType} must be 7 digits (NTN) or 13 digits (CNIC).` })
            return
        }
        setIsValidating(true)
        setValidationLog(null)
        setValidationState('IDLE')
        setMessage(null)
        try {
            const body = { ...(await buildInvoiceBody()), status: 'DRAFT' }
            const res = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            const data = await res.json()
            if (!res.ok) { setMessage({ type: 'error', text: data.error || 'Failed to save invoice.' }); setIsValidating(false); return }
            const currentInvoiceId = data.invoice.id
            setDraftInvoiceId(currentInvoiceId)
            const valRes = await fetch('/api/tenant/fbr/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: currentInvoiceId }) })
            const valData = await valRes.json()
            if (valRes.ok && valData.valid) {
                setValidationState('VALID')
                setMessage({ type: 'success', text: 'Invoice verified successfully by FBR! Ready to submit.' })
            } else {
                setValidationState('FAILED')
                setValidationLog({ error: valData.error || 'Validation rejected by FBR', details: valData.errors || valData.details, rawResponse: valData.rawResponse, payload: valData.payload })
                setMessage({ type: 'error', text: 'FBR Validation failed. Check logs below.' })
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error during validation.' })
        } finally {
            setIsValidating(false)
        }
    }

    async function handleConfirmSubmit() {
        if (!draftInvoiceId) return
        setIsConfirming(true)
        setMessage(null)
        try {
            const diRes = await fetch('/api/tenant/fbr/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: draftInvoiceId }) })
            const d = await diRes.json().catch(() => ({}))
            if (!diRes.ok) {
                setMessage({ type: 'error', text: `DI submission failed: ${d.error ?? 'Unknown error.'}` })
                setValidationLog({ error: d.error || 'Submission failed', details: d.details || d.errors, rawResponse: d.rawResponse, payload: d.payload })
                setValidationState('FAILED')
                setIsConfirming(false)
                return
            }
            setMessage({ type: 'success', text: `Invoice ${d.diInvoiceNumber || 'submitted'} to FBR successfully!` })
            setDraftInvoiceId(null)
            setValidationState('IDLE')
            setValidationLog(null)
            clearCart()
        } catch { setMessage({ type: 'error', text: 'Network error during submission.' }) } finally { setIsConfirming(false) }
    }

    const selectedCustomer = customerId
        ? { id: customerId, name: buyerName, ntnCnic: buyerNTN || null, registrationType: buyerRegistrationType || null }
        : null

    return (
        <>
            <div className="flex h-screen flex-col overflow-hidden bg-canvas">

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
                            {search && products.length > 0 && (
                                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-xl border border-border bg-card shadow-modal">
                                    {products.map(product => (
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
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {search && products.length === 0 && (
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
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-180 border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-surface sticky top-0 z-10">
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-caps text-muted">Product</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-caps text-muted w-32">Unit Price</th>
                                        <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-caps text-muted w-32">Qty</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-caps text-muted w-24">Tax %</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-caps text-muted w-28">Discount</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-caps text-muted w-36">Total</th>
                                        <th className="px-3 py-2.5 w-10" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => {
                                        const lineBase = item.price * item.quantity
                                        const isThirdSchedule = item.diSaleType?.trim().toLowerCase() === '3rd schedule goods'
                                        const lineTax = isThirdSchedule && item.diFixedNotifiedValueOrRetailPrice != null
                                            ? (item.diFixedNotifiedValueOrRetailPrice * item.quantity * item.taxRate) / 100
                                            : ((lineBase - item.discount) * item.taxRate) / 100
                                        const lineTotal = lineBase - item.discount + lineTax
                                        return (
                                            <tr key={item.productId} className={`border-b border-border-muted transition-colors hover:bg-surface-subtle ${idx % 2 === 0 ? '' : 'bg-surface-subtle/40'}`}>
                                                {/* Product */}
                                                <td className="px-4 py-2.5">
                                                    <p className="font-medium text-ink truncate max-w-45">{item.name}</p>
                                                    <p className="text-xs text-muted font-mono">{item.hsCode}</p>
                                                </td>

                                                {/* Unit Price */}
                                                <td className="px-3 py-2.5">
                                                    <div className="flex items-center rounded-lg border border-border bg-card px-2 py-1.5 focus-within:border-primary">
                                                        <span className="shrink-0 text-xs text-muted mr-1">PKR</span>
                                                        <input
                                                            type="number" min={0} step="0.01" value={item.price}
                                                            onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) updatePrice(item.productId, v) }}
                                                            className="min-w-0 w-full bg-transparent text-sm font-medium text-ink focus:outline-none"
                                                        />
                                                    </div>
                                                </td>

                                                {/* Qty */}
                                                <td className="px-3 py-2.5">
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-sm text-ink-secondary hover:bg-canvas"
                                                        >−</button>
                                                        <input
                                                            type="number" min={1} value={item.quantity}
                                                            onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v > 0) updateQuantity(item.productId, v) }}
                                                            className="h-7 w-10 rounded-md border border-border bg-card text-center text-sm font-medium text-ink focus:outline-none focus:border-primary"
                                                        />
                                                        <button
                                                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-sm text-ink-secondary hover:bg-canvas"
                                                        >+</button>
                                                    </div>
                                                </td>

                                                {/* Tax % */}
                                                <td className="px-3 py-2.5">
                                                    <span className="text-sm font-medium text-ink">{item.diRate ?? `${item.taxRate}%`}</span>
                                                </td>

                                                {/* Discount */}
                                                <td className="px-3 py-2.5">
                                                    <div className="flex items-center rounded-lg border border-border bg-card px-2 py-1.5 focus-within:border-primary">
                                                        <span className="shrink-0 text-xs text-muted mr-1">PKR</span>
                                                        <input
                                                            type="number" min={0} step="0.01" value={item.discount || ''}
                                                            onChange={e => updateDiscount(item.productId, Number(e.target.value) || 0)}
                                                            placeholder="0"
                                                            className="min-w-0 w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
                                                        />
                                                    </div>
                                                </td>

                                                {/* Total */}
                                                <td className="px-3 py-2.5 text-right">
                                                    <p className="text-sm font-bold text-ink">PKR {lineTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                                                    <p className="text-xs text-muted">+{lineTax.toLocaleString(undefined, { maximumFractionDigits: 2 })} tax</p>
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
                <div className="shrink-0 border-t border-border bg-surface shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">

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
                        {validationState === 'VALID' ? (
                            <>
                                <button
                                    onClick={() => setValidationState('IDLE')}
                                    className="flex-1 rounded-full border border-border bg-canvas py-2.5 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface"
                                >Edit Details</button>
                                <button
                                    onClick={handleConfirmSubmit}
                                    disabled={isConfirming}
                                    className="flex-2 rounded-full bg-success py-2.5 text-sm font-bold text-white transition-colors hover:opacity-90 disabled:opacity-50"
                                >
                                    {isConfirming ? 'Submitting…' : 'Confirm & Submit to FBR'}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handleDraft}
                                    disabled={items.length === 0 || draftLoading || isValidating || isConfirming}
                                    className="flex-1 rounded-full border border-border bg-canvas py-2.5 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {draftLoading ? 'Saving…' : 'Save Draft'}
                                </button>
                                <button
                                    onClick={handleValidate}
                                    disabled={items.length === 0 || isValidating || draftLoading || isConfirming}
                                    className="flex-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {isValidating ? 'Validating…' : `Validate & FBR · PKR ${total().toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                                </button>
                            </>
                        )}
                    </div>

                    {/* Validation error logs */}
                    {validationState === 'FAILED' && validationLog && (
                        <div className="mx-4 mb-4 rounded-xl border border-error-border bg-error-bg p-3 text-xs">
                            <h4 className="font-bold text-error mb-1">Validation Errors</h4>
                            <p className="text-error mb-2">{validationLog.error}</p>
                            {validationLog.details && (
                                <div className="max-h-32 overflow-y-auto mb-2 rounded bg-code-bg p-2">
                                    <pre className="whitespace-pre-wrap font-mono text-micro text-green-400 m-0">{JSON.stringify(validationLog.details, null, 2)}</pre>
                                </div>
                            )}
                            <details className="text-muted">
                                <summary className="cursor-pointer hover:text-ink">View Payload &amp; Raw FBR Response</summary>
                                <div className="mt-2 space-y-2">
                                    <div>
                                        <p className="font-semibold mb-1 text-ink-secondary">Requested Payload:</p>
                                        <div className="max-h-40 overflow-y-auto rounded bg-code-bg p-2">
                                            <pre className="whitespace-pre-wrap font-mono text-micro text-green-400 m-0">{JSON.stringify(validationLog.payload, null, 2)}</pre>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="font-semibold mb-1 text-ink-secondary">FBR Raw Response:</p>
                                        <div className="max-h-40 overflow-y-auto rounded bg-code-bg p-2">
                                            <pre className="whitespace-pre-wrap font-mono text-micro text-green-400 m-0">{JSON.stringify(validationLog.rawResponse, null, 2)}</pre>
                                        </div>
                                    </div>
                                </div>
                            </details>
                        </div>
                    )}
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
                <ProductFormModal
                    onSave={handleProductSaved}
                    onClose={() => setShowProductModal(false)}
                />
            )}
        </>
    )
}
