'use client'

import { useEffect, useState } from 'react'
import { PaginationControls } from '@/components/pagination-controls'
import {
    getProductDIAutofillOptions,
    getProductDIAutofillPreset,
    type ProductDIAutofillPreset,
} from '@/lib/di/scenario-catalog'

interface Product {
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

interface HSCodeOption {
    id: string
    code: string
    description: string
    shortName?: string | null
    category: string
    unit: string
    defaultTaxRate: number | string
}

interface SROScheduleOption {
    id: number
    description: string
}

interface SROItemOption {
    id: number
    description: string
}

interface ProductFormState {
    name: string
    sku: string
    hsCodeId: string
    description: string
    price: string
    taxRate: string
    unit: string
    diRate: string
    diUOM: string
    diSaleType: string
    diFixedNotifiedValueOrRetailPrice: string
    diSalesTaxWithheldAtSource: string
    extraTax: string
    furtherTax: string
    fedPayable: string
    sroScheduleNo: string
    sroItemSerialNo: string
}

const initialFormState: ProductFormState = {
    name: '',
    sku: '',
    hsCodeId: '',
    description: '',
    price: '',
    taxRate: '18',
    unit: '',
    diRate: '',
    diUOM: '',
    diSaleType: '',
    diFixedNotifiedValueOrRetailPrice: '',
    diSalesTaxWithheldAtSource: '',
    extraTax: '',
    furtherTax: '',
    fedPayable: '',
    sroScheduleNo: '',
    sroItemSerialNo: '',
}

const PRODUCT_LIMIT = 25
const DEFAULT_PRAL_SALE_TYPE = 'Goods at standard rate (default)'

// Complete list of all PRAL-supported sale types (from FBR DI Guide)
const ALL_PRAL_SALE_TYPES = [
    'Goods at standard rate (default)',
    '3rd Schedule Goods',
    'Goods at Reduced Rate',
    'Goods at zero-rate',
    'Exempt goods',
    'Non-Adjustable Supplies',
    'Goods as per SRO.297(|)/2023',
    'Electric Vehicle',
    'CNG Sales',
    'Cement /Concrete Block',
    'Potassium Chlorate',
    'Steel melting and re-rolling',
    'Ship breaking',
    'Toll Manufacturing',
    'Cotton ginners',
    'Petroleum Products',
    'Electricity Supply to Retailers',
    'Gas to CNG stations',
    'Mobile Phones',
    'Processing/Conversion of Goods',
    'Telecommunication services',
    'Goods (FED in ST Mode)',
    'Services (FED in ST Mode)',
    'Services',
]

function numberOrUndefined(value: string) {
    const trimmed = value.trim()
    return trimmed === '' ? undefined : parseFloat(trimmed)
}

function requiresFixedValue(rate: string) {
    const normalized = rate.trim().toLowerCase()
    return normalized.includes('rupees') || normalized.includes('rs.') || normalized.includes('/unit') || normalized.includes('/kg')
}

function requiresSRODetails(saleType: string, sroScheduleNo: string, sroItemSerialNo: string) {
    const normalizedSaleType = saleType.trim().toLowerCase()
    return normalizedSaleType.includes('sro') || Boolean(sroScheduleNo.trim()) || Boolean(sroItemSerialNo.trim())
}

function saleTypeNeedsSROReferenceData(saleType: string) {
    const normalizedSaleType = saleType.trim().toLowerCase()

    if (!normalizedSaleType) {
        return false
    }

    return [
        'reduced rate',
        'zero-rate',
        'exempt',
        'sro',
        'cng',
        'mobile phones',
        'non-adjustable supplies',
        'electric vehicle',
    ].some((token) => normalizedSaleType.includes(token))
}

function isNonDefaultAdvancedValue(value: string) {
    const trimmed = value.trim()
    return trimmed !== '' && trimmed !== '0' && trimmed !== '0.00'
}

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [hsCodes, setHsCodes] = useState<HSCodeOption[]>([])
    const [hsCodeCategories, setHsCodeCategories] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const [hsCodeSearch, setHsCodeSearch] = useState('')
    const [hsCodeCategory, setHsCodeCategory] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [formLoading, setFormLoading] = useState(false)
    const [hsCodesLoading, setHsCodesLoading] = useState(false)
    const [showAdvancedDI, setShowAdvancedDI] = useState(false)
    const [error, setError] = useState('')
    const [form, setForm] = useState<ProductFormState>(initialFormState)
    const [editingProductId, setEditingProductId] = useState<string | null>(null)
    const [validUOMs, setValidUOMs] = useState<{ id: number; description: string }[]>([])
    const [uomsLoading, setUomsLoading] = useState(false)
    const [sroSchedules, setSroSchedules] = useState<SROScheduleOption[]>([])
    const [sroItems, setSroItems] = useState<SROItemOption[]>([])

