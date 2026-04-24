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
    unit: string
    diSaleType?: string | null
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
        addItem, removeItem, updateQuantity, updateDiscount,
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
    useEffect(() => { fetch('/api/tenant/profile').then(r => r.json()).then(d => { if (d.preferredIdType) setPreferredIdType(d.preferredIdType) }).catch(() => { }) }, [])

    useEffect(() => {
        const timer = setTimeout(() => searchProducts(search), 300)
        return () => clearTimeout(timer)
    }, [search, searchProducts])

    useEffect(() => {
        setValidationState('IDLE')
        setValidationLog(null)
    }, [items, customerId, paymentMethod, buyerNTN, buyerRegistrationType, invoiceType, invoiceRefNo])

    function handleAddProduct(product: Product) {
        addItem({ productId: product.id, name: product.name, hsCode: product.hsCode, price: product.price, taxRate: product.taxRate, unit: product.unit })
    }

    function handleProductSaved(p: SavedProduct) {
        setShowProductModal(false)
        // add to search results and add to cart
        setProducts(prev => {
            if (prev.some(x => x.id === p.id)) return prev
            return [{ id: p.id, name: p.name, hsCode: p.hsCode, price: p.price, taxRate: p.taxRate, unit: p.unit }, ...prev]
        })
        addItem({ productId: p.id, name: p.name, hsCode: p.hsCode, price: p.price, taxRate: p.taxRate, unit: p.unit })
    }

    async function handleSaveNewCustomerFromModal(form: { name: string; ntnCnic: string; phone: string; province: string; registrationType: string; address: string }) {
        const res = await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: form.name.trim(), ntnCnic: form.ntnCnic || undefined, phone: form.phone || undefined, province: form.province || undefined, address: form.address || undefined, registrationType: form.registrationType || undefined }),
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
                setValidationLog({
                    error: valData.error || 'Validation rejected by FBR',
                    details: valData.errors || valData.details,
                    rawResponse: valData.rawResponse,
                    payload: valData.payload
                })
                setMessage({ type: 'error', text: 'FBR Validation failed. Check logs below.' })
            }
        } catch (e) {
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
                setValidationLog({
                    error: d.error || 'Submission failed',
                    details: d.details || d.errors,
                    rawResponse: d.rawResponse,
                    payload: d.payload
                })
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

    const selectedCustomer = customerId ? { id: customerId, name: buyerName, ntnCnic: buyerNTN || null, registrationType: buyerRegistrationType || null } : null

    return (
        <>
            <div className="flex h-screen flex-col overflow-hidden xl:flex-row">

                {/* ── Left: Product Search ── */}
                <div className="flex min-h-0 flex-1 flex-col border-b border-white/10 bg-[linear-gradient(180deg,rgba(7,20,15,0.96),rgba(6,14,11,0.98))] xl:border-b-0 xl:border-r">
                    {/* Search header */}
                    <div className="border-b border-white/10 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Point of Sale</p>
                            </div>
                            <button
                                onClick={() => setShowProductModal(true)}
                                className="shrink-0 rounded-full border border-[rgba(200,164,90,0.3)] bg-[rgba(200,164,90,0.08)] px-3 py-1.5 text-xs font-medium text-[#f0d9a0] hover:bg-[rgba(200,164,90,0.15)] transition-colors"
                            >
                                + New Product
                            </button>
                        </div>
                        <input
                            type="text"
                            placeholder="Search products by name, SKU, HS code…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="mt-3 w-full rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-white placeholder:text-[#8d897d]"
                        />
                    </div>

                    {/* Product grid */}
                    <div className="flex-1 overflow-auto p-4">
                        {products.length === 0 ? (
                            <div className="mt-12 text-center">
                                <p className="text-[#8d897d]">No products found.</p>
                                <button onClick={() => setShowProductModal(true)} className="mt-3 text-sm text-[#f0d9a0] underline underline-offset-2">Add your first product →</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                                {products.map(product => (
                                    <button
                                        key={product.id}
                                        onClick={() => handleAddProduct(product)}
                                        className="min-w-0 rounded-2xl border border-white/10 bg-white/6 p-4 text-left transition-colors hover:border-[rgba(200,164,90,0.4)] hover:bg-white/8"
                                    >
                                        <p className="truncate text-sm font-medium text-white">{product.name}</p>
                                        <p className="mt-0.5 break-all text-xs text-[#8d897d]">{product.hsCode}</p>
                                        {product.diSaleType && (
                                            <p className="mt-0.5 truncate text-xs text-[#c8a45a]">{product.diSaleType}</p>
                                        )}
                                        <div className="mt-2 flex items-center justify-between gap-3">
                                            <span className="min-w-0 text-sm font-bold text-[#f0d9a0]">PKR {product.price.toLocaleString()}</span>
                                            <span className="shrink-0 text-xs text-[#8d897d]">{product.taxRate}% Tax</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right: Cart + Fixed Bottom ── */}
                <div className="flex w-full shrink-0 flex-col bg-[linear-gradient(180deg,rgba(8,23,18,0.98),rgba(5,13,10,0.98))] xl:w-96">
                    {/* Cart header */}
                    <div className="border-b border-white/10 p-4">
                        <div className="flex items-center justify-between">
                            <h2 className="brand-heading text-xl font-bold text-white">Cart ({items.length})</h2>
                            {/* Invoice type */}
                            <div className="flex gap-1">
                                {(['Sale Invoice', 'Debit Note'] as const).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setInvoiceType(t)}
                                        className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${invoiceType === t ? 'bg-[#c8a45a]/20 text-[#f0d9a0]' : 'text-[#8d897d] hover:text-white'}`}
                                    >
                                        {t === 'Sale Invoice' ? 'Sale' : 'Debit Note'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {invoiceType === 'Debit Note' && (
                            <input
                                value={invoiceRefNo}
                                onChange={e => setInvoiceRefNo(e.target.value)}
                                placeholder="Original FBR Invoice Number (22 or 28 chars)"
                                className="mt-2 w-full rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-white placeholder:text-[#8d897d]"
                            />
                        )}
                    </div>

                    {/* Cart items */}
                    <div className="min-h-0 flex-1 overflow-auto p-4 space-y-2">
                        {items.length === 0 ? (
                            <p className="mt-8 text-center text-[#8d897d]">Cart is empty</p>
                        ) : (
                            items.map(item => (
                                <div key={item.productId} className="rounded-2xl border border-white/10 bg-white/6 p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-white">{item.name}</p>
                                            <p className="text-xs text-[#8d897d]">PKR {item.price.toLocaleString()} × {item.quantity}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 ml-2">
                                            <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="flex h-6 w-6 items-center justify-center rounded bg-white/10 text-sm text-white hover:bg-white/16">−</button>
                                            <input
                                                type="number"
                                                min={1}
                                                value={item.quantity}
                                                onChange={e => {
                                                    const val = Number(e.target.value)
                                                    if (!isNaN(val) && val > 0) updateQuantity(item.productId, val)
                                                }}
                                                className="w-16 text-center text-sm text-white bg-transparent border border-white/10 rounded"
                                            />
                                            <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="flex h-6 w-6 items-center justify-center rounded bg-white/10 text-sm text-white hover:bg-white/16">+</button>
                                            <button onClick={() => removeItem(item.productId)} className="flex h-6 w-6 items-center justify-center rounded bg-red-900/40 text-xs text-red-300 hover:bg-red-900/70">✕</button>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <label className="text-xs text-[#8d897d]">Disc:</label>
                                        <input type="number" min={0} step="0.01" value={item.discount || ''} onChange={e => updateDiscount(item.productId, Number(e.target.value) || 0)} placeholder="0"
                                            className="w-20 rounded border border-white/10 bg-white/8 px-2 py-0.5 text-xs text-white placeholder:text-[#8d897d]" />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* ── Fixed Bottom: Customer + Totals + Actions ── */}
                    <div className="shrink-0 border-t border-white/10">
                        {/* Customer */}
                        <div className="px-4 pt-3 pb-2">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold uppercase tracking-wider text-[#f0d9a0]">Customer</p>
                                <button type="button" onClick={() => setShowCustomerModal(true)} className="text-xs text-[#c1bcaf] hover:text-white">
                                    {customerId ? 'Change' : '+ Add/Search'}
                                </button>
                            </div>
                            {customerId && (
                                <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/8 px-3 py-2">
                                    <span className="text-green-400">✓</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-white">{buyerName}</p>
                                        {buyerNTN && <p className="font-mono text-xs text-[#8d897d]">{buyerNTN}</p>}
                                    </div>
                                    {buyerRegistrationType && (
                                        <span className="shrink-0 rounded bg-green-500/10 px-1.5 py-0.5 text-xs text-green-400">{buyerRegistrationType}</span>
                                    )}
                                </div>
                            )}
                            {/* // : (
                            // <div className="space-y-2">
                            //     <input type="text" placeholder="Buyer Name (optional)" value={buyerName} onChange={e => setBuyerInfo({ buyerName: e.target.value })}
                            //         className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-sm text-white placeholder:text-[#8d897d]" />
                            //     <div className="grid grid-cols-2 gap-2">
                            //         <input type="text" placeholder={`${preferredIdType}/CNIC`} value={buyerNTN} onChange={e => setBuyerInfo({ buyerNTN: normalizeNtnCnic(e.target.value) })}
                            //             inputMode="numeric" maxLength={13}
                            //             className="min-w-0 rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-sm text-white placeholder:text-[#8d897d]" />
                            //         <select value={buyerRegistrationType} onChange={e => setBuyerInfo({ buyerRegistrationType: e.target.value as 'Registered' | 'Unregistered' | '' })}
                            //             className="min-w-0 rounded-xl border border-white/10 bg-[#0e1d17] px-3 py-1.5 text-sm text-white">
                            //             <option value="">Reg Type</option>
                            //             <option value="Registered">Registered</option>
                            //             <option value="Unregistered">Unregistered</option>
                            //         </select>
                            //     </div>
                            // </div>
                            // )} */}
                        </div>

                        {/* Payment method */}
                        <div className="px-4 pb-2">
                            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as 'CASH' | 'CARD' | 'BANK_TRANSFER')}
                                className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-sm text-white">
                                <option value="CASH">Cash</option>
                                <option value="CARD">Card</option>
                                <option value="BANK_TRANSFER">Bank Transfer</option>
                            </select>
                        </div>

                        {/* Totals */}
                        <div className="border-t border-white/10 px-4 pt-3 pb-2">
                            <div className="flex justify-between text-sm text-[#c1bcaf] mb-1">
                                <span>Subtotal</span><span>PKR {subtotal().toLocaleString()}</span>
                            </div>
                            {discountTotal() > 0 && (
                                <div className="flex justify-between text-sm text-green-400 mb-1">
                                    <span>Discount</span><span>- PKR {discountTotal().toLocaleString()}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm text-[#c1bcaf] mb-1">
                                <span>Sales Tax</span><span>PKR {taxAmount().toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold text-white">
                                <span>Total</span><span>PKR {total().toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Message */}
                        {message && (
                            <div className={`mx-4 mb-2 rounded-lg p-2 text-xs ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                                {message.text}
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2 px-4 pb-4">
                            {validationState === 'VALID' ? (
                                <>
                                    <button
                                        onClick={() => setValidationState('IDLE')}
                                        className="flex-1 rounded-full border border-white/10 py-2.5 text-sm font-medium text-[#c1bcaf] transition-colors hover:bg-white/6"
                                    >
                                        Edit Details
                                    </button>
                                    <button
                                        onClick={handleConfirmSubmit}
                                        disabled={isConfirming}
                                        className="flex-[2] rounded-full bg-green-500/20 border border-green-500/30 py-2.5 text-sm font-bold text-green-400 transition-colors hover:bg-green-500/30 disabled:opacity-50"
                                    >
                                        {isConfirming ? 'Submitting…' : 'Confirm & Submit to FBR'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={handleDraft}
                                        disabled={items.length === 0 || draftLoading || isValidating || isConfirming}
                                        className="flex-1 rounded-full border border-white/10 py-2.5 text-sm font-medium text-[#c1bcaf] transition-colors hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        {draftLoading ? 'Saving…' : 'Save Draft'}
                                    </button>
                                    <button
                                        onClick={handleValidate}
                                        disabled={items.length === 0 || isValidating || draftLoading || isConfirming}
                                        className="flex-[2] rounded-full bg-accent py-2.5 text-sm font-medium text-primary transition-colors hover:bg-[--accent-soft] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-[#8d897d]"
                                    >
                                        {isValidating ? 'Validating…' : `Validate FBR (PKR ${total().toLocaleString()})`}
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Validation Error Logs Display */}
                        {validationState === 'FAILED' && validationLog && (
                            <div className="mx-4 mb-4 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs">
                                <h4 className="font-bold text-red-400 mb-1">Validation Errors</h4>
                                <p className="text-red-300 mb-2">{validationLog.error}</p>
                                {validationLog.details && (
                                    <div className="max-h-32 overflow-y-auto mb-2 text-[#d8d0bf] bg-black/40 p-2 rounded">
                                        <pre className="whitespace-pre-wrap font-mono text-[10px] m-0">{JSON.stringify(validationLog.details, null, 2)}</pre>
                                    </div>
                                )}
                                <details className="text-[#8d897d]">
                                    <summary className="cursor-pointer hover:text-[#c1bcaf]">View Payload & Raw FBR Response</summary>
                                    <div className="mt-2 space-y-2">
                                        <div>
                                            <p className="font-semibold mb-1">Requested Payload:</p>
                                            <div className="max-h-40 overflow-y-auto bg-black/40 p-2 rounded">
                                                <pre className="whitespace-pre-wrap font-mono text-[10px] m-0">{JSON.stringify(validationLog.payload, null, 2)}</pre>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="font-semibold mb-1">FBR Raw Response:</p>
                                            <div className="max-h-40 overflow-y-auto bg-black/40 p-2 rounded">
                                                <pre className="whitespace-pre-wrap font-mono text-[10px] m-0">{JSON.stringify(validationLog.rawResponse, null, 2)}</pre>
                                            </div>
                                        </div>
                                    </div>
                                </details>
                            </div>
                        )}
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
                <ProductFormModal
                    onSave={handleProductSaved}
                    onClose={() => setShowProductModal(false)}
                />
            )}
        </>
    )
}
