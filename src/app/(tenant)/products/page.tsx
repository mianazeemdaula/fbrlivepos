'use client'

import { useEffect, useState, useCallback } from 'react'
import { PaginationControls } from '@/components/pagination-controls'
import { ProductFormModal, type SavedProduct } from '@/components/products/ProductFormModal'

interface ProductListItem {
    id: string
    name: string
    sku: string | null
    hsCodeId?: string | null
    hsCode: string
    description?: string | null
    price: number
    taxRate: number
    unit: string
    diRate: string | null
    diUOM: string | null
    diSaleType: string | null
    diFixedNotifiedValueOrRetailPrice: number | null
    diSalesTaxWithheldAtSource: number | null
    extraTax: number | null
    furtherTax: number | null
    fedPayable: number | null
    sroScheduleNo: string | null
    sroItemSerialNo: string | null
    diReady: boolean
    diIssues: string[]
    isActive: boolean
}

export default function ProductsPage() {
    const [products, setProducts] = useState<ProductListItem[]>([])
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)

    // Modal state
    const [showModal, setShowModal] = useState(false)
    const [editingProduct, setEditingProduct] = useState<ProductListItem | null>(null)

    const limit = 20

    const fetchProducts = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(search ? { q: search } : {}),
            })
            const res = await fetch(`/api/products?${params}`)
            if (res.ok) {
                const data = await res.json()
                setProducts(data.data || [])
                setTotal(data.meta?.total || 0)
            }
        } catch {
            // fail silently
        } finally {
            setLoading(false)
        }
    }, [page, search])

    useEffect(() => {
        fetchProducts()
    }, [fetchProducts])

    function handleEditProduct(p: ProductListItem) {
        setEditingProduct(p)
        setShowModal(true)
    }

    function handleAddNew() {
        setEditingProduct(null)
        setShowModal(true)
    }

    function handleSave(savedProduct: SavedProduct) {
        setShowModal(false)
        setEditingProduct(null)
        // Refresh products list
        fetchProducts()
    }

    // Prepare initial values for the modal if editing
    const initialValues = editingProduct ? {
        name: editingProduct.name,
        sku: editingProduct.sku || '',
        hsCodeId: editingProduct.hsCodeId || '',
        description: editingProduct.description || '',
        price: editingProduct.price.toString(),
        taxRate: editingProduct.taxRate.toString(),
        unit: editingProduct.unit,
        diRate: editingProduct.diRate || '',
        diUOM: editingProduct.diUOM || '',
        diSaleType: editingProduct.diSaleType || '',
        diFixedNotifiedValueOrRetailPrice: editingProduct.diFixedNotifiedValueOrRetailPrice?.toString() || '',
        diSalesTaxWithheldAtSource: editingProduct.diSalesTaxWithheldAtSource?.toString() || '',
        extraTax: editingProduct.extraTax?.toString() || '',
        furtherTax: editingProduct.furtherTax?.toString() || '',
        fedPayable: editingProduct.fedPayable?.toString() || '',
        sroScheduleNo: editingProduct.sroScheduleNo || '',
        sroItemSerialNo: editingProduct.sroItemSerialNo || '',
    } : undefined

    const totalPages = Math.ceil(total / limit)
    const from = (page - 1) * limit + 1
    const to = Math.min(page * limit, total)

    return (
        <div className="p-6 lg:p-8">
            <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Catalog Management</p>
                    <h1 className="brand-heading mt-2 text-3xl font-bold text-white">Products</h1>
                </div>
                <button
                    onClick={handleAddNew}
                    className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-primary shadow-lg shadow-accent/20 transition-all hover:bg-[--accent-soft] hover:shadow-accent/40"
                >
                    + Define New Product
                </button>
            </div>

            {showModal && (
                <ProductFormModal
                    editingProductId={editingProduct?.id}
                    initialValues={initialValues}
                    onSave={handleSave}
                    onClose={() => {
                        setShowModal(false)
                        setEditingProduct(null)
                    }}
                />
            )}

            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value)
                        setPage(1)
                    }}
                    className="w-full max-w-md rounded-xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white placeholder:text-[#8d897d]"
                />
            </div>

            <div className="app-panel rounded-xl overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="text-left text-xs font-medium text-[#c1bcaf] px-4 py-3">Name</th>
                            <th className="text-left text-xs font-medium text-[#c1bcaf] px-4 py-3">SKU</th>
                            <th className="text-left text-xs font-medium text-[#c1bcaf] px-4 py-3">HS Code</th>
                            <th className="text-left text-xs font-medium text-[#c1bcaf] px-4 py-3">Price</th>
                            <th className="text-left text-xs font-medium text-[#c1bcaf] px-4 py-3">Tax %</th>
                            <th className="text-left text-xs font-medium text-[#c1bcaf] px-4 py-3">Unit</th>
                            <th className="text-left text-xs font-medium text-[#c1bcaf] px-4 py-3">DI Ready</th>
                            <th className="text-left text-xs font-medium text-[#c1bcaf] px-4 py-3">Status</th>
                            <th className="text-left text-xs font-medium text-[#c1bcaf] px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <tr key={i} className="border-b border-white/8">
                                    <td colSpan={9} className="px-4 py-3">
                                        <div className="h-4 bg-white/10 rounded animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : products.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-12 text-center text-[#8d897d]">
                                    No products. Add your first product to see it here.
                                </td>
                            </tr>
                        ) : (
                            products.map((p) => (
                                <tr key={p.id} className="border-b border-white/8 hover:bg-white/4">
                                    <td className="px-4 py-3 text-sm text-white">{p.name}</td>
                                    <td className="px-4 py-3 text-sm text-[#c1bcaf] font-mono">{p.sku || '—'}</td>
                                    <td className="px-4 py-3 text-sm text-[#c1bcaf] font-mono">{p.hsCode}</td>
                                    <td className="px-4 py-3 text-sm text-white">PKR {Number(p.price).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-sm text-[#c1bcaf]">{Number(p.taxRate)}%</td>
                                    <td className="px-4 py-3 text-sm text-[#c1bcaf]">{p.unit}</td>
                                    <td className="px-4 py-3 align-top">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${p.diReady ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-300'}`}>
                                            {p.diReady ? 'Ready' : 'Needs PRAL fields'}
                                        </span>
                                        {!p.diReady && p.diIssues.length > 0 && (
                                            <div className="mt-2 text-xs text-amber-200 max-w-xs space-y-1">
                                                {p.diIssues.slice(0, 2).map((issue) => (
                                                    <p key={issue}>{issue}</p>
                                                ))}
                                            </div>
                                        )}
                                    </td>
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
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => handleEditProduct(p)}
                                            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/6 text-[#d8d0bf] hover:bg-white/12"
                                        >
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {!loading && total > 0 && (
                <PaginationControls
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    summary={`Showing ${from}-${to} of ${total.toLocaleString()} products`}
                />
            )}
        </div>
    )
}