    const selectedHSCode = hsCodes.find((item) => item.id === form.hsCodeId)
    const hsPresetOptions = selectedHSCode ? getProductDIAutofillOptions(selectedHSCode.code) : []
    const shouldShowFixedValue = requiresFixedValue(form.diRate)

    function buildFallbackPreset(hsCode: HSCodeOption | undefined): ProductDIAutofillPreset {
        const defaultRate = hsCode ? String(hsCode.defaultTaxRate) : '18'

        return {
            hsCode: hsCode?.code || '',
            diRate: defaultRate.endsWith('%') ? defaultRate : `${defaultRate}%`,
            diUOM: hsCode?.unit || '',
            diSaleType: DEFAULT_PRAL_SALE_TYPE,
            diFixedNotifiedValueOrRetailPrice: '0',
            diSalesTaxWithheldAtSource: '0',
            extraTax: '0',
            furtherTax: '0',
            fedPayable: '0',
            sroScheduleNo: '',
            sroItemSerialNo: '',
        }
    }

    function hasAdvancedOverrides(nextForm: ProductFormState, preset: ProductDIAutofillPreset | null) {
        if (isNonDefaultAdvancedValue(nextForm.diSalesTaxWithheldAtSource)
            || isNonDefaultAdvancedValue(nextForm.extraTax)
            || isNonDefaultAdvancedValue(nextForm.furtherTax)
            || isNonDefaultAdvancedValue(nextForm.fedPayable)) {
            return true
        }

        if (preset) {
            return nextForm.diUOM !== preset.diUOM
                || nextForm.diRate !== preset.diRate
                || nextForm.diFixedNotifiedValueOrRetailPrice !== preset.diFixedNotifiedValueOrRetailPrice
                || nextForm.sroScheduleNo !== preset.sroScheduleNo
                || nextForm.sroItemSerialNo !== preset.sroItemSerialNo
        }

        return isNonDefaultAdvancedValue(nextForm.diFixedNotifiedValueOrRetailPrice)
            || nextForm.sroScheduleNo.trim() !== ''
            || nextForm.sroItemSerialNo.trim() !== ''
    }

    function applyHSPreset(selected: HSCodeOption | undefined, preset: ProductDIAutofillPreset, preserveIdentityFields = true) {
        setForm((current) => {
            const sharedUOM = preset.diUOM || selected?.unit || current.unit
            const nextForm = {
                ...current,
                hsCodeId: selected?.id || current.hsCodeId,
                // name: preserveIdentityFields && current.name.trim()
                //     ? current.name
                //     : (selected?.shortName || selected?.description || current.name),
                description: preserveIdentityFields && current.description.trim()
                    ? current.description
                    : (selected?.description || current.description),
                taxRate: selected ? String(selected.defaultTaxRate) : current.taxRate,
                unit: sharedUOM,
                diUOM: sharedUOM,
                diSaleType: preset.diSaleType,
                diRate: preset.diRate,
                diFixedNotifiedValueOrRetailPrice: preset.diFixedNotifiedValueOrRetailPrice,
                diSalesTaxWithheldAtSource: preset.diSalesTaxWithheldAtSource,
                extraTax: preset.extraTax,
                furtherTax: preset.furtherTax,
                fedPayable: preset.fedPayable,
                sroScheduleNo: preset.sroScheduleNo,
                sroItemSerialNo: preset.sroItemSerialNo,
            }

            setShowAdvancedDI(hasAdvancedOverrides(nextForm, preset))
            return nextForm
        })
    }

