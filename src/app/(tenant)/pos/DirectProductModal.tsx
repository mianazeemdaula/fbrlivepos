'use client'

import { useMemo, useState } from 'react'
import { SALE_TYPE_CONFIG, SALE_TYPE_LIST, type SaleTypeConfig } from '@/lib/di/sale-type-config'
import { calculateSalesTaxApplicable } from '@/lib/di/tax'

const DEFAULT_FALLBACK_UOM = 'Numbers, pieces, units'

interface RateOption {
    id: number
    desc: string
}

interface SROOption {
    id: number
    desc: string
}

type TaxFormState = {
    saleTypeId: string
    productDescription: string
    hsCode: string
    uom: string
    qty: string
    costPerUnit: string
    salePricePerUnit: string
    discount: string
    rateId: number | null
    diRate: string
    taxPercent: string
    exmt: boolean
    ftPercent: string
    fedPercent: string
    extPercent: string
    poNo: string
    billNo: string
    challanNo: string
    grNo: string
    gpNo: string
    note: string
    batchNo: string
    batchExpiry: string
    sroScheduleId: number | null
    sroScheduleNo: string
    sroItemSerialNo: string
}

export interface DirectPosProduct {
    id: string
    name: string
    hsCode: string
    price: number
    taxRate: number
    diRate: string | null
    diSaleType: string | null
    diFixedNotifiedValueOrRetailPrice: number | null
    unit: string
    sroScheduleNo: string | null
    sroItemSerialNo: string | null
    isLocalOnly: true
    qty: number
    discount: number
}

interface DirectProductModalProps {
    onCreate: (product: DirectPosProduct) => void
    onClose: () => void
}

const INIT: TaxFormState = {
    saleTypeId: '',
    productDescription: '',
    hsCode: '',
    uom: '',
    qty: '1',
    costPerUnit: '',
    salePricePerUnit: '',
    discount: '',
    rateId: null,
    diRate: '',
    taxPercent: '',
    exmt: false,
    ftPercent: '',
    fedPercent: '',
    extPercent: '',
    poNo: '',
    billNo: '',
    challanNo: '',
    grNo: '',
    gpNo: '',
    note: '',
    batchNo: '',
    batchExpiry: '',
    sroScheduleId: null,
    sroScheduleNo: '',
    sroItemSerialNo: '',
}

function toNumber(value: string): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

function percentFromRate(rateDesc: string): number {
    const match = rateDesc.match(/(\d+(?:\.\d+)?)\s*%/)
    return match ? Number(match[1]) : 0
}

