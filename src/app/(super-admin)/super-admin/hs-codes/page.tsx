'use client'

import { useEffect, useState, useCallback } from 'react'
import { PaginationControls } from '@/components/pagination-controls'
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    Eye,
    Upload,
    Download,
    X,
    Filter,
    AlertCircle,
    CheckCircle2,
    XCircle,
    FileSpreadsheet,
    Calendar,
    Tag,
} from 'lucide-react'

interface HSCode {
    id: string
    code: string
    description: string
    shortName: string | null
    category: string
    subCategory: string | null
    unit: string
    defaultTaxRate: string | number
    isFBRActive: boolean
    notes: string | null
    effectiveFrom: string | null
    effectiveTo: string | null
    createdAt: string
    updatedAt: string
}

interface FormState {
    code: string
    description: string
    shortName: string
    category: string
    subCategory: string
    unit: string
    defaultTaxRate: string
    isFBRActive: boolean
    notes: string
    effectiveFrom: string
    effectiveTo: string
}

const DEFAULT_FORM: FormState = {
    code: '',
    description: '',
    shortName: '',
    category: 'General',
    subCategory: '',
    unit: 'PCS',
    defaultTaxRate: '18',
    isFBRActive: true,
    notes: '',
    effectiveFrom: '',
    effectiveTo: '',
}

const UNITS = ['PCS', 'KG', 'LTR', 'MTR', 'SQM', 'SET', 'PAIR', 'BOX', 'CTN', 'DZN', 'KWH', 'TON', 'GM']

const LIMIT = 25

