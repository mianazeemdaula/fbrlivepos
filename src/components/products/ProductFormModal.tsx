'use client'

import { useState, useEffect, useCallback } from 'react'
import { SALE_TYPE_CONFIG, SALE_TYPE_LIST, FORCED_UOM, type SaleTypeConfig } from '@/lib/di/sale-type-config'

interface HSCodeOption { id: string; code: string; description: string; shortName?: string | null; category: string; unit: string; defaultTaxRate: number | string }
interface RateOption { id: number; desc: string; value: number }
interface SROOption { id: number; desc: string }

interface ProductFormState {
    name: string; sku: string; hsCodeId: string; description: string
    price: string; taxRate: string; unit: string
    diSaleTypeId: string   // SN001...SN028
    diRate: string         // ratE_DESC exact string
    diRateId: number | null
    diUOM: string
    isUOMLocked: boolean
    isExempt: boolean
    diFixedNotifiedValueOrRetailPrice: string
    diSalesTaxWithheldAtSource: string
    extraTax: string; furtherTax: string; fedPayable: string
    sroScheduleNo: string; sroScheduleId: number | null
    sroItemSerialNo: string
}

export interface SavedProduct {
    id: string; name: string; hsCode: string; price: number
    taxRate: number; unit: string; diSaleType: string | null
    diRate: string | null; diUOM: string | null
}

interface Props {
    editingProductId?: string | null
    initialValues?: Partial<ProductFormState>
    onSave: (product: SavedProduct) => void
    onClose: () => void
}

const INIT: ProductFormState = {
    name: '', sku: '', hsCodeId: '', description: '',
    price: '', taxRate: '', unit: '',
    diSaleTypeId: '', diRate: '', diRateId: null, diUOM: '',
    isUOMLocked: false, isExempt: false,
    diFixedNotifiedValueOrRetailPrice: '',
    diSalesTaxWithheldAtSource: '', extraTax: '', furtherTax: '', fedPayable: '',
    sroScheduleNo: '', sroScheduleId: null, sroItemSerialNo: '',
}

