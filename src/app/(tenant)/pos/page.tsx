'use client'

import { useEffect, useState, useCallback } from 'react'
import { useCartStore } from '@/stores/cart'

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

    async function handleSubmit() {
        if (items.length === 0) return
        setSubmitting(true)
        setMessage(null)

        try {
            // Create invoice
            const invoiceRes = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    buyerName: buyerName || undefined,
                    buyerNTN: buyerNTN || undefined,
                    buyerPhone: buyerPhone || undefined,
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
        <div className="flex h-screen">
            {/* Product Search Panel */}
            <div className="flex-1 flex flex-col bg-slate-950 border-r border-slate-800">
                <div className="p-4 border-b border-slate-800">
                    <input
                        type="text"
                        placeholder="Search products by name, SKU..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                <div className="flex-1 overflow-auto p-4">
                    {products.length === 0 ? (
                        <p className="text-center text-slate-500 mt-8">No products found</p>
                    ) : (
                        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                            {products.map((product) => (
                                <button
                                    key={product.id}
                                    onClick={() => handleAddProduct(product)}
                                    className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl p-4 text-left transition-colors"
                                >
                                    <p className="text-sm font-medium text-white truncate">{product.name}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{product.hsCode}</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-sm font-bold text-blue-400">
                                            PKR {product.price.toLocaleString()}
                                        </span>
                                        <span className="text-xs text-slate-500">{product.taxRate}% Tax</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Cart Panel */}
            <div className="w-96 flex flex-col bg-slate-900">
                <div className="p-4 border-b border-slate-800">
                    <h2 className="text-lg font-bold text-white">Cart ({items.length})</h2>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-2">
                    {items.length === 0 ? (
                        <p className="text-center text-slate-500 mt-8">Cart is empty</p>
                    ) : (
                        items.map((item) => (
                            <div
                                key={item.productId}
                                className="bg-slate-800 rounded-lg p-3"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{item.name}</p>
                                        <p className="text-xs text-slate-400">
                                            PKR {item.price.toLocaleString()} × {item.quantity}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-2">
                                        <button
                                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                            className="w-6 h-6 rounded bg-slate-700 text-white text-sm flex items-center justify-center hover:bg-slate-600"
                                        >
                                            −
                                        </button>
                                        <span className="text-sm text-white w-6 text-center">{item.quantity}</span>
                                        <button
                                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                            className="w-6 h-6 rounded bg-slate-700 text-white text-sm flex items-center justify-center hover:bg-slate-600"
                                        >
                                            +
                                        </button>
                                        <button
                                            onClick={() => removeItem(item.productId)}
                                            className="w-6 h-6 rounded bg-red-900/50 text-red-400 text-xs flex items-center justify-center hover:bg-red-900"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    <label className="text-xs text-slate-500">Discount:</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={item.discount || ''}
                                        onChange={(e) => updateDiscount(item.productId, Number(e.target.value) || 0)}
                                        placeholder="0"
                                        className="w-24 bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-xs text-white placeholder-slate-500"
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Buyer Info */}
                <div className="p-4 border-t border-slate-800 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-slate-400 font-medium">Buyer / Customer</label>
                        {customerId && (
                            <button
                                onClick={() => { setCustomer(null); setCustomerSearch('') }}
                                className="text-xs text-red-400 hover:text-red-300"
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
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500"
                        />
                        {showCustomerDropdown && customerResults.length > 0 && (
                            <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 max-h-40 overflow-auto">
                                {customerResults.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => {
                                            setCustomer(c)
                                            setCustomerSearch(c.name)
                                            setShowCustomerDropdown(false)
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-slate-700 text-sm border-b border-slate-700/50 last:border-0"
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="text-white">{c.name}</span>
                                            {c.fbrVerified && (
                                                <span className="text-xs bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded">
                                                    {c.registrationType}
                                                </span>
                                            )}
                                        </div>
                                        {c.ntnCnic && (
                                            <span className="text-xs text-slate-400 font-mono">{c.ntnCnic}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <input
                        type="text"
                        placeholder="Buyer Name"
                        value={buyerName}
                        onChange={(e) => setBuyerInfo({ buyerName: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500"
                    />
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="NTN/CNIC"
                            value={buyerNTN}
                            onChange={(e) => setBuyerInfo({ buyerNTN: e.target.value })}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500"
                        />
                        <input
                            type="text"
                            placeholder="Phone"
                            value={buyerPhone}
                            onChange={(e) => setBuyerInfo({ buyerPhone: e.target.value })}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500"
                        />
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={buyerProvince}
                            onChange={(e) => setBuyerInfo({ buyerProvince: e.target.value })}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
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
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
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
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500"
                    />
                    <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'CARD' | 'BANK_TRANSFER')}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                    >
                        <option value="CASH">Cash</option>
                        <option value="CARD">Card</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                    </select>
                </div>

                {/* Totals */}
                <div className="p-4 border-t border-slate-800">
                    <div className="flex justify-between text-sm text-slate-400 mb-1">
                        <span>Subtotal</span>
                        <span>PKR {subtotal().toLocaleString()}</span>
                    </div>
                    {discountTotal() > 0 && (
                        <div className="flex justify-between text-sm text-green-400 mb-1">
                            <span>Discount</span>
                            <span>- PKR {discountTotal().toLocaleString()}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-sm text-slate-400 mb-2">
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
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium text-lg"
                    >
                        {submitting ? 'Processing...' : `Charge PKR ${total().toLocaleString()}`}
                    </button>
                </div>
            </div>
        </div>
    )
}
