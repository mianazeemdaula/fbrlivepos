'use client'

import { useEffect, useState, useCallback } from 'react'
import { useCartStore } from '@/stores/cart'
import { isValidMobile, isValidNtnCnic, normalizeMobile, normalizeNtnCnic } from '@/lib/validation/pakistan'

interface Product {
    id: string
    name: string
    hsCode: string
    price: number
    taxRate: number
    unit: string
}

interface CustomerResult {
    id: string
    name: string
    ntnCnic: string | null
    email?: string | null
    phone: string | null
    province: string | null
    address: string | null
    registrationType: string | null
    fbrVerified: boolean
}

export default function POSPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [search, setSearch] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Customer search
    const [customerSearch, setCustomerSearch] = useState('')
    const [customerResults, setCustomerResults] = useState<CustomerResult[]>([])
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

    const {
        items,
        buyerName,
        buyerNTN,
        buyerPhone,
        buyerProvince,
        buyerAddress,
        buyerRegistrationType,
        customerId,
        paymentMethod,
        addItem,
        removeItem,
        updateQuantity,
        updateDiscount,
        setBuyerInfo,
        setCustomer,
        setPaymentMethod,
        subtotal,
        discountTotal,
        taxAmount,
        total,
        clearCart,
    } = useCartStore()

    const searchProducts = useCallback(async (q: string) => {
        try {
            const res = await fetch(`/api/products?q=${encodeURIComponent(q)}&limit=20`)
            if (res.ok) {
                const data = await res.json()
                setProducts(data.data || [])
            }
        } catch {
            // Ignore search errors
        }
    }, [])

    useEffect(() => {
        searchProducts('')
    }, [searchProducts])

    useEffect(() => {
        const timer = setTimeout(() => {
            searchProducts(search)
        }, 300)
        return () => clearTimeout(timer)
    }, [search, searchProducts])

    // Customer search
    useEffect(() => {
        if (!customerSearch || customerSearch.length < 2) {
            setCustomerResults([])
            return
        }
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/customers?q=${encodeURIComponent(customerSearch)}&limit=5`)
                if (res.ok) {
                    const data = await res.json()
                    setCustomerResults(data.data || [])
                    setShowCustomerDropdown(true)
                }
            } catch { /* ignore */ }
        }, 300)
        return () => clearTimeout(timer)
    }, [customerSearch])

    function handleAddProduct(product: Product) {
        addItem({
            productId: product.id,
            name: product.name,
            hsCode: product.hsCode,
            price: product.price,
            taxRate: product.taxRate,
            unit: product.unit,
        })
    }

    async function handleSaveCustomer() {
        const normalizedBuyerNTN = normalizeNtnCnic(buyerNTN)
        const normalizedBuyerPhone = normalizeMobile(buyerPhone)

        if (!buyerName.trim()) {
            setMessage({ type: 'error', text: 'Buyer name is required before saving a customer.' })
            return
        }

        if (normalizedBuyerNTN && !isValidNtnCnic(normalizedBuyerNTN)) {
            setMessage({ type: 'error', text: 'Buyer NTN/CNIC must be 7 digits for NTN or 13 digits for CNIC.' })
            return
        }

        if (normalizedBuyerPhone && !isValidMobile(normalizedBuyerPhone)) {
            setMessage({ type: 'error', text: 'Buyer mobile must be a valid Pakistani number like 03001234567.' })
            return
        }

        try {
            const res = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: buyerName.trim(),
                    ntnCnic: normalizedBuyerNTN || undefined,
                    phone: normalizedBuyerPhone || undefined,
                    province: buyerProvince || undefined,
                    address: buyerAddress || undefined,
                    registrationType: buyerRegistrationType || undefined,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                setMessage({ type: 'error', text: data.error || 'Failed to save customer.' })
                return
            }

            setCustomer(data.customer)
            setCustomerSearch(data.customer.name)
            setShowCustomerDropdown(false)
            setMessage({ type: 'success', text: `${data.customer.name} saved to customers.` })
        } catch {
            setMessage({ type: 'error', text: 'Failed to save customer.' })
        }
    }

    async function handleSubmit() {
        if (items.length === 0) return

        const normalizedBuyerNTN = normalizeNtnCnic(buyerNTN)
        const normalizedBuyerPhone = normalizeMobile(buyerPhone)

        if (normalizedBuyerNTN && !isValidNtnCnic(normalizedBuyerNTN)) {
            setMessage({ type: 'error', text: 'Buyer NTN/CNIC must be 7 digits for NTN or 13 digits for CNIC.' })
            return
        }

        if (normalizedBuyerPhone && !isValidMobile(normalizedBuyerPhone)) {
            setMessage({ type: 'error', text: 'Buyer mobile must be a valid Pakistani number like 03001234567.' })
            return
        }

        setSubmitting(true)
        setMessage(null)

        try {
            // Create invoice
            const invoiceRes = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    buyerName: buyerName || undefined,
                    buyerNTN: normalizedBuyerNTN || undefined,
                    buyerPhone: normalizedBuyerPhone || undefined,
                    buyerProvince: buyerProvince || undefined,
                    buyerAddress: buyerAddress || undefined,
                    buyerRegistrationType: buyerRegistrationType || undefined,
                    customerId: customerId || undefined,
                    paymentMethod,
                    items: items.map((item) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        discount: item.discount,
                    })),
                }),
            })

            const invoiceData = await invoiceRes.json()

            if (!invoiceRes.ok) {
                setMessage({ type: 'error', text: invoiceData.error || 'Failed to create invoice' })
                return
            }

            // Submit to PRAL DI
            try {
                const diRes = await fetch('/api/tenant/fbr/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ invoiceId: invoiceData.invoice.id }),
                })

                if (diRes.status === 401 || diRes.status === 422) {
                    const diData = await diRes.json().catch(() => ({}))
                    setMessage({
                        type: 'error',
                        text: `Invoice saved but PRAL DI submission failed: ${diData.error ?? 'Token unauthorized. Please update your credentials in Settings.'}`,
                    })
                    clearCart()
                    return
                }
            } catch {
                // DI submission failure is non-blocking — queued for retry
            }

            setMessage({
                type: 'success',
                text: `Invoice ${invoiceData.invoice.invoiceNumber} created successfully!`,
            })
            clearCart()
        } catch {
            setMessage({ type: 'error', text: 'Network error. Please try again.' })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex min-h-screen flex-col overflow-x-hidden xl:h-screen xl:flex-row">
            {/* Product Search Panel */}
            <div className="flex min-h-0 flex-1 flex-col border-b border-white/10 bg-[linear-gradient(180deg,rgba(7,20,15,0.96),rgba(6,14,11,0.98))] xl:border-b-0 xl:border-r">
                <div className="border-b border-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Point of sale</p>
                    <input
                        type="text"
                        placeholder="Search products by name, SKU..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="mt-3 w-full rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-white placeholder:text-[#8d897d]"
                    />
                </div>

                <div className="flex-1 overflow-auto p-4">
                    {products.length === 0 ? (
                        <p className="mt-8 text-center text-[#8d897d]">No products found</p>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                            {products.map((product) => (
                                <button
                                    key={product.id}
                                    onClick={() => handleAddProduct(product)}
                                    className="min-w-0 rounded-2xl border border-white/10 bg-white/6 p-4 text-left transition-colors hover:border-[rgba(200,164,90,0.4)] hover:bg-white/8"
                                >
                                    <p className="text-sm font-medium text-white truncate">{product.name}</p>
                                    <p className="mt-0.5 break-all text-xs text-[#8d897d]">{product.hsCode}</p>
                                    <div className="mt-2 flex items-center justify-between gap-3">
                                        <span className="min-w-0 text-sm font-bold text-[#f0d9a0]">
                                            PKR {product.price.toLocaleString()}
                                        </span>
                                        <span className="shrink-0 text-xs text-[#8d897d]">{product.taxRate}% Tax</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Cart Panel */}
            <div className="flex w-full min-w-0 shrink-0 flex-col bg-[linear-gradient(180deg,rgba(8,23,18,0.98),rgba(5,13,10,0.98))] xl:w-md">
                <div className="border-b border-white/10 p-4">
                    <h2 className="brand-heading text-2xl font-bold text-white">Cart ({items.length})</h2>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-2">
                    {items.length === 0 ? (
                        <p className="mt-8 text-center text-[#8d897d]">Cart is empty</p>
                    ) : (
                        items.map((item) => (
                            <div
                                key={item.productId}
                                className="rounded-2xl border border-white/10 bg-white/6 p-3"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{item.name}</p>
                                        <p className="text-xs text-[#8d897d]">
                                            PKR {item.price.toLocaleString()} × {item.quantity}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-2">
                                        <button
                                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                            className="flex h-6 w-6 items-center justify-center rounded bg-white/10 text-sm text-white hover:bg-white/16"
                                        >
                                            −
                                        </button>
                                        <span className="text-sm text-white w-6 text-center">{item.quantity}</span>
                                        <button
                                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                            className="flex h-6 w-6 items-center justify-center rounded bg-white/10 text-sm text-white hover:bg-white/16"
                                        >
                                            +
                                        </button>
                                        <button
                                            onClick={() => removeItem(item.productId)}
                                            className="flex h-6 w-6 items-center justify-center rounded bg-red-900/40 text-xs text-red-300 hover:bg-red-900/70"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    <label className="text-xs text-[#8d897d]">Discount:</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={item.discount || ''}
                                        onChange={(e) => updateDiscount(item.productId, Number(e.target.value) || 0)}
                                        placeholder="0"
                                        className="w-24 rounded border border-white/10 bg-white/8 px-2 py-0.5 text-xs text-white placeholder:text-[#8d897d]"
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Buyer Info */}
                <div className="space-y-2 border-t border-white/10 p-4">
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-[#c1bcaf]">Buyer / Customer</label>
                        {customerId && (
                            <button
                                onClick={() => { setCustomer(null); setCustomerSearch('') }}
                                className="text-xs text-red-300 hover:text-red-200"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search customer by name or NTN..."
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            onFocus={() => customerResults.length > 0 && setShowCustomerDropdown(true)}
                            className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-sm text-white placeholder:text-[#8d897d]"
                        />
                        {showCustomerDropdown && customerResults.length > 0 && (
                            <div className="absolute bottom-full left-0 right-0 z-10 mb-1 max-h-40 overflow-auto rounded-xl border border-white/10 bg-[#0e1d17] shadow-xl">
                                {customerResults.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => {
                                            setCustomer(c)
                                            setCustomerSearch(c.name)
                                            setShowCustomerDropdown(false)
                                        }}
                                        className="w-full border-b border-white/10 px-3 py-2 text-left text-sm hover:bg-white/6 last:border-0"
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="text-white">{c.name}</span>
                                            {c.fbrVerified && (
                                                <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-xs text-green-400">
                                                    {c.registrationType}
                                                </span>
                                            )}
                                        </div>
                                        {c.ntnCnic && (
                                            <span className="font-mono text-xs text-[#8d897d]">{c.ntnCnic}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {!customerId && buyerName.trim() && (
                        <button
                            type="button"
                            onClick={handleSaveCustomer}
                            className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm font-medium text-[#d8d0bf] hover:bg-white/10"
                        >
                            Save As Customer
                        </button>
                    )}
                    <input
                        type="text"
                        placeholder="Buyer Name"
                        value={buyerName}
                        onChange={(e) => setBuyerInfo({ buyerName: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-sm text-white placeholder:text-[#8d897d]"
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                            type="text"
                            placeholder="NTN/CNIC"
                            value={buyerNTN}
                            onChange={(e) => setBuyerInfo({ buyerNTN: normalizeNtnCnic(e.target.value) })}
                            inputMode="numeric"
                            maxLength={13}
                            className="min-w-0 rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-sm text-white placeholder:text-[#8d897d]"
                        />
                        <input
                            type="text"
                            placeholder="Phone"
                            value={buyerPhone}
                            onChange={(e) => setBuyerInfo({ buyerPhone: normalizeMobile(e.target.value) })}
                            inputMode="numeric"
                            maxLength={11}
                            className="min-w-0 rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-sm text-white placeholder:text-[#8d897d]"
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <select
                            value={buyerProvince}
                            onChange={(e) => setBuyerInfo({ buyerProvince: e.target.value })}
                            className="min-w-0 rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-sm text-white"
                        >
                            <option value="">Province</option>
                            <option value="Punjab">Punjab</option>
                            <option value="Sindh">Sindh</option>
                            <option value="Khyber Pakhtunkhwa">KPK</option>
                            <option value="Balochistan">Balochistan</option>
                            <option value="Islamabad">Islamabad</option>
                        </select>
                        <select
                            value={buyerRegistrationType}
                            onChange={(e) => setBuyerInfo({ buyerRegistrationType: e.target.value as 'Registered' | 'Unregistered' | '' })}
                            className="min-w-0 rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-sm text-white"
                        >
                            <option value="">Reg Type</option>
                            <option value="Registered">Registered</option>
                            <option value="Unregistered">Unregistered</option>
                        </select>
                    </div>
                    <input
                        type="text"
                        placeholder="Buyer Address"
                        value={buyerAddress}
                        onChange={(e) => setBuyerInfo({ buyerAddress: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-sm text-white placeholder:text-[#8d897d]"
                    />
                    {(buyerNTN || buyerPhone) && (
                        <div className="space-y-1 text-xs">
                            {buyerNTN && !isValidNtnCnic(buyerNTN) && (
                                <p className="text-amber-400">Buyer NTN/CNIC must be 7 digits for NTN or 13 digits for CNIC.</p>
                            )}
                            {buyerPhone && !isValidMobile(buyerPhone) && (
                                <p className="text-amber-400">Buyer phone must be in Pakistani mobile format, for example 03001234567.</p>
                            )}
                        </div>
                    )}
                    <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'CARD' | 'BANK_TRANSFER')}
                        className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-sm text-white"
                    >
                        <option value="CASH">Cash</option>
                        <option value="CARD">Card</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                    </select>
                </div>

                {/* Totals */}
                <div className="border-t border-white/10 p-4">
                    <div className="mb-1 flex justify-between text-sm text-[#c1bcaf]">
                        <span>Subtotal</span>
                        <span>PKR {subtotal().toLocaleString()}</span>
                    </div>
                    {discountTotal() > 0 && (
                        <div className="flex justify-between text-sm text-green-400 mb-1">
                            <span>Discount</span>
                            <span>- PKR {discountTotal().toLocaleString()}</span>
                        </div>
                    )}
                    <div className="mb-2 flex justify-between text-sm text-[#c1bcaf]">
                        <span>Tax (GST)</span>
                        <span>PKR {taxAmount().toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-white mb-4">
                        <span>Total</span>
                        <span>PKR {total().toLocaleString()}</span>
                    </div>

                    {message && (
                        <div
                            className={`text-sm rounded-lg p-2 mb-3 ${message.type === 'success'
                                ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                                : 'bg-red-500/10 text-red-400 border border-red-500/30'
                                }`}
                        >
                            {message.text}
                        </div>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={items.length === 0 || submitting}
                        className="w-full rounded-full bg-accent py-3 text-lg font-medium text-primary transition-colors hover:bg-(--accent-soft) disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-[#8d897d]"
                    >
                        {submitting ? 'Processing...' : `Charge PKR ${total().toLocaleString()}`}
                    </button>
                </div>
            </div>
        </div>
    )
}