export default function HSCodesPage() {
    const [codes, setCodes] = useState<HSCode[]>([])
    const [categories, setCategories] = useState<string[]>([])
    const [loading, setLoading] = useState(true)

    // Search and filters
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)

    // UI state
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null)
    const [selectedCode, setSelectedCode] = useState<HSCode | null>(null)
    const [formData, setFormData] = useState<FormState>(DEFAULT_FORM)
    const [formLoading, setFormLoading] = useState(false)
    const [formError, setFormError] = useState('')

    // Delete modal state
    const [codeToDelete, setCodeToDelete] = useState<HSCode | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [deleteError, setDeleteError] = useState('')

    // Import / feedback state
    const [importLoading, setImportLoading] = useState(false)
    const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const loadCodes = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                q: search,
                category: categoryFilter,
                status: statusFilter,
                page: String(page),
                limit: String(LIMIT),
            })
            const res = await fetch(`/api/admin/hs-codes?${params.toString()}`)
            if (res.ok) {
                const data = await res.json()
                setCodes(data.data || [])
                setTotal(data.total ?? 0)
                setTotalPages(data.pages ?? 1)
                if (data.categories) {
                    setCategories(data.categories)
                }
            }
        } catch {
            showBanner('error', 'Failed to load HS Codes.')
        } finally {
            setLoading(false)
        }
    }, [search, categoryFilter, statusFilter, page])

    useEffect(() => {
        loadCodes()
    }, [loadCodes])

    function showBanner(type: 'success' | 'error', text: string) {
        setBannerMessage({ type, text })
        setTimeout(() => {
            setBannerMessage(null)
        }, 5000)
    }

    function openCreateModal() {
        setSelectedCode(null)
        setFormData(DEFAULT_FORM)
        setFormError('')
        setModalMode('create')
    }

    function openEditModal(code: HSCode) {
        setSelectedCode(code)
        setFormData({
            code: code.code,
            description: code.description,
            shortName: code.shortName || '',
            category: code.category,
            subCategory: code.subCategory || '',
            unit: code.unit,
            defaultTaxRate: String(code.defaultTaxRate),
            isFBRActive: code.isFBRActive,
            notes: code.notes || '',
            effectiveFrom: code.effectiveFrom ? code.effectiveFrom.slice(0, 10) : '',
            effectiveTo: code.effectiveTo ? code.effectiveTo.slice(0, 10) : '',
        })
        setFormError('')
        setModalMode('edit')
    }

    function openViewModal(code: HSCode) {
        setSelectedCode(code)
        setModalMode('view')
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setFormLoading(true)
        setFormError('')

        const payload = {
            code: formData.code.trim(),
            description: formData.description.trim(),
            shortName: formData.shortName.trim() || null,
            category: formData.category.trim() || 'General',
            subCategory: formData.subCategory.trim() || null,
            unit: formData.unit,
            defaultTaxRate: parseFloat(formData.defaultTaxRate) || 0,
            isFBRActive: formData.isFBRActive,
            notes: formData.notes.trim() || null,
            effectiveFrom: formData.effectiveFrom || null,
            effectiveTo: formData.effectiveTo || null,
        }

        try {
            const url = modalMode === 'edit' && selectedCode
                ? `/api/admin/hs-codes/${selectedCode.id}`
                : '/api/admin/hs-codes'
            const method = modalMode === 'edit' ? 'PATCH' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const data = await res.json()

            if (!res.ok) {
                setFormError(data.error || 'Failed to save HS Code.')
                return
            }

            setModalMode(null)
            showBanner('success', modalMode === 'edit' ? `HS Code "${payload.code}" updated successfully.` : `HS Code "${payload.code}" created successfully.`)
            loadCodes()
        } catch {
            setFormError('Network error while saving.')
        } finally {
            setFormLoading(false)
        }
    }

    async function handleToggleStatus(code: HSCode) {
        try {
            const res = await fetch(`/api/admin/hs-codes/${code.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isFBRActive: !code.isFBRActive }),
            })
            if (res.ok) {
                showBanner('success', `HS Code "${code.code}" is now ${!code.isFBRActive ? 'Active' : 'Inactive'}.`)
                loadCodes()
            } else {
                const data = await res.json()
                showBanner('error', data.error || 'Failed to update status.')
            }
        } catch {
            showBanner('error', 'Network error.')
        }
    }

    async function handleDeleteConfirm() {
        if (!codeToDelete) return
        setDeleteLoading(true)
        setDeleteError('')

        try {
            const res = await fetch(`/api/admin/hs-codes/${codeToDelete.id}`, {
                method: 'DELETE',
            })
            const data = await res.json()

            if (!res.ok) {
                setDeleteError(data.error || 'Failed to delete HS Code.')
                return
            }

            setCodeToDelete(null)
            showBanner('success', `HS Code "${codeToDelete.code}" deleted successfully.`)
            loadCodes()
        } catch {
            setDeleteError('Network error during deletion.')
        } finally {
            setDeleteLoading(false)
        }
    }

    async function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        setImportLoading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const res = await fetch('/api/admin/hs-codes/import', {
                method: 'POST',
                body: formData,
            })

            const data = await res.json()
            if (res.ok) {
                showBanner('success', `Imported ${data.imported} HS codes successfully.`)
                setPage(1)
                loadCodes()
            } else {
                showBanner('error', data.error || 'CSV Import failed')
            }
        } catch {
            showBanner('error', 'Failed to parse CSV file.')
        } finally {
            setImportLoading(false)
            e.target.value = ''
        }
    }

    function handleExportCSV() {
        if (codes.length === 0) {
            showBanner('error', 'No HS codes to export.')
            return
        }

        const headers = ['Code', 'Description', 'Short Name', 'Category', 'Sub Category', 'Unit', 'Tax Rate (%)', 'FBR Active', 'Notes']
        const rows = codes.map((c) => [
            `"${c.code.replace(/"/g, '""')}"`,
            `"${c.description.replace(/"/g, '""')}"`,
            `"${(c.shortName || '').replace(/"/g, '""')}"`,
            `"${c.category.replace(/"/g, '""')}"`,
            `"${(c.subCategory || '').replace(/"/g, '""')}"`,
            `"${c.unit}"`,
            c.defaultTaxRate,
            c.isFBRActive ? 'Yes' : 'No',
            `"${(c.notes || '').replace(/"/g, '""')}"`,
        ])

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement('a')
        link.setAttribute('href', encodedUri)
        link.setAttribute('download', `hscodes_export_${new Date().toISOString().slice(0, 10)}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const from = total === 0 ? 0 : (page - 1) * LIMIT + 1
    const to = Math.min(page * LIMIT, total)

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Tax & Tariff Administration</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Super Admin Only</span>
                    </div>
                    <h1 className="text-2xl font-bold text-ink tracking-tight mt-1">HS Code Master Library</h1>
                    <p className="text-sm text-muted">Manage Harmonized System (HS) codes, tax rates, UOM units, and FBR tax statuses across the platform.</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 rounded-xl border border-border bg-white px-3.5 py-2 text-xs font-medium text-ink hover:bg-surface transition-colors shadow-xs"
                    >
                        <Download size={14} />
                        Export CSV
                    </button>

                    <label
                        className={`flex items-center gap-1.5 cursor-pointer rounded-xl border border-border bg-white px-3.5 py-2 text-xs font-medium text-ink hover:bg-surface transition-colors shadow-xs ${
                            importLoading ? 'opacity-50 pointer-events-none' : ''
                        }`}
                    >
                        <Upload size={14} />
                        {importLoading ? 'Importing...' : 'Import CSV'}
                        <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
                    </label>

                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-primary-dark transition-colors"
                    >
                        <Plus size={15} />
                        Add HS Code
                    </button>
                </div>
            </div>

            {/* Notification Banner */}
            {bannerMessage && (
                <div
                    className={`flex items-center justify-between p-4 rounded-xl text-sm border ${
                        bannerMessage.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {bannerMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        <span>{bannerMessage.text}</span>
                    </div>
                    <button onClick={() => setBannerMessage(null)} className="text-muted hover:text-ink">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Search & Filter Toolbar */}
            <div className="bg-white rounded-2xl p-4 shadow-card border border-border flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                <div className="relative flex-1 max-w-md">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                        type="text"
                        placeholder="Search code, description, short name..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value)
                            setPage(1)
                        }}
                        className="w-full rounded-xl border border-border bg-surface-subtle pl-10 pr-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                    {search && (
                        <button
                            onClick={() => {
                                setSearch('')
                                setPage(1)
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Filter size={14} className="text-muted" />
                        <span className="text-xs text-muted font-medium">Category:</span>
                        <select
                            value={categoryFilter}
                            onChange={(e) => {
                                setCategoryFilter(e.target.value)
                                setPage(1)
                            }}
                            className="rounded-xl border border-border bg-white px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                            <option value="">All Categories</option>
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>
                                    {cat}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted font-medium">Status:</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value)
                                setPage(1)
                            }}
                            className="rounded-xl border border-border bg-white px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                            <option value="all">All Statuses</option>
                            <option value="active">Active Only</option>
                            <option value="inactive">Inactive Only</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* HS Code Data Table */}
            <div className="bg-white rounded-2xl shadow-card border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border bg-surface-subtle/50">
                                <th className="px-5 py-3.5 text-xs font-semibold text-muted uppercase tracking-wider">HS Code</th>
                                <th className="px-5 py-3.5 text-xs font-semibold text-muted uppercase tracking-wider">Description</th>
                                <th className="px-5 py-3.5 text-xs font-semibold text-muted uppercase tracking-wider">Category</th>
                                <th className="px-5 py-3.5 text-xs font-semibold text-muted uppercase tracking-wider">Unit</th>
                                <th className="px-5 py-3.5 text-xs font-semibold text-muted uppercase tracking-wider">Tax Rate</th>
                                <th className="px-5 py-3.5 text-xs font-semibold text-muted uppercase tracking-wider">FBR Status</th>
                                <th className="px-5 py-3.5 text-xs font-semibold text-muted uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-5 py-4">
                                            <div className="h-4 bg-surface rounded-md w-full" />
                                        </td>
                                    </tr>
                                ))
                            ) : codes.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-12 text-center">
                                        <div className="max-w-sm mx-auto space-y-2">
                                            <FileSpreadsheet className="w-10 h-10 mx-auto text-muted/50" />
                                            <p className="text-sm font-medium text-ink">No HS Codes found</p>
                                            <p className="text-xs text-muted">Try clearing search filters or add a new HS code manually.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                codes.map((code) => (
                                    <tr key={code.id} className="hover:bg-surface/50 transition-colors">
                                        <td className="px-5 py-3.5 font-mono text-xs font-semibold text-primary">
                                            {code.code}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-ink max-w-xs truncate" title={code.description}>
                                            <div className="font-medium text-ink">{code.description}</div>
                                            {code.shortName && <div className="text-xs text-muted truncate">{code.shortName}</div>}
                                        </td>
                                        <td className="px-5 py-3.5 text-xs text-muted">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-border text-ink font-medium">
                                                <Tag size={11} />
                                                {code.category || 'General'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-xs font-medium text-ink">
                                            {code.unit}
                                        </td>
                                        <td className="px-5 py-3.5 text-xs font-semibold text-ink">
                                            {code.defaultTaxRate}%
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <button
                                                onClick={() => handleToggleStatus(code)}
                                                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                                                    code.isFBRActive
                                                        ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                                                        : 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20'
                                                }`}
                                                title="Click to toggle active status"
                                            >
                                                {code.isFBRActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                                {code.isFBRActive ? 'Active' : 'Inactive'}
                                            </button>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => openViewModal(code)}
                                                    className="p-1.5 text-muted hover:text-primary hover:bg-surface rounded-lg transition-colors"
                                                    title="View details"
                                                >
                                                    <Eye size={15} />
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(code)}
                                                    className="p-1.5 text-muted hover:text-ink hover:bg-surface rounded-lg transition-colors"
                                                    title="Edit HS Code"
                                                >
                                                    <Edit2 size={15} />
                                                </button>
                                                <button
                                                    onClick={() => setCodeToDelete(code)}
                                                    className="p-1.5 text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                                    title="Delete HS Code"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && total > 0 && (
                    <div className="p-4 border-t border-border">
                        <PaginationControls
                            page={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                            summary={`Showing ${from}-${to} of ${total.toLocaleString()} HS codes`}
                        />
                    </div>
                )}
            </div>

            {/* CREATE / EDIT MODAL */}
            {modalMode && modalMode !== 'view' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl shadow-xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-border">
                            <h2 className="text-lg font-bold text-ink">
                                {modalMode === 'create' ? 'Add New HS Code' : `Edit HS Code: ${selectedCode?.code}`}
                            </h2>
                            <button onClick={() => setModalMode(null)} className="text-muted hover:text-ink">
                                <X size={20} />
                            </button>
                        </div>

                        {formError && (
                            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-medium flex items-center gap-2">
                                <AlertCircle size={16} className="shrink-0" />
                                <span>{formError}</span>
                            </div>
                        )}

                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-ink mb-1">
                                        HS Code <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. 8471.3000"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        className="w-full rounded-xl border border-border px-3.5 py-2 text-sm text-ink font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-ink mb-1">Short Name</label>
                                    <input
                                        type="text"
                                        placeholder="Brief title"
                                        value={formData.shortName}
                                        onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                                        className="w-full rounded-xl border border-border px-3.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-ink mb-1">
                                    Description <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    required
                                    rows={2}
                                    placeholder="Full product or tariff classification description..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full rounded-xl border border-border px-3.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-ink mb-1">
                                        Category <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Electronics, Agricultural"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full rounded-xl border border-border px-3.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-ink mb-1">Sub Category</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Laptops & Computers"
                                        value={formData.subCategory}
                                        onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                                        className="w-full rounded-xl border border-border px-3.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-ink mb-1">
                                        Unit of Measurement (UOM) <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={formData.unit}
                                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                        className="w-full rounded-xl border border-border px-3.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        {UNITS.map((u) => (
                                            <option key={u} value={u}>
                                                {u}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-ink mb-1">
                                        Default Tax Rate (%) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        required
                                        value={formData.defaultTaxRate}
                                        onChange={(e) => setFormData({ ...formData, defaultTaxRate: e.target.value })}
                                        className="w-full rounded-xl border border-border px-3.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-ink mb-1">Effective From</label>
                                    <input
                                        type="date"
                                        value={formData.effectiveFrom}
                                        onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                                        className="w-full rounded-xl border border-border px-3.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-ink mb-1">Effective To</label>
                                    <input
                                        type="date"
                                        value={formData.effectiveTo}
                                        onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                                        className="w-full rounded-xl border border-border px-3.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-ink mb-1">Notes / Special Instructions</label>
                                <textarea
                                    rows={2}
                                    placeholder="FBR circular references, conditions, exemptions..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full rounded-xl border border-border px-3.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="isFBRActiveCheck"
                                    checked={formData.isFBRActive}
                                    onChange={(e) => setFormData({ ...formData, isFBRActive: e.target.checked })}
                                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                                />
                                <label htmlFor="isFBRActiveCheck" className="text-xs font-medium text-ink cursor-pointer">
                                    FBR Active Status (Allowed in digital invoice submissions)
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setModalMode(null)}
                                    className="px-4 py-2 rounded-xl text-xs font-medium text-muted hover:bg-surface transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="px-5 py-2 rounded-xl bg-primary text-xs font-medium text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
                                >
                                    {formLoading ? 'Saving...' : modalMode === 'create' ? 'Create HS Code' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* VIEW MODAL */}
            {modalMode === 'view' && selectedCode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl shadow-xl border border-border w-full max-w-xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-border">
                            <div>
                                <span className="font-mono text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-md">
                                    {selectedCode.code}
                                </span>
                                <h2 className="text-lg font-bold text-ink mt-1">HS Code Details</h2>
                            </div>
                            <button onClick={() => setModalMode(null)} className="text-muted hover:text-ink">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 text-xs">
                            <div>
                                <span className="text-muted font-medium block mb-0.5">Description</span>
                                <p className="text-sm font-medium text-ink bg-surface p-3 rounded-xl border border-border">
                                    {selectedCode.description}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-muted font-medium block">Short Name</span>
                                    <p className="text-ink font-semibold mt-0.5">{selectedCode.shortName || '—'}</p>
                                </div>
                                <div>
                                    <span className="text-muted font-medium block">Default Tax Rate</span>
                                    <p className="text-ink font-semibold mt-0.5">{selectedCode.defaultTaxRate}%</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-muted font-medium block">Category</span>
                                    <p className="text-ink font-semibold mt-0.5">{selectedCode.category}</p>
                                </div>
                                <div>
                                    <span className="text-muted font-medium block">Sub Category</span>
                                    <p className="text-ink font-semibold mt-0.5">{selectedCode.subCategory || '—'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-muted font-medium block">Unit of Measure</span>
                                    <p className="text-ink font-semibold mt-0.5">{selectedCode.unit}</p>
                                </div>
                                <div>
                                    <span className="text-muted font-medium block">FBR Active Status</span>
                                    <span
                                        className={`inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full font-semibold ${
                                            selectedCode.isFBRActive
                                                ? 'bg-emerald-500/10 text-emerald-600'
                                                : 'bg-rose-500/10 text-rose-600'
                                        }`}
                                    >
                                        {selectedCode.isFBRActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>

                            {(selectedCode.effectiveFrom || selectedCode.effectiveTo) && (
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                                    <div>
                                        <span className="text-muted font-medium block">Effective From</span>
                                        <p className="text-ink font-semibold mt-0.5">
                                            {selectedCode.effectiveFrom ? new Date(selectedCode.effectiveFrom).toLocaleDateString() : '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-muted font-medium block">Effective To</span>
                                        <p className="text-ink font-semibold mt-0.5">
                                            {selectedCode.effectiveTo ? new Date(selectedCode.effectiveTo).toLocaleDateString() : '—'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {selectedCode.notes && (
                                <div className="pt-2 border-t border-border">
                                    <span className="text-muted font-medium block mb-0.5">Notes & Directives</span>
                                    <p className="text-ink bg-surface p-2.5 rounded-xl border border-border whitespace-pre-wrap">
                                        {selectedCode.notes}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-border">
                            <button
                                onClick={() => setModalMode(null)}
                                className="px-4 py-2 rounded-xl text-xs font-medium text-muted hover:bg-surface transition-colors"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => openEditModal(selectedCode)}
                                className="px-4 py-2 rounded-xl bg-primary text-xs font-medium text-white hover:bg-primary-dark transition-colors flex items-center gap-1.5"
                            >
                                <Edit2 size={13} />
                                Edit HS Code
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {codeToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl shadow-xl border border-border w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center gap-3 text-rose-600">
                            <div className="p-2.5 rounded-full bg-rose-500/10">
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-ink">Delete HS Code</h3>
                                <p className="text-xs text-muted font-mono">{codeToDelete.code}</p>
                            </div>
                        </div>

                        {deleteError && (
                            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-medium">
                                {deleteError}
                            </div>
                        )}

                        <p className="text-xs text-muted">
                            Are you sure you want to delete HS code <strong className="text-ink">{codeToDelete.code}</strong> ({codeToDelete.description})? This action cannot be undone.
                        </p>

                        <div className="flex justify-end gap-3 pt-3 border-t border-border">
                            <button
                                onClick={() => setCodeToDelete(null)}
                                className="px-4 py-2 rounded-xl text-xs font-medium text-muted hover:bg-surface transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={deleteLoading}
                                className="px-4 py-2 rounded-xl bg-rose-600 text-xs font-medium text-white hover:bg-rose-700 transition-colors disabled:opacity-50"
                            >
                                {deleteLoading ? 'Deleting...' : 'Delete HS Code'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
