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

export default function POSPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [search, setSearch] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const {
        items,
        buyerName,
        buyerNTN,
        buyerPhone,
        paymentMethod,
        addItem,
        removeItem,
        updateQuantity,
        updateDiscount,
        setBuyerInfo,
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
                    <input
                        type="text"
                        placeholder="Buyer Name (optional)"
                        value={buyerName}
                        onChange={(e) => setBuyerInfo({ buyerName: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500"
                    />
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="NTN"
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