    async function fetchValidUOMs(hsCode: string) {
        setValidUOMs([])
        setUomsLoading(true)
        try {
            const res = await fetch(`/api/tenant/fbr/hs-uom?hs_code=${encodeURIComponent(hsCode)}`)
            if (res.ok) {
                const data = await res.json()
                const uoms: { id: number; description: string }[] = data.uoms || []
                console.log('Fetched valid UOMs from PRAL for HS code', hsCode, uoms)
                setValidUOMs(uoms)
                // If current unit isn't in the returned list, force a valid shared UOM.
                if (uoms.length > 0) {
                    setForm((current) => {
                        const isValid = uoms.some((u) => u.description === current.unit || u.description === current.diUOM)
                        const nextUOM = isValid
                            ? (current.unit || current.diUOM)
                            : (uoms.length === 1 ? uoms[0].description : '')

                        return {
                            ...current,
                            unit: nextUOM,
                            diUOM: nextUOM,
                        }
                    })
                }
            }
        } catch {
            // Silently ignore — UOM field will fall back to free-text
        } finally {
            setUomsLoading(false)
        }
    }

    async function loadProducts() {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                q: search,
                page: String(page),
                limit: String(PRODUCT_LIMIT),
            })
            const res = await fetch(`/api/products?${params.toString()}`)
            if (res.ok) {
                const data = await res.json()
                setProducts(data.data || [])
                setTotal(data.total ?? 0)
                setTotalPages(data.pages ?? 1)
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
            const params = new URLSearchParams({
                q: query,
                category: hsCodeCategory,
                page: '1',
                limit: '50',
            })
            const res = await fetch(`/api/hs-codes?${params.toString()}`)
            if (res.ok) {
                const data = await res.json()
                setHsCodes(data.data || [])
                setHsCodeCategories(data.categories || [])
            }
        } catch {
            // Ignore
        } finally {
            setHsCodesLoading(false)
        }
    }

    async function loadSroSchedules(query = '') {
        try {
            const params = new URLSearchParams({ limit: '100' })
            if (query.trim()) {
                params.set('q', query.trim())
            }

            const res = await fetch(`/api/tenant/fbr/sro-schedules?${params.toString()}`)
            if (res.ok) {
                const data = await res.json()
                setSroSchedules(data.data || [])
            }
        } catch {
            // Ignore
        }
    }

    async function loadSroItems(query = '') {
        try {
            const params = new URLSearchParams({ limit: '100' })
            if (query.trim()) {
                params.set('q', query.trim())
            }

            const res = await fetch(`/api/tenant/fbr/sro-items?${params.toString()}`)
            if (res.ok) {
                const data = await res.json()
                setSroItems(data.data || [])
            }
        } catch {
            // Ignore
        }
    }

    async function hydrateHSCodeSelection(code: string) {
        try {
            const res = await fetch(`/api/hs-codes/search?q=${encodeURIComponent(code)}`)
            if (!res.ok) {
                return
            }

            const options = (await res.json()) as HSCodeOption[]
            console.log('Hydrating HS code selection, found options:', options)
            const selected = options.find((item) => item.code === code) ?? options[0]

            if (!selected) {
                return
            }

            setHsCodes((current) => {
                if (current.some((item) => item.id === selected.id)) {
                    return current
                }

                return [selected, ...current]
            })
            setHsCodeSearch(selected.code)
            setHsCodeCategory(selected.category)
            setForm((current) => ({ ...current, hsCodeId: selected.id }))
        } catch {
            // Ignore
        }
    }

    useEffect(() => {
        loadProducts()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, page])

    useEffect(() => {
        if (!showForm) return

        const timer = setTimeout(() => {
            loadHSCodes(hsCodeSearch)
        }, 250)

        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showForm, hsCodeSearch, hsCodeCategory])

    useEffect(() => {
        if (!showForm) return

        loadSroSchedules()
        loadSroItems()
    }, [showForm])

    function handleFormToggle() {
        const next = !showForm
        setShowForm(next)
        setError('')
        setEditingProductId(null)
        setShowAdvancedDI(false)

        if (!next) {
            setForm(initialFormState)
            setHsCodeSearch('')
            setHsCodeCategory('')
            setValidUOMs([])
            setSroItems([])
            return
        }

        setForm(initialFormState)
        loadHSCodes('')
    }

    function handleEditProduct(product: Product) {
        setEditingProductId(product.id)
        setShowForm(true)
        setError('')
        setHsCodeSearch(product.hsCode)
        const nextForm = {
            name: product.name,
            sku: product.sku || '',
            hsCodeId: product.hsCodeId || '',
            description: product.description || '',
            price: String(product.price),
            taxRate: String(product.taxRate),
            unit: product.diUOM || product.unit || '',
            diRate: product.diRate || '',
            diUOM: product.diUOM || product.unit || '',
            diSaleType: product.diSaleType || '',
            diFixedNotifiedValueOrRetailPrice: product.diFixedNotifiedValueOrRetailPrice != null ? String(product.diFixedNotifiedValueOrRetailPrice) : '',
            diSalesTaxWithheldAtSource: product.diSalesTaxWithheldAtSource != null ? String(product.diSalesTaxWithheldAtSource) : '',
            extraTax: product.extraTax != null ? String(product.extraTax) : '',
            furtherTax: product.furtherTax != null ? String(product.furtherTax) : '',
            fedPayable: product.fedPayable != null ? String(product.fedPayable) : '',
            sroScheduleNo: product.sroScheduleNo || '',
            sroItemSerialNo: product.sroItemSerialNo || '',
        }
        setForm(nextForm)
        setShowAdvancedDI(
            isNonDefaultAdvancedValue(nextForm.diFixedNotifiedValueOrRetailPrice)
            || isNonDefaultAdvancedValue(nextForm.diSalesTaxWithheldAtSource)
            || isNonDefaultAdvancedValue(nextForm.extraTax)
            || isNonDefaultAdvancedValue(nextForm.furtherTax)
            || isNonDefaultAdvancedValue(nextForm.fedPayable)
            || nextForm.sroScheduleNo.trim() !== ''
            || nextForm.sroItemSerialNo.trim() !== ''
        )

        if (product.hsCodeId) {
            loadHSCodes(product.hsCode)
        } else {
            hydrateHSCodeSelection(product.hsCode)
        }

        if (product.sroScheduleNo) {
            void loadSroSchedules(product.sroScheduleNo)
        }

        if (product.sroItemSerialNo) {
            void loadSroItems(product.sroItemSerialNo)
        }

        fetchValidUOMs(product.hsCode)
    }

    function handleFormChange<K extends keyof ProductFormState>(field: K, value: ProductFormState[K]) {
        setForm((current) => ({ ...current, [field]: value }))
    }

    function handleSharedUOMChange(value: string) {
        setForm((current) => ({
            ...current,
            unit: value,
            diUOM: value,
        }))
    }

    function handleHSCodeSelect(hsCodeId: string) {
        const selected = hsCodes.find((item) => item.id === hsCodeId)
        const presetOptions = selected ? getProductDIAutofillOptions(selected.code) : []
        const preset = getProductDIAutofillPreset(selected?.code || '')
            || presetOptions.find((option) => option.diSaleType === DEFAULT_PRAL_SALE_TYPE)
            || presetOptions[0]
            || buildFallbackPreset(selected)

        // Clear stale UOM list before fetching new ones and reset diUOM to preset value
        setValidUOMs([])
        applyHSPreset(selected, preset)

        if (selected) {
            setHsCodeSearch(selected.code)
            setHsCodeCategory(selected.category)
            fetchValidUOMs(selected.code)
        }
    }

    function handleSaleTypeChange(diSaleType: string) {
        const preset = hsPresetOptions.find((option) => option.diSaleType === diSaleType)
        if (!preset) {
            handleFormChange('diSaleType', diSaleType)
            if (saleTypeNeedsSROReferenceData(diSaleType)) {
                setShowAdvancedDI(true)
                void loadSroSchedules()
                void loadSroItems()
            }
            return
        }

        applyHSPreset(selectedHSCode, preset)
        if (saleTypeNeedsSROReferenceData(preset.diSaleType) || preset.sroScheduleNo || preset.sroItemSerialNo) {
            setShowAdvancedDI(true)
            void loadSroSchedules(preset.sroScheduleNo)
            void loadSroItems(preset.sroItemSerialNo)
        }
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
            diRate: form.diRate || undefined,
            diUOM: form.diUOM || undefined,
            diSaleType: form.diSaleType || undefined,
            diFixedNotifiedValueOrRetailPrice: numberOrUndefined(form.diFixedNotifiedValueOrRetailPrice),
            diSalesTaxWithheldAtSource: numberOrUndefined(form.diSalesTaxWithheldAtSource),
            extraTax: numberOrUndefined(form.extraTax),
            furtherTax: numberOrUndefined(form.furtherTax),
            fedPayable: numberOrUndefined(form.fedPayable),
            sroScheduleNo: form.sroScheduleNo || undefined,
            sroItemSerialNo: form.sroItemSerialNo || undefined,
        }

        try {
            const res = await fetch(editingProductId ? `/api/products/${editingProductId}` : '/api/products', {
                method: editingProductId ? 'PATCH' : 'POST',
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
            setEditingProductId(null)
            setHsCodeSearch('')
            loadProducts()
        } catch {
            setError('Network error')
        } finally {
            setFormLoading(false)
        }
    }

    const from = total === 0 ? 0 : (page - 1) * PRODUCT_LIMIT + 1
    const to = Math.min(page * PRODUCT_LIMIT, total)

    return (
        <div className="p-6 lg:p-8">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Catalog</p>
                    <h1 className="brand-heading mt-2 text-3xl font-bold text-white">Products</h1>
                </div>
                <button
                    onClick={handleFormToggle}
                    className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-(--accent-soft)"
                >
                    {showForm ? 'Cancel' : '+ Add Product'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleCreate} className="app-panel mb-6 rounded-2xl p-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm rounded-lg p-3 mb-4">
                            {error}
                        </div>
                    )}
                    <div className="mb-4 grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs text-[#c1bcaf]">Category</label>
                            <select
                                value={hsCodeCategory}
                                onChange={(e) => {
                                    setHsCodeCategory(e.target.value)
                                    setForm((current) => ({ ...current, hsCodeId: '' }))
                                }}
                                className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                            >
                                <option value="">All categories</option>
                                {hsCodeCategories.map((category) => (
                                    <option key={category} value={category}>{category}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs text-[#c1bcaf]">Find HS Code</label>
                            <input
                                value={hsCodeSearch}
                                onChange={(e) => setHsCodeSearch(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                                placeholder="Search by code, short name, or description"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-xs text-[#c1bcaf]">Select HS Code</label>
                            <select
                                name="hsCodeId"
                                required
                                value={form.hsCodeId}
                                onChange={(e) => handleHSCodeSelect(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-xs text-white"
                            >
                                <option value="">
                                    {hsCodesLoading ? 'Loading HS codes...' : hsCodes.length === 0 ? 'No HS codes available' : 'Choose the closest managed HS code'}
                                </option>
                                {hsCodes.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.code} - {item.shortName || item.description}
                                    </option>
                                ))}
                            </select>
                            {form.hsCodeId && (
                                <p className="mt-1 text-xs text-[#8d897d]">
                                    {hsCodes.find((item) => item.id === form.hsCodeId)?.category || 'Uncategorized'}
                                </p>
                            )}
                        </div>
                    </div>
                    {form.hsCodeId && (
                        <div className="mb-4 rounded-2xl border border-white/10 bg-[#0b1510] p-4">
                            <div className="grid gap-3 text-sm text-[#d8d0bf] md:grid-cols-4">
                                <div>
                                    <p className="mb-1 text-xs text-[#8d897d]">HS Code</p>
                                    <p className="break-all font-mono text-white">{selectedHSCode?.code}</p>
                                </div>
                                <div>
                                    <p className="mb-1 text-xs text-[#8d897d]">Category</p>
                                    <p className="text-white">{selectedHSCode?.category}</p>
                                </div>
                                <div>
                                    <p className="mb-1 text-xs text-[#8d897d]">Default Tax</p>
                                    <p className="text-white">{selectedHSCode?.defaultTaxRate}%</p>
                                </div>
                                <div>
                                    <p className="mb-1 text-xs text-[#8d897d]">Default Unit</p>
                                    <p className="text-white">{selectedHSCode?.unit}</p>
                                </div>
                            </div>
                            <p className="mt-3 text-xs text-[#c1bcaf]">
                                FBR item fields are synced from the selected HS code and PRAL sale type. This follows the documented PRAL mapping where HS code controls UOM validity and sale type controls the rate descriptor.
                            </p>
                        </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs text-[#c1bcaf] mb-1">Name</label>
                            <input
                                name="name"
                                required
                                value={form.name}
                                onChange={(e) => handleFormChange('name', e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white placeholder:text-[#8d897d]"
                                placeholder="Product name"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-[#c1bcaf] mb-1">SKU</label>
                            <input
                                name="sku"
                                value={form.sku}
                                onChange={(e) => handleFormChange('sku', e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white placeholder:text-[#8d897d]"
                                placeholder="SKU-001"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-[#c1bcaf] mb-1">Price (PKR)</label>
                            <input
                                name="price"
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={form.price}
                                onChange={(e) => handleFormChange('price', e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-[#c1bcaf] mb-1">Tax Rate (%)</label>
                            <input
                                name="taxRate"
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                required
                                value={form.taxRate}
                                onChange={(e) => handleFormChange('taxRate', e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-[#c1bcaf] mb-1">Unit of Measure</label>
                            {validUOMs.length > 0 ? (
                                <select
                                    name="unit"
                                    value={form.unit}
                                    onChange={(e) => handleSharedUOMChange(e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                                    required={!!form.hsCodeId}
                                >
                                    <option value="">Select UOM</option>
                                    {validUOMs.map((uom) => (
                                        <option key={uom.id} value={uom.description}>{uom.description}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    value={uomsLoading ? '' : (form.unit || form.diUOM)}
                                    readOnly
                                    className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-[#d8d0bf]"
                                    placeholder={uomsLoading ? 'Loading UOMs...' : 'Select an HS code first'}
                                />
                            )}
                            <p className="mt-1 text-xs text-[#8d897d]">The local unit and PRAL UOM stay identical and are loaded from PRAL reference data.</p>
                        </div>
                        <div>
                            <label className="block text-xs text-[#c1bcaf] mb-1">PRAL Sale Type</label>
                            <select
                                value={form.diSaleType}
                                onChange={(e) => handleSaleTypeChange(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                            >
                                <option value="">Select PRAL sale type</option>
                                {/* HS-code-specific presets first (autofill UOM/rate) */}
                                {hsPresetOptions.length > 0 && (
                                    <optgroup label="Suggested for this HS code">
                                        {hsPresetOptions.map((preset) => (
                                            <option key={preset.diSaleType} value={preset.diSaleType}>{preset.diSaleType}</option>
                                        ))}
                                    </optgroup>
                                )}
                                {/* All supported PRAL sale types */}
                                <optgroup label="All PRAL Sale Types">
                                    {ALL_PRAL_SALE_TYPES
                                        .filter((t) => !hsPresetOptions.some((p) => p.diSaleType === t))
                                        .map((t) => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                </optgroup>
                            </select>
                            <p className="mt-1 text-xs text-[#8d897d]">Selecting a type auto-fills the rate descriptor and loads SRO reference values from the cached PRAL database when that sale type needs them.</p>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs text-[#c1bcaf] mb-1">PRAL Rate Descriptor</label>
                            <input
                                value={form.diRate}
                                readOnly
                                className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-[#d8d0bf]"
                                placeholder="Autofilled from sale type — override in Advanced fields"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs text-[#c1bcaf] mb-1">Description (optional)</label>
                            <input
                                name="description"
                                value={form.description}
                                onChange={(e) => handleFormChange('description', e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white placeholder:text-[#8d897d]"
                                placeholder="Product description"
                            />
                        </div>
                    </div>
                    <div className="mt-4 border-t border-white/10 pt-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold tracking-wide text-[#c1bcaf] uppercase">Advanced PRAL Overrides</p>
                                <p className="mt-1 text-xs text-[#8d897d]">
                                    Use these only when FBR documentation for the selected HS code and sale type requires a non-default value.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAdvancedDI((current) => !current)}
                                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-[#d8d0bf] hover:bg-white/6"
                            >
                                {showAdvancedDI ? 'Hide Advanced Fields' : 'Show Advanced Fields'}
                            </button>
                        </div>

                        {showAdvancedDI && (
                            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
                                <div className="">
                                    <label className="block text-xs text-[#c1bcaf] mb-1">Rate Descriptor Override</label>
                                    <input value={form.diRate} onChange={(e) => handleFormChange('diRate', e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white placeholder:text-[#8d897d]" placeholder="18% along with rupees 60 per kilogram" />
                                </div>
                                {shouldShowFixedValue && (
                                    <div>
                                        <label className="block text-xs text-[#c1bcaf] mb-1">Fixed Value / Retail Price</label>
                                        <input value={form.diFixedNotifiedValueOrRetailPrice} onChange={(e) => handleFormChange('diFixedNotifiedValueOrRetailPrice', e.target.value)} type="number" step="0.01" min="0" className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white" />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs text-[#c1bcaf] mb-1">ST Withheld at Source</label>
                                    <input value={form.diSalesTaxWithheldAtSource} onChange={(e) => handleFormChange('diSalesTaxWithheldAtSource', e.target.value)} type="number" step="0.01" min="0" className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs text-[#c1bcaf] mb-1">Extra Tax</label>
                                    <input value={form.extraTax} onChange={(e) => handleFormChange('extraTax', e.target.value)} type="number" step="0.01" min="0" className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs text-[#c1bcaf] mb-1">Further Tax</label>
                                    <input value={form.furtherTax} onChange={(e) => handleFormChange('furtherTax', e.target.value)} type="number" step="0.01" min="0" className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs text-[#c1bcaf] mb-1">FED Payable</label>
                                    <input value={form.fedPayable} onChange={(e) => handleFormChange('fedPayable', e.target.value)} type="number" step="0.01" min="0" className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white" />
                                </div>
                                {/* SRO fields — shown for sale types that require schedule reference */}
                                <div className="col-span-2 md:col-span-3">
                                    <label className="block text-xs text-[#c1bcaf] mb-1">SRO Schedule No.</label>
                                    <input list="sro-schedule-options" value={form.sroScheduleNo} onChange={(e) => { handleFormChange('sroScheduleNo', e.target.value); loadSroSchedules(e.target.value) }} className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white placeholder:text-[#8d897d]" placeholder="e.g. EIGHTH SCHEDULE Table 1, 297(I)/2023-Table-I" />
                                    <datalist id="sro-schedule-options">
                                        {sroSchedules.map((schedule) => (
                                            <option key={schedule.id} value={schedule.description}>{`${schedule.id} - ${schedule.description}`}</option>
                                        ))}
                                    </datalist>
                                    <p className="mt-1 text-xs text-[#8d897d]">Loaded from cached PRAL SRO schedule data in the database. Required for Reduced Rate, Exempt, Zero-Rated, SRO.297, CNG, Mobile Phones and similar sale types.</p>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs text-[#c1bcaf] mb-1">SRO Item Serial No.</label>
                                    <input list="sro-item-options" value={form.sroItemSerialNo} onChange={(e) => { handleFormChange('sroItemSerialNo', e.target.value); loadSroItems(e.target.value) }} className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white placeholder:text-[#8d897d]" placeholder="e.g. 82, 12, Region-I" />
                                    <datalist id="sro-item-options">
                                        {sroItems.map((item) => (
                                            <option key={item.id} value={item.description}>{`${item.id} - ${item.description}`}</option>
                                        ))}
                                    </datalist>
                                    <p className="mt-1 text-xs text-[#8d897d]">Loaded from cached PRAL SRO item data in the database.</p>
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={formLoading}
                        className="mt-4 rounded-full bg-accent px-6 py-2 text-sm font-medium text-primary hover:bg-(--accent-soft) disabled:opacity-70"
                    >
                        {formLoading ? (editingProductId ? 'Saving...' : 'Creating...') : (editingProductId ? 'Save Product' : 'Create Product')}
                    </button>
                </form>
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
                                    No products. Add your first product above.
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
