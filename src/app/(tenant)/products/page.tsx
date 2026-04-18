'use client'

import { useEffect, useState } from 'react'

interface Product {
    id: string
    name: string
    sku: string | null
    hsCode: string
    price: number
    taxRate: number
    unit: string
    isActive: boolean
}

interface HSCodeOption {
    id: string
    code: string
    description: string
    category: string
    unit: string
    defaultTaxRate: number | string
}

interface ProductFormState {
    name: string
    sku: string
    hsCodeId: string
    description: string
    price: string
    taxRate: string
    unit: string
}

const initialFormState: ProductFormState = {
    name: '',
    sku: '',
    hsCodeId: '',
    description: '',
    price: '',
    taxRate: '18',
    unit: 'PCS',
}

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [hsCodes, setHsCodes] = useState<HSCodeOption[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [hsCodeSearch, setHsCodeSearch] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [formLoading, setFormLoading] = useState(false)
    const [hsCodesLoading, setHsCodesLoading] = useState(false)
    const [error, setError] = useState('')
    const [form, setForm] = useState<ProductFormState>(initialFormState)

    async function loadProducts() {
        setLoading(true)
        try {
            const res = await fetch(`/api/products?q=${encodeURIComponent(search)}&limit=100`)
            if (res.ok) {
                const data = await res.json()
                setProducts(data.data || [])
            }
        } catch {
            // Ignore
        } finally {
            setLoading(false)
        }
    }

    async function loadHSCodes(query = '') {
        setHsCodesLoading(true)
        try {
            const res = await fetch(`/api/hs-codes/search?q=${encodeURIComponent(query)}`)
            if (res.ok) {
                const data = (await res.json()) as HSCodeOption[]
                setHsCodes(data)
            }
        } catch {
            // Ignore
        } finally {
            setHsCodesLoading(false)
        }
    }

    useEffect(() => {
        loadProducts()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search])

    useEffect(() => {
        if (!showForm) return

        const timer = setTimeout(() => {
            loadHSCodes(hsCodeSearch)
        }, 250)

        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showForm, hsCodeSearch])

    function handleFormToggle() {
        const next = !showForm
        setShowForm(next)
        setError('')

        if (!next) {
            setForm(initialFormState)
            setHsCodeSearch('')
            return
        }

        setForm(initialFormState)
        loadHSCodes('')
    }

    function handleFormChange<K extends keyof ProductFormState>(field: K, value: ProductFormState[K]) {
        setForm((current) => ({ ...current, [field]: value }))
    }

    function handleHSCodeSelect(hsCodeId: string) {
        const selected = hsCodes.find((item) => item.id === hsCodeId)
        setForm((current) => ({
            ...current,
            hsCodeId,
            taxRate: selected ? String(selected.defaultTaxRate) : current.taxRate,
            unit: selected?.unit ?? current.unit,
        }))
    }

    async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setFormLoading(true)
        setError('')

        const data = {
            name: form.name,
            sku: form.sku || undefined,
            hsCodeId: form.hsCodeId,
            description: form.description || undefined,
            price: parseFloat(form.price),
            taxRate: parseFloat(form.taxRate),
            unit: form.unit,
        }

        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })

            if (!res.ok) {
                const result = await res.json()
                setError(result.error || 'Failed to create product')
                return
            }

            setShowForm(false)
            setForm(initialFormState)
            setHsCodeSearch('')
            loadProducts()
        } catch {
            setError('Network error')
        } finally {
            setFormLoading(false)
        }
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">Products</h1>
                <button
                    onClick={handleFormToggle}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                    {showForm ? 'Cancel' : '+ Add Product'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleCreate} className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm rounded-lg p-3 mb-4">
                            {error}
                        </div>
                    )}
                    <div className="mb-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Find HS Code</label>
                            <input
                                value={hsCodeSearch}
                                onChange={(e) => setHsCodeSearch(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                placeholder="Search by code or description"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Select HS Code</label>
                            <select
                                name="hsCodeId"
                                required
                                value={form.hsCodeId}
                                onChange={(e) => handleHSCodeSelect(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                            >
                                <option value="">
                                    {hsCodesLoading ? 'Loading HS codes...' : hsCodes.length === 0 ? 'No HS codes available' : 'Choose a managed HS code'}
                                </option>
                                {hsCodes.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.code} - {item.description}
                                    </option>
                                ))}
                            </select>
                            {form.hsCodeId && (
                                <p className="mt-1 text-xs text-slate-500">
                                    {hsCodes.find((item) => item.id === form.hsCodeId)?.category || 'Uncategorized'}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Name</label>
                            <input
                                name="name"
                                required
                                value={form.name}
                                onChange={(e) => handleFormChange('name', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                placeholder="Product name"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">SKU</label>
                            <input
                                name="sku"
                                value={form.sku}
                                onChange={(e) => handleFormChange('sku', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                placeholder="SKU-001"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">HS Code</label>
                            <input
                                value={hsCodes.find((item) => item.id === form.hsCodeId)?.code || ''}
                                readOnly
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                placeholder="Select from managed list"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Price (PKR)</label>
                            <input
                                name="price"
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={form.price}
                                onChange={(e) => handleFormChange('price', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Tax Rate (%)</label>
                            <input
                                name="taxRate"
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                required
                                value={form.taxRate}
                                onChange={(e) => handleFormChange('taxRate', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Unit of Measure</label>
                            <select
                                name="unit"
                                required
                                value={form.unit}
                                onChange={(e) => handleFormChange('unit', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                            >
                                <option value="PCS">PCS (Pieces)</option>
                                <option value="KG">KG (Kilograms)</option>
                                <option value="LTR">LTR (Litres)</option>
                                <option value="MTR">MTR (Metres)</option>
                                <option value="SQM">SQM (Square Metres)</option>
                                <option value="SET">SET</option>
                                <option value="PKT">PKT (Packet)</option>
                                <option value="BOX">BOX</option>
                                <option value="DOZ">DOZ (Dozen)</option>
                                <option value="NOS">NOS (Numbers)</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs text-slate-400 mb-1">Description (optional)</label>
                            <input
                                name="description"
                                value={form.description}
                                onChange={(e) => handleFormChange('description', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                placeholder="Product description"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={formLoading}
                        className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-2 rounded-lg text-sm font-medium"
                    >
                        {formLoading ? 'Creating...' : 'Create Product'}
                    </button>
                </form>
            )}

            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500"
                />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-800">
                            <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Name</th>
                            <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">SKU</th>
                            <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">HS Code</th>
                            <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Price</th>
                            <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Tax %</th>
                            <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Unit</th>
                            <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <tr key={i} className="border-b border-slate-800/50">
                                    <td colSpan={7} className="px-4 py-3">
                                        <div className="h-4 bg-slate-800 rounded animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : products.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                                    No products. Add your first product above.
                                </td>
                            </tr>
                        ) : (
                            products.map((p) => (
                                <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                    <td className="px-4 py-3 text-sm text-white">{p.name}</td>
                                    <td className="px-4 py-3 text-sm text-slate-400 font-mono">{p.sku || '—'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-400 font-mono">{p.hsCode}</td>
                                    <td className="px-4 py-3 text-sm text-white">PKR {Number(p.price).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-sm text-slate-400">{Number(p.taxRate)}%</td>
                                    <td className="px-4 py-3 text-sm text-slate-400">{p.unit}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full ${p.isActive
                                                ? 'bg-green-500/10 text-green-400'
                                                : 'bg-red-500/10 text-red-400'
                                                }`}
                                        >
                                            {p.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
