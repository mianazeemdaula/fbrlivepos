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
            {/* Header */}
            <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <p className="text-xs font-medium uppercase tracking-caps text-muted">Catalog Management</p>
                    <h1 className="mt-1 text-page-title font-normal text-ink">Products</h1>
                </div>
                <button
                    onClick={handleAddNew}
                    className="rounded-full bg-primary px-5 py-2.5 text-ui-xs font-medium text-white hover:bg-primary-dark transition-colors"
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
                        <tr className="border-b border-border-muted">
                            <th className="px-4 py-3 text-left text-ui-xs font-normal text-muted">Name</th>
                            <th className="px-4 py-3 text-left text-ui-xs font-normal text-muted">SKU</th>
                            <th className="px-4 py-3 text-left text-ui-xs font-normal text-muted">HS Code</th>
                            <th className="px-4 py-3 text-left text-ui-xs font-normal text-muted">Price</th>
                            <th className="px-4 py-3 text-left text-ui-xs font-normal text-muted">Tax %</th>
                            <th className="px-4 py-3 text-left text-ui-xs font-normal text-muted">Unit</th>
                            <th className="px-4 py-3 text-left text-ui-xs font-normal text-muted">DI Ready</th>
                            <th className="px-4 py-3 text-left text-ui-xs font-normal text-muted">Status</th>
                            <th className="px-4 py-3 text-left text-ui-xs font-normal text-muted">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <tr key={i} className="border-b border-border-muted">
                                    <td colSpan={9} className="px-4 py-3">
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
                                    <td className="px-4 py-3 text-sm font-medium text-ink">{p.name}</td>
                                    <td className="px-4 py-3 text-ui-xs text-muted font-mono">{p.sku || '—'}</td>
                                    <td className="px-4 py-3 text-ui-xs text-muted font-mono">{p.hsCode}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-ink">PKR {Number(p.price).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-ui-xs text-muted">{Number(p.taxRate)}%</td>
                                    <td className="px-4 py-3 text-ui-xs text-muted">{p.unit}</td>
                                    <td className="px-4 py-3 align-top">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${p.diReady ? 'bg-success-bg text-success' : 'bg-accent-light text-warning'}`}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                                            {p.diReady ? 'Ready' : 'Needs fields'}
                                        </span>
                                        {!p.diReady && p.diIssues.length > 0 && (
                                            <div className="mt-1.5 text-xs text-warning max-w-xs space-y-0.5">
                                                {p.diIssues.slice(0, 2).map((issue) => <p key={issue}>{issue}</p>)}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${p.isActive ? 'bg-success-bg text-success' : 'bg-error-bg text-error'}`}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                                            {p.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => handleEditProduct(p)}
                                            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors"
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