export function ProductFormModal({ editingProductId, initialValues, onSave, onClose }: Props) {
    const [form, setForm] = useState<ProductFormState>({ ...INIT, ...initialValues })
    const [hsCodes, setHsCodes] = useState<HSCodeOption[]>([])
    const [hsSearch, setHsSearch] = useState('')
    const [hsLoading, setHsLoading] = useState(false)
    const [validUOMs, setValidUOMs] = useState<{ id: number; description: string }[]>([])
    const [uomLoading, setUomLoading] = useState(false)
    const [rateOptions, setRateOptions] = useState<RateOption[]>([])
    const [rateLoading, setRateLoading] = useState(false)
    const [sroOptions, setSroOptions] = useState<SROOption[]>([])
    const [sroLoading, setSroLoading] = useState(false)
    const [srOptions, setSrOptions] = useState<SROOption[]>([])
    const [srLoading, setSrLoading] = useState(false)
    const [formLoading, setFormLoading] = useState(false)
    const [error, setError] = useState('')
    const [rateSource, setRateSource] = useState<'pral' | 'fallback' | null>(null)
    const [sroSource, setSroSource] = useState<'pral' | 'db_fallback' | null>(null)

    const cfg: SaleTypeConfig | null = form.diSaleTypeId ? (SALE_TYPE_CONFIG[form.diSaleTypeId] ?? null) : null
    const selectedHS = hsCodes.find(h => h.id === form.hsCodeId)
    const showFixed = cfg?.taxBase === 'retailPrice'
    const today = new Date().toISOString().split('T')[0]

    const loadHS = useCallback(async (q = '') => {
        setHsLoading(true)
        try {
            const res = await fetch(`/api/hs-codes?${new URLSearchParams({ q, page: '1', limit: '50' })}`)
            if (res.ok) { const d = await res.json(); setHsCodes(d.data || []) }
        } catch { /* ignore */ } finally { setHsLoading(false) }
    }, [])

    useEffect(() => { loadHS('') }, [loadHS])
    useEffect(() => { const t = setTimeout(() => loadHS(hsSearch), 250); return () => clearTimeout(t) }, [hsSearch, loadHS])

    async function fetchUOMs(hsCode: string, saleTypeId: string) {
        const forced = FORCED_UOM[saleTypeId]
        if (forced) {
            setValidUOMs([])
            setForm(c => ({ ...c, unit: forced, diUOM: forced, isUOMLocked: true }))
            return
        }
        setUomLoading(true)
        try {
            const res = await fetch(`/api/tenant/fbr/hs-uom?hs_code=${encodeURIComponent(hsCode)}`)
            if (res.ok) {
                const d = await res.json()
                const uoms: { id: number; description: string }[] = d.uoms || []
                setValidUOMs(uoms)
                if (uoms.length === 1) {
                    setForm(c => ({ ...c, unit: uoms[0].description, diUOM: uoms[0].description, isUOMLocked: true }))
                } else if (uoms.length > 1) {
                    setForm(c => ({ ...c, isUOMLocked: false }))
                } else {
                    setForm(c => ({ ...c, isUOMLocked: false }))
                }
            }
        } catch { /* ignore */ } finally { setUomLoading(false) }
    }

    async function fetchRates(config: SaleTypeConfig) {
        setRateLoading(true)
        setRateOptions([])
        setRateSource(null)
        setForm(c => ({ ...c, diRate: '', diRateId: null, sroScheduleNo: '', sroScheduleId: null, sroItemSerialNo: '' }))
        setSroOptions([]); setSrOptions([])
        try {
            const res = await fetch(`/api/tenant/fbr/rates?transTypeId=${config.transTypeId}&date=${today}`)
            if (res.ok) {
                const d = await res.json()
                const rates: RateOption[] = d.rates || []
                setRateSource(d.source === 'pral' ? 'pral' : 'fallback')
                setRateOptions(rates)
                if (rates.length > 0) {
                    const first = rates[0]
                    setForm(c => ({ ...c, diRate: first.desc, diRateId: first.id }))
                    if (config.requiresSRO) await fetchSROSchedule(first.id, config)
                }
            }
        } catch { /* ignore */ } finally { setRateLoading(false) }
    }

    async function fetchSROSchedule(rateId: number, config: SaleTypeConfig) {
        setSroLoading(true)
        setSroOptions([])
        setSroSource(null)
        setForm(c => ({ ...c, sroScheduleNo: '', sroScheduleId: null, sroItemSerialNo: '' }))
        setSrOptions([])
        try {
            // Negative rateId = fallback rate — bypass API, use config directly
            if (rateId < 0) {
                const sros = config.fallbackSROs.map(s => ({ id: s.id, desc: s.desc }))
                setSroOptions(sros)
                setSroSource('db_fallback')
                if (sros.length > 0) {
                    const first = sros[0]
                    setForm(c => ({ ...c, sroScheduleNo: first.desc, sroScheduleId: first.id }))
                    if (config.requiresSR) {
                        // Populate SR# from first SRO's srItems directly
                        const srItems = config.fallbackSROs[0].srItems
                        setSrOptions(srItems)
                    }
                }
                return
            }
            // Real PRAL rate — call proxy API
            const res = await fetch(
                `/api/tenant/fbr/sro-schedule?rate_id=${rateId}&date=${today}&sale_type_id=${encodeURIComponent(config.id)}`
            )
            if (res.ok) {
                const d = await res.json()
                const sros: SROOption[] = d.sros || []
                setSroSource(d.source === 'pral' ? 'pral' : 'db_fallback')
                setSroOptions(sros)
                if (sros.length > 0) {
                    const first = sros[0]
                    setForm(c => ({ ...c, sroScheduleNo: first.desc, sroScheduleId: first.id }))
                    if (config.requiresSR) await fetchSRItems(first.id)
                }
            }
        } catch { /* ignore */ } finally { setSroLoading(false) }
    }

    async function fetchSRItems(sroId: number) {
        setSrLoading(true)
        setSrOptions([])
        setForm(c => ({ ...c, sroItemSerialNo: '' }))
        try {
            const res = await fetch(`/api/tenant/fbr/sro-items?sro_id=${sroId}&date=${today}`)
            if (res.ok) {
                const d = await res.json()
                setSrOptions(d.data || [])
                // Do NOT auto-select — user must pick
            }
        } catch { /* ignore */ } finally { setSrLoading(false) }
    }

    function handleHSSelect(hsCodeId: string) {
        const sel = hsCodes.find(h => h.id === hsCodeId)
        setForm(c => ({ ...c, hsCodeId: sel?.id || c.hsCodeId }))
        setValidUOMs([])
        if (sel) {
            setHsSearch(sel.code)
            if (form.diSaleTypeId) fetchUOMs(sel.code, form.diSaleTypeId)
        }
    }

    async function handleSaleTypeChange(saleTypeId: string) {
        const config = SALE_TYPE_CONFIG[saleTypeId]
        if (!config) { setForm(c => ({ ...c, diSaleTypeId: saleTypeId })); return }
        setForm(c => ({ ...c, diSaleTypeId: saleTypeId, isExempt: false }))
        // UOM enforcement
        if (selectedHS) await fetchUOMs(selectedHS.code, saleTypeId)
        // Rate cascade
        await fetchRates(config)
    }

    async function handleRateChange(rateId: number) {
        const rate = rateOptions.find(r => r.id === rateId)
        if (!rate || !cfg) return
        setForm(c => ({ ...c, diRate: rate.desc, diRateId: rate.id, sroScheduleNo: '', sroScheduleId: null, sroItemSerialNo: '' }))
        setSroOptions([]); setSrOptions([])
        if (cfg.requiresSRO) await fetchSROSchedule(rateId, cfg)
    }

    async function handleSROChange(sroId: number) {
        const sro = sroOptions.find(s => s.id === sroId)
        if (!sro || !cfg) return
        setForm(c => ({ ...c, sroScheduleNo: sro.desc, sroScheduleId: sroId, sroItemSerialNo: '' }))
        setSrOptions([])
        if (cfg.requiresSR) {
            if (sroId < 0) {
                // Fallback SRO — read srItems directly from config
                const fallbackSRO = cfg.fallbackSROs.find(s => s.id === sroId)
                if (fallbackSRO) setSrOptions(fallbackSRO.srItems)
            } else {
                await fetchSRItems(sroId)
            }
        }
    }

    function handleSRChange(srDesc: string) {
        setForm(c => ({ ...c, sroItemSerialNo: srDesc }))
    }

    function handleUOM(val: string) {
        setForm(c => ({ ...c, unit: val, diUOM: val }))
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setFormLoading(true); setError('')
        const config = cfg
        const body = {
            name: form.name, sku: form.sku || undefined,
            hsCodeId: form.hsCodeId, description: form.description || undefined,
            price: parseFloat(form.price), taxRate: parseFloat(form.taxRate || '0'),
            unit: form.unit,
            diRate: form.diRate || undefined,
            diUOM: form.diUOM || form.unit || undefined,
            diSaleType: config?.label || undefined,
            diFixedNotifiedValueOrRetailPrice: form.diFixedNotifiedValueOrRetailPrice ? parseFloat(form.diFixedNotifiedValueOrRetailPrice) : undefined,
            diSalesTaxWithheldAtSource: form.diSalesTaxWithheldAtSource ? parseFloat(form.diSalesTaxWithheldAtSource) : undefined,
            extraTax: form.extraTax ? parseFloat(form.extraTax) : undefined,
            furtherTax: form.furtherTax ? parseFloat(form.furtherTax) : undefined,
            fedPayable: form.fedPayable ? parseFloat(form.fedPayable) : undefined,
            sroScheduleNo: form.sroScheduleNo || undefined,
            sroItemSerialNo: form.sroItemSerialNo || undefined,
        }
        try {
            const url = editingProductId ? `/api/products/${editingProductId}` : '/api/products'
            const method = editingProductId ? 'PATCH' : 'POST'
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            const result = await res.json()
            if (!res.ok) { setError(result.error || 'Failed to save product'); return }
            onSave(result as SavedProduct)
        } catch { setError('Network error') } finally { setFormLoading(false) }
    }

    const inputCls = 'w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white placeholder:text-[#8d897d] focus:border-[#f0d9a0]/40 focus:outline-none'
    const labelCls = 'mb-1 block text-xs text-[#c1bcaf]'
    const sectionLabelCls = 'block text-xs font-semibold uppercase tracking-wider text-[#f0d9a0] mb-2'

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(7,20,15,0.99),rgba(5,13,10,0.99))] my-8 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Catalog</p>
                        <h2 className="brand-heading mt-0.5 text-xl font-bold text-white">
                            {editingProductId ? 'Edit Product' : 'Add New Product'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8d897d] hover:bg-white/10 hover:text-white">✖</button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

                    {/* ── DI Cascade ── */}
                    <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#f0d9a0]">FBR Digital Invoicing Cascade</p>

                        {/* Row 1: Sale Type + Rate (2-col) */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* Sale Type */}
                            <div>
                                <label className={labelCls}>PRAL Sale Type <span className="text-red-400">*</span></label>
                                <select
                                    required value={form.diSaleTypeId}
                                    onChange={e => handleSaleTypeChange(e.target.value)}
                                    className={inputCls}
                                >
                                    <option value="">Select sale type…</option>
                                    {SALE_TYPE_LIST.map(t => (
                                        <option key={t.id} value={t.id}>{t.id} — {t.label}</option>
                                    ))}
                                </select>
                                {cfg && (
                                    <p className="mt-1 text-[11px] text-[#8d897d] leading-tight">
                                        Base: <span className="text-[#c1bcaf]">{cfg.taxBase}</span>
                                        {cfg.uomLocked && <> · UOM: <span className="text-[#f0d9a0]">{cfg.uomLocked}</span></>}
                                        {cfg.requiresSRO && <> · SRO</>}
                                        {cfg.requiresSR && <span className="text-[#f0d9a0]"> + SR#</span>}
                                    </p>
                                )}
                            </div>

                            {/* Rate Descriptor */}
                            {form.diSaleTypeId ? (
                                <div>
                                    <label className={labelCls}>Rate Descriptor</label>
                                    <select
                                        value={form.diRateId ?? ''}
                                        onChange={e => handleRateChange(Number(e.target.value))}
                                        className={inputCls}
                                        disabled={rateLoading}
                                    >
                                        <option value="">{rateLoading ? 'Loading…' : rateOptions.length === 0 ? 'No rates' : 'Select rate…'}</option>
                                        {rateOptions.map(r => (
                                            <option key={r.id} value={r.id}>{r.desc}</option>
                                        ))}
                                    </select>
                                    {rateSource === 'fallback' && (
                                        <p className="mt-1 text-[11px] text-yellow-400 leading-tight">⚠ Using local rate presets — PRAL API unavailable</p>
                                    )}
                                    {form.diRate && rateSource === 'pral' && (
                                        <p className="mt-1 text-[11px] text-[#8d897d]">FBR value: <span className="text-[#f0d9a0] font-mono">{form.diRate}</span></p>
                                    )}
                                </div>
                            ) : <div />}
                        </div>

                        {/* Row 2: SRO Schedule + SR# (2-col, only when needed) */}
                        {cfg?.requiresSRO && (
                            <div className="grid grid-cols-2 gap-3">
                                {/* SRO Schedule */}
                                <div>
                                    <label className={labelCls}>SRO Schedule <span className="text-red-400">*</span></label>
                                    <select
                                        required value={form.sroScheduleId ?? ''}
                                        onChange={e => handleSROChange(Number(e.target.value))}
                                        className={inputCls}
                                        disabled={sroLoading}
                                    >
                                        <option value="">{sroLoading ? 'Loading…' : sroOptions.length === 0 ? 'No SRO schedules' : 'Select SRO…'}</option>
                                        {sroOptions.map(s => (
                                            <option key={s.id} value={s.id}>{s.desc}</option>
                                        ))}
                                    </select>
                                    {sroSource === 'db_fallback' && (
                                        <p className="mt-1 text-[11px] text-amber-400 leading-tight">⚠ Using local SRO presets — PRAL API unavailable</p>
                                    )}
                                </div>

                                {/* SR# Item */}
                                {cfg?.requiresSR && form.sroScheduleId ? (
                                    <div>
                                        <label className={labelCls}>SR# Item <span className="text-red-400">*</span></label>
                                        <select
                                            required value={form.sroItemSerialNo}
                                            onChange={e => handleSRChange(e.target.value)}
                                            className={inputCls}
                                            disabled={srLoading}
                                        >
                                            <option value="">{srLoading ? 'Loading…' : srOptions.length === 0 ? 'No SR items' : 'Select SR# item…'}</option>
                                            {srOptions.map(s => (
                                                <option key={s.id} value={s.desc}>{s.desc}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : <div />}
                            </div>
                        )}

                        {/* Exempt checkbox (SN006 only) */}
                        {cfg?.showEXMT && (
                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox" id="isExempt"
                                    checked={form.isExempt}
                                    onChange={e => setForm(c => ({ ...c, isExempt: e.target.checked }))}
                                    className="h-4 w-4 rounded border-white/20 bg-white/6 accent-[#f0d9a0]"
                                />
                                <label htmlFor="isExempt" className="text-xs text-[#c1bcaf]">EXMT — Mark as Exempt (zero tax)</label>
                            </div>
                        )}
                    </div>

                    {/* ── HS Code ── */}
                    <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#f0d9a0]">HS Code</p>
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <label className={labelCls}>Search HS Code</label>
                                <input value={hsSearch} onChange={e => setHsSearch(e.target.value)}
                                    className={inputCls} placeholder="Enter code or keyword…" />
                            </div>
                            <button type="button" onClick={() => loadHS(hsSearch)} disabled={hsLoading}
                                className="flex h-9 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-50">
                                ↺
                            </button>
                        </div>
                        <select required value={form.hsCodeId} onChange={e => handleHSSelect(e.target.value)} className={`${inputCls} text-xs`}>
                            <option value="">{hsLoading ? 'Loading…' : hsCodes.length === 0 ? 'No HS codes' : 'Select HS code'}</option>
                            {hsCodes.map(h => <option key={h.id} value={h.id}>{h.code} — {h.shortName || h.description}</option>)}
                        </select>
                        {selectedHS && (
                            <div className="flex gap-4 rounded-lg bg-[#0b1510] px-3 py-2 text-[11px] text-[#c1bcaf]">
                                <span><span className="text-[#8d897d]">Category: </span>{selectedHS.category}</span>
                                <span><span className="text-[#8d897d]">Default Tax: </span>{selectedHS.defaultTaxRate}%</span>
                                <span><span className="text-[#8d897d]">Default UOM: </span>{selectedHS.unit}</span>
                            </div>
                        )}
                    </div>

                    {/* ── Product Details ── */}
                    <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#f0d9a0]">Product Details</p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div>
                                <label className={labelCls}>Name <span className="text-red-400">*</span></label>
                                <input required value={form.name} onChange={e => setForm(c => ({ ...c, name: e.target.value }))} className={inputCls} placeholder="Product name" />
                            </div>
                            <div>
                                <label className={labelCls}>SKU</label>
                                <input value={form.sku} onChange={e => setForm(c => ({ ...c, sku: e.target.value }))} className={inputCls} placeholder="SKU-001" />
                            </div>
                            <div>
                                <label className={labelCls}>Price (PKR) <span className="text-red-400">*</span></label>
                                <input required type="number" step="0.01" min="0" value={form.price} onChange={e => setForm(c => ({ ...c, price: e.target.value }))} className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Tax Rate (%)</label>
                                <input type="number" step="0.01" min="0" max="100" value={form.taxRate} onChange={e => setForm(c => ({ ...c, taxRate: e.target.value }))} className={inputCls} />
                            </div>

                            {/* UOM */}
                            <div className="col-span-2">
                                <label className={labelCls}>Unit of Measure <span className="text-red-400">*</span></label>
                                {form.isUOMLocked ? (
                                    <div className="flex items-center gap-2">
                                        <input readOnly value={form.unit || form.diUOM} className={`${inputCls} bg-white/3 cursor-not-allowed`} />
                                        <span className="text-xs text-[#f0d9a0] whitespace-nowrap">🔒 FBR locked</span>
                                    </div>
                                ) : validUOMs.length > 0 ? (
                                    <select value={form.unit} onChange={e => handleUOM(e.target.value)} className={inputCls} required={!!form.hsCodeId}>
                                        <option value="">Select UOM</option>
                                        {validUOMs.map(u => <option key={u.id} value={u.description}>{u.description}</option>)}
                                    </select>
                                ) : (
                                    <input value={uomLoading ? '' : (form.unit || form.diUOM)} readOnly
                                        className={`${inputCls} cursor-not-allowed`}
                                        placeholder={uomLoading ? 'Loading UOMs…' : 'Select HS code first'} />
                                )}
                            </div>

                            {/* Fixed/Retail Price — 3rd Schedule only */}
                            {showFixed && (
                                <div className="col-span-2">
                                    <label className={labelCls}>Fixed / Retail Price (PKR) <span className="text-red-400">*</span></label>
                                    <input required type="number" step="0.01" min="0"
                                        value={form.diFixedNotifiedValueOrRetailPrice}
                                        onChange={e => setForm(c => ({ ...c, diFixedNotifiedValueOrRetailPrice: e.target.value }))}
                                        className={inputCls} placeholder="Printed retail price" />
                                    <p className="mt-1 text-[11px] text-[#8d897d]">3rd Schedule: GST is calculated on this price × qty, not on taxable value.</p>
                                </div>
                            )}

                            <div className="col-span-4">
                                <label className={labelCls}>Description</label>
                                <input value={form.description} onChange={e => setForm(c => ({ ...c, description: e.target.value }))}
                                    className={inputCls} placeholder="Product description (optional)" />
                            </div>
                        </div>
                    </div>

                    {/* Conditional FT / FED / EXT fields */}
                    {(cfg?.showFT || cfg?.showFED || cfg?.showEXT) && (
                        <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-[#f0d9a0]">Advanced Tax Fields</p>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {cfg.showFT && (
                                    <div>
                                        <label className={labelCls}>Further Tax % <span className="text-[#8d897d] font-normal">(default 3%)</span></label>
                                        <input type="number" step="0.01" min="0" value={form.furtherTax}
                                            onChange={e => setForm(c => ({ ...c, furtherTax: e.target.value }))}
                                            className={inputCls} placeholder="3" />
                                        <p className="mt-1 text-[11px] text-[#8d897d]">Unregistered buyers only</p>
                                    </div>
                                )}
                                {cfg.showFED && (
                                    <div>
                                        <label className={labelCls}>FED % <span className="text-red-400">*</span></label>
                                        <input type="number" step="0.01" min="0" value={form.fedPayable}
                                            onChange={e => setForm(c => ({ ...c, fedPayable: e.target.value }))}
                                            className={inputCls} placeholder="0" />
                                    </div>
                                )}
                                {cfg.showEXT && (
                                    <div>
                                        <label className={labelCls}>Extra Tax %</label>
                                        <input type="number" step="0.01" min="0" value={form.extraTax}
                                            onChange={e => setForm(c => ({ ...c, extraTax: e.target.value }))}
                                            className={inputCls} placeholder="0" />
                                    </div>
                                )}
                                <div>
                                    <label className={labelCls}>ST Withheld at Source</label>
                                    <input type="number" step="0.01" min="0" value={form.diSalesTaxWithheldAtSource}
                                        onChange={e => setForm(c => ({ ...c, diSalesTaxWithheldAtSource: e.target.value }))}
                                        className={inputCls} placeholder="0" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 border-t border-white/10 pt-4">
                        <button type="button" onClick={onClose}
                            className="flex-1 rounded-full border border-white/10 py-2.5 text-sm text-[#c1bcaf] hover:bg-white/6">
                            Cancel
                        </button>
                        <button type="submit" disabled={formLoading}
                            className="flex-1 rounded-full bg-accent py-2.5 text-sm font-medium text-primary hover:bg-[--accent-soft] disabled:opacity-50">
                            {formLoading ? 'Saving…' : (editingProductId ? 'Save Changes' : 'Add Product')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

