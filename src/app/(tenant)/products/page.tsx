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
        <div className="p-4 lg:p-6">
            {/* Header */}
            <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-page-title font-semibold tracking-tight text-ink">Products</h1>
                </div>
                <button
                    onClick={handleAddNew}
                    className="rounded-lg bg-primary px-5 py-2.5 text-ui-xs font-medium text-white hover:bg-primary-dark transition-colors"
                >
                    + Define New Product
                </button>
            </div>

            {showModal && (
                <ProductFormModal
                    editingProductId={editingProduct?.id}
                    initialValues={initialValues}
                    onSave={handleSave}
                    onClose={() => { setShowModal(false); setEditingProduct(null) }}
                />
            )}

            {/* Search */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                    className="w-full max-w-md rounded-input border border-border bg-white px-4 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-primary"
                />
            </div>

            {/* Table card */}
            <div className="bg-white rounded-card shadow-card overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border bg-surface-subtle">
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">Name</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">SKU</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">HS Code</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">Price</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">Tax %</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">Unit</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">DI Ready</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">Status</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <tr key={i} className="border-b border-border-muted">
                                    <td colSpan={9} className="px-3 py-2">
                                        <div className="h-4 bg-border rounded-full animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : products.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-12 text-center text-muted text-sm">
                                    No products. Add your first product to see it here.
                                </td>
                            </tr>
                        ) : (
                            products.map((p) => (
                                <tr key={p.id} className="border-b border-border-muted transition-colors hover:bg-surface-subtle">
                                    <td className="px-3 py-2 text-sm font-medium text-ink">{p.name}</td>
                                    <td className="px-3 py-2 text-ui-xs text-muted font-mono">{p.sku || '—'}</td>
                                    <td className="px-3 py-2 text-ui-xs text-muted font-mono">{p.hsCode}</td>
                                    <td className="px-3 py-2 text-sm font-medium text-ink">PKR {Number(p.price).toLocaleString()}</td>
                                    <td className="px-3 py-2 text-ui-xs text-muted">{Number(p.taxRate)}%</td>
                                    <td className="px-3 py-2 text-ui-xs text-muted">{p.unit}</td>
                                    <td className="px-3 py-2">
                                        <span
                                            title={!p.diReady && p.diIssues.length > 0 ? p.diIssues.join(' · ') : undefined}
                                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${p.diReady ? 'bg-success-bg text-success' : 'bg-accent-light text-warning cursor-help'}`}
                                        >
                                            {p.diReady ? 'Ready' : p.diIssues.length === 1 ? 'Needs 1 field' : p.diIssues.length > 1 ? `Needs ${p.diIssues.length} fields` : 'Needs fields'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${p.isActive ? 'bg-success-bg text-success' : 'bg-error-bg text-error'}`}>
                                            {p.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <button
                                            onClick={() => handleEditProduct(p)}
                                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors"
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