export default function DirectProductModal({ onCreate, onClose }: DirectProductModalProps) {
    const [form, setForm] = useState<TaxFormState>(INIT)
    const [error, setError] = useState('')

    const [rateOptions, setRateOptions] = useState<RateOption[]>([])
    const [ratesLoading, setRatesLoading] = useState(false)
    const [sroOptions, setSroOptions] = useState<SROOption[]>([])
    const [sroLoading, setSroLoading] = useState(false)
    const [srOptions, setSrOptions] = useState<SROOption[]>([])
    const [srLoading, setSrLoading] = useState(false)

    const cfg: SaleTypeConfig | null = form.saleTypeId ? (SALE_TYPE_CONFIG[form.saleTypeId] ?? null) : null
    const today = new Date().toISOString().split('T')[0]

    const qty = Math.max(1, toNumber(form.qty))
    const salePrice = Math.max(0, toNumber(form.salePricePerUnit))
    const discount = Math.max(0, toNumber(form.discount))
    const taxableValue = Math.max(0, salePrice * qty - discount)
    const gstPercent = form.exmt ? 0 : Math.max(0, toNumber(form.taxPercent))
    const gstAmount = calculateSalesTaxApplicable({
        saleType: cfg?.label,
        taxRate: gstPercent,
        taxableValue,
        retailPrice: salePrice,
        quantity: qty,
    })
    const ftAmount = (taxableValue * Math.max(0, toNumber(form.ftPercent))) / 100
    const fedAmount = (taxableValue * Math.max(0, toNumber(form.fedPercent))) / 100
    const extAmount = (taxableValue * Math.max(0, toNumber(form.extPercent))) / 100
    const totalTax = gstAmount + ftAmount + fedAmount + extAmount
    const valueInclTax = taxableValue + totalTax

    async function loadUomForHSCode(hsCode: string) {
        if (cfg?.uomLocked) {
            setForm((current) => ({ ...current, uom: cfg.uomLocked || '' }))
            return
        }

        try {
            const res = await fetch(`/api/tenant/fbr/hs-uom?hs_code=${encodeURIComponent(hsCode)}`)
            if (!res.ok) {
                setForm((current) => ({ ...current, uom: current.uom || DEFAULT_FALLBACK_UOM }))
                return
            }
            const data = await res.json()
            const uoms: Array<{ description: string }> = data.uoms || []
            if (uoms.length === 1) {
                setForm((current) => ({ ...current, uom: uoms[0].description }))
            } else if (!form.uom.trim()) {
                setForm((current) => ({ ...current, uom: DEFAULT_FALLBACK_UOM }))
            }
        } catch {
            // Non-blocking for POS data entry; use a safe fallback for unmapped HS codes.
            setForm((current) => ({ ...current, uom: current.uom || DEFAULT_FALLBACK_UOM }))
        }
    }

    async function loadRates(nextCfg: SaleTypeConfig) {
        setRatesLoading(true)
        setRateOptions([])
        setSroOptions([])
        setSrOptions([])
        setForm((current) => ({
            ...current,
            rateId: null,
            diRate: '',
            taxPercent: '',
            sroScheduleId: null,
            sroScheduleNo: '',
            sroItemSerialNo: '',
        }))

        try {
            const res = await fetch(`/api/tenant/fbr/rates?transTypeId=${nextCfg.transTypeId}&date=${today}`)
            if (!res.ok) return
            const data = await res.json()
            const rates: RateOption[] = data.rates || []
            setRateOptions(rates)
            if (rates.length === 0) return

            const firstRate = rates[0]
            setForm((current) => ({
                ...current,
                rateId: firstRate.id,
                diRate: firstRate.desc,
                taxPercent: String(percentFromRate(firstRate.desc)),
            }))

            if (nextCfg.requiresSRO) {
                await loadSroSchedule(firstRate.id, nextCfg)
            }
        } catch {
            setRateOptions([])
        } finally {
            setRatesLoading(false)
        }
    }

    async function loadSroSchedule(rateId: number, nextCfg: SaleTypeConfig) {
        setSroLoading(true)
        setSroOptions([])
        setSrOptions([])
        setForm((current) => ({
            ...current,
            sroScheduleId: null,
            sroScheduleNo: '',
            sroItemSerialNo: '',
        }))

        // Fallback rate (negative ID) — use config SROs directly, no API call
        if (rateId < 0) {
            const fallbackRate = nextCfg.fallbackRates[Math.abs(rateId) - 1]
            const sros: SROOption[] = fallbackRate?.sros.map(s => ({ id: s.id, desc: s.desc })) ?? []
            setSroOptions(sros)
            if (sros.length > 0) {
                const firstSro = sros[0]
                setForm((current) => ({ ...current, sroScheduleId: firstSro.id, sroScheduleNo: firstSro.desc }))
                if (nextCfg.requiresSR) {
                    const srItems = fallbackRate?.sros[0]?.srItems ?? []
                    setSrOptions(srItems)
                    if (srItems.length > 0) {
                        setForm((current) => ({ ...current, sroItemSerialNo: srItems[0].desc }))
                    }
                }
            }
            setSroLoading(false)
            return
        }

        try {
            const url = `/api/tenant/fbr/sro-schedule?rate_id=${rateId}&date=${today}&sale_type_id=${encodeURIComponent(nextCfg.id)}`
            const res = await fetch(url)
            if (!res.ok) return
            const data = await res.json()
            const sros: SROOption[] = data.sros || []
            setSroOptions(sros)
            if (sros.length === 0) return

            const firstSro = sros[0]
            setForm((current) => ({
                ...current,
                sroScheduleId: firstSro.id,
                sroScheduleNo: firstSro.desc,
            }))

            if (nextCfg.requiresSR) {
                await loadSrItems(firstSro.id)
            }
        } catch {
            setSroOptions([])
        } finally {
            setSroLoading(false)
        }
    }

    async function loadSrItems(sroId: number) {
        setSrLoading(true)
        setSrOptions([])
        setForm((current) => ({ ...current, sroItemSerialNo: '' }))
        try {
            const res = await fetch(`/api/tenant/fbr/sro-items?sro_id=${sroId}&date=${today}`)
            if (!res.ok) return
            const data = await res.json()
            setSrOptions(data.data || [])
        } catch {
            setSrOptions([])
        } finally {
            setSrLoading(false)
        }
    }

    async function handleSaleTypeChange(nextSaleTypeId: string) {
        const nextCfg = SALE_TYPE_CONFIG[nextSaleTypeId]
        setForm((current) => ({
            ...current,
            saleTypeId: nextSaleTypeId,
            rateId: null,
            diRate: '',
            sroScheduleId: null,
            sroScheduleNo: '',
            sroItemSerialNo: '',
            taxPercent: '',
            exmt: false,
            uom: nextCfg?.uomLocked || current.uom,
        }))
        if (!nextCfg) return
        await loadRates(nextCfg)
    }

    async function handleRateChange(rateId: number) {
        const rate = rateOptions.find((value) => value.id === rateId)
        if (!rate) return

        setForm((current) => ({
            ...current,
            rateId,
            diRate: rate.desc,
            taxPercent: String(percentFromRate(rate.desc)),
            sroScheduleId: null,
            sroScheduleNo: '',
            sroItemSerialNo: '',
        }))

        if (cfg?.requiresSRO) {
            await loadSroSchedule(rateId, cfg)
        } else {
            setSroOptions([])
            setSrOptions([])
        }
    }

    async function handleSroChange(sroId: number) {
        const sro = sroOptions.find((value) => value.id === sroId)
        if (!sro) return

        setForm((current) => ({
            ...current,
            sroScheduleId: sroId,
            sroScheduleNo: sro.desc,
            sroItemSerialNo: '',
        }))

        if (cfg?.requiresSR) {
            await loadSrItems(sroId)
        }
    }

    const footerInfo = useMemo(() => {
        if (!cfg) return 'Select sale type first'
        if (cfg.requiresSRO && !form.sroScheduleNo) return 'Select rate first'
        if (cfg.requiresSR && !form.sroItemSerialNo) return 'Select SRO first'
        return 'Ready'
    }, [cfg, form.sroItemSerialNo, form.sroScheduleNo])

    function submitDirectProduct(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError('')

        if (!form.hsCode.trim()) {
            setError('HS code is required.')
            return
        }

        if (!form.productDescription.trim()) {
            setError('Product description is required.')
            return
        }

        if (!form.saleTypeId || !cfg) {
            setError('Sale type is required.')
            return
        }

        if (!form.rateId || !form.diRate) {
            setError('Rate is required.')
            return
        }

        if (cfg.requiresSRO && sroOptions.length > 0 && !form.sroScheduleNo) {
            setError('SRO is required for selected sale type.')
            return
        }

        if (cfg.requiresSR && srOptions.length > 0 && !form.sroItemSerialNo) {
            setError('SR# is required for selected SRO.')
            return
        }

        const price = Math.max(0, toNumber(form.salePricePerUnit))
        const taxRate = form.exmt ? 0 : Math.max(0, toNumber(form.taxPercent))

        const localProduct: DirectPosProduct = {
            id: `local-${Date.now()}`,
            name: form.productDescription.trim(),
            hsCode: form.hsCode.trim(),
            price,
            taxRate,
            diRate: form.diRate,
            diSaleType: cfg.label,
            diFixedNotifiedValueOrRetailPrice: cfg.taxBase === 'retailPrice' ? price : null,
            unit: form.uom || cfg.uomLocked || DEFAULT_FALLBACK_UOM,
            sroScheduleNo: form.sroScheduleNo || null,
            sroItemSerialNo: form.sroItemSerialNo || null,
            isLocalOnly: true,
            qty: Math.max(1, toNumber(form.qty)),
            discount: Math.max(0, toNumber(form.discount)),
        }

        onCreate(localProduct)
    }

    const inputCls = 'h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary/30'

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-7xl rounded-3xl border border-border bg-canvas shadow-2xl">
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted">Direct POS Product</p>
                        <h2 className="text-xl font-bold text-ink">Add Product (Local Only)</h2>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-ink-secondary hover:bg-surface">
                        Close
                    </button>
                </div>

                <form onSubmit={submitDirectProduct} className="space-y-4 p-5">
                    {error && (
                        <div className="rounded-xl border border-error-border bg-error-bg px-3 py-2 text-sm text-error">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-12 gap-3 rounded-2xl border border-border bg-surface p-4">
                        <div className="col-span-3">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-red-500">Sale Type *</label>
                            <select
                                className={inputCls}
                                value={form.saleTypeId}
                                onChange={(e) => handleSaleTypeChange(e.target.value)}
                                required
                            >
                                <option value="">Select sale type</option>
                                {SALE_TYPE_LIST.map((item) => (
                                    <option key={item.id} value={item.id}>{item.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-span-6">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-emerald-700">Product Description *</label>
                            <input
                                className={inputCls}
                                value={form.productDescription}
                                onChange={(e) => setForm((current) => ({ ...current, productDescription: e.target.value }))}
                                placeholder="Type to search stock items..."
                                required
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-emerald-700">HS Code</label>
                            <input
                                className={inputCls}
                                value={form.hsCode}
                                onChange={(e) => {
                                    setForm((current) => ({ ...current, hsCode: e.target.value }))
                                }}
                                onBlur={() => {
                                    if (form.hsCode.trim()) {
                                        void loadUomForHSCode(form.hsCode.trim())
                                    }
                                }}
                                placeholder="e.g. 8471.3000"
                                required
                            />
                        </div>

                        <div className="col-span-1">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">UOM</label>
                            <input
                                className={inputCls}
                                value={form.uom}
                                onChange={(e) => setForm((current) => ({ ...current, uom: e.target.value }))}
                                placeholder="PCS"
                            />
                        </div>

                        <div className="col-span-3">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-red-500">FBR Qty (PCS)</label>
                            <input className={inputCls} type="number" min="1" value={form.qty} onChange={(e) => setForm((current) => ({ ...current, qty: e.target.value }))} />
                        </div>

                        <div className="col-span-2">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Cost/Unit</label>
                            <input className={inputCls} type="number" min="0" step="0.01" value={form.costPerUnit} onChange={(e) => setForm((current) => ({ ...current, costPerUnit: e.target.value }))} />
                        </div>

                        <div className="col-span-2">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-red-500">Sale Price/Unit *</label>
                            <input className={inputCls} type="number" min="0" step="0.01" value={form.salePricePerUnit} onChange={(e) => setForm((current) => ({ ...current, salePricePerUnit: e.target.value }))} required />
                        </div>

                        <div className="col-span-2">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-pink-500">Discount</label>
                            <input className={inputCls} type="number" min="0" step="0.01" value={form.discount} onChange={(e) => setForm((current) => ({ ...current, discount: e.target.value }))} />
                        </div>

                        <div className="col-span-3">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-emerald-700">Taxable Value</label>
                            <input className={`${inputCls} font-semibold`} value={`Rs ${taxableValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} readOnly />
                        </div>

                        <div className="col-span-2">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-emerald-700">Rate</label>
                            <select
                                className={inputCls}
                                value={form.rateId ?? ''}
                                onChange={(e) => void handleRateChange(Number(e.target.value))}
                                disabled={!cfg || ratesLoading}
                            >
                                <option value="">{ratesLoading ? 'Loading...' : 'Select rate'}</option>
                                {rateOptions.map((rate) => (
                                    <option key={rate.id} value={rate.id}>{rate.desc}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-span-1 flex items-end">
                            <label className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-muted">
                                <input
                                    type="checkbox"
                                    checked={form.exmt}
                                    onChange={(e) => setForm((current) => ({ ...current, exmt: e.target.checked }))}
                                />
                                EXMT
                            </label>
                        </div>

                        <div className="col-span-1">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-emerald-700">GST Amt</label>
                            <input className={`${inputCls} bg-emerald-50`} value={gstAmount.toFixed(2)} readOnly />
                        </div>

                        <div className="col-span-1">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-orange-500">FT %</label>
                            <input className={inputCls} type="number" min="0" step="0.01" value={form.ftPercent} onChange={(e) => setForm((current) => ({ ...current, ftPercent: e.target.value }))} />
                        </div>

                        <div className="col-span-1">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-orange-500">FT Amt</label>
                            <input className={inputCls} value={ftAmount.toFixed(2)} readOnly />
                        </div>

                        <div className="col-span-1">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-blue-500">FED %</label>
                            <input className={inputCls} type="number" min="0" step="0.01" value={form.fedPercent} onChange={(e) => setForm((current) => ({ ...current, fedPercent: e.target.value }))} />
                        </div>

                        <div className="col-span-1">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-blue-500">FED Amt</label>
                            <input className={inputCls} value={fedAmount.toFixed(2)} readOnly />
                        </div>

                        <div className="col-span-1">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-pink-500">EXT %</label>
                            <input className={inputCls} type="number" min="0" step="0.01" value={form.extPercent} onChange={(e) => setForm((current) => ({ ...current, extPercent: e.target.value }))} />
                        </div>

                        <div className="col-span-1">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-pink-500">EXT Amt</label>
                            <input className={inputCls} value={extAmount.toFixed(2)} readOnly />
                        </div>

                        <div className="col-span-2">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-violet-600">Total Tax</label>
                            <input className={inputCls} value={totalTax.toFixed(2)} readOnly />
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-3 rounded-2xl border border-border bg-surface p-4">
                        <div className="col-span-2">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">PO#</label>
                            <input className={inputCls} value={form.poNo} onChange={(e) => setForm((current) => ({ ...current, poNo: e.target.value }))} />
                        </div>
                        <div className="col-span-2">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Bill#</label>
                            <input className={inputCls} value={form.billNo} onChange={(e) => setForm((current) => ({ ...current, billNo: e.target.value }))} />
                        </div>
                        <div className="col-span-1">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">D. Challan#</label>
                            <input className={inputCls} value={form.challanNo} onChange={(e) => setForm((current) => ({ ...current, challanNo: e.target.value }))} />
                        </div>
                        <div className="col-span-1">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">G.R#</label>
                            <input className={inputCls} value={form.grNo} onChange={(e) => setForm((current) => ({ ...current, grNo: e.target.value }))} />
                        </div>
                        <div className="col-span-1">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">G.P#</label>
                            <input className={inputCls} value={form.gpNo} onChange={(e) => setForm((current) => ({ ...current, gpNo: e.target.value }))} />
                        </div>
                        <div className="col-span-1">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Batch#</label>
                            <input className={inputCls} value={form.batchNo} onChange={(e) => setForm((current) => ({ ...current, batchNo: e.target.value }))} />
                        </div>
                        <div className="col-span-2">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Note</label>
                            <input className={inputCls} value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))} />
                        </div>
                        <div className="col-span-2">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Batch Expiry</label>
                            <input className={inputCls} type="date" value={form.batchExpiry} onChange={(e) => setForm((current) => ({ ...current, batchExpiry: e.target.value }))} />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-primary bg-primary px-4 py-3 text-white">
                        <div className="grid grid-cols-12 items-center gap-3">
                            <div className="col-span-1 text-xs font-semibold uppercase tracking-wider">SRO</div>
                            <div className="col-span-4">
                                <select
                                    className="h-10 w-full rounded-xl border border-white bg-primary px-3 text-sm text-white focus:outline-none"
                                    value={form.sroScheduleId ?? ''}
                                    onChange={(e) => void handleSroChange(Number(e.target.value))}
                                    disabled={!cfg?.requiresSRO || sroLoading}
                                >
                                    <option value="">{cfg?.requiresSRO ? (sroLoading ? 'Loading SRO...' : 'Select SRO') : 'Not required'}</option>
                                    {sroOptions.map((sro) => (
                                        <option key={sro.id} value={sro.id}>{sro.desc}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-span-1 text-xs font-semibold uppercase tracking-wider">SR#</div>
                            <div className="col-span-3">
                                <select
                                    className="h-10 w-full rounded-xl border border-white bg-primary px-3 text-sm text-white focus:outline-none"
                                    value={form.sroItemSerialNo}
                                    onChange={(e) => setForm((current) => ({ ...current, sroItemSerialNo: e.target.value }))}
                                    disabled={!cfg?.requiresSR || !form.sroScheduleId || srLoading}
                                >
                                    <option value="">{cfg?.requiresSR ? (srLoading ? 'Loading SR...' : 'Select SR#') : 'Not required'}</option>
                                    {srOptions.map((sr) => (
                                        <option key={sr.id} value={sr.desc}>{sr.desc}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-span-3 text-right">
                                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Value Incl. Tax</p>
                                <p className="text-4xl font-black">Rs {valueInclTax.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                        <p className="mt-2 text-xs text-emerald-200">Cascade status: {footerInfo}</p>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
                        <button type="button" onClick={onClose} className="rounded-full border border-border px-5 py-2 text-sm text-ink-secondary hover:bg-surface">
                            Cancel
                        </button>
                        <button type="submit" className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
                            Add To POS
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
