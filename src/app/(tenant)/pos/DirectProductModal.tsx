'use client'

import { useEffect, useMemo, useState } from 'react'
import { SALE_TYPE_CONFIG, SALE_TYPE_LIST, type SaleTypeConfig } from '@/lib/di/sale-type-config'
import { calculateItemTax } from '@/lib/di/scenario-tax-calculator'

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
    valueSalesExcludingST?: number
    salesTaxApplicable?: number
    furtherTax?: number
    fedPayable?: number
    extraTax?: number
    totalTax?: number
    totalInvoiceValue?: number
    furtherTaxPercent?: number
    fedPercent?: number
    extraTaxPercent?: number
    isExempt?: boolean
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
    const [defaultHS, setDefaultHS] = useState<string>('')

    useEffect(() => {
        let isMounted = true
        async function fetchDefaultHSCode() {
            try {
                const res = await fetch('/api/hs-codes/default')
                if (res.ok) {
                    const data = await res.json()
                    if (data?.code && isMounted) {
                        setDefaultHS(data.code)
                        setForm((current) => {
                            if (current.hsCode.trim()) return current
                            return {
                                ...current,
                                hsCode: data.code,
                                uom: current.uom || data.unit || '',
                            }
                        })
                        void loadUomForHSCode(data.code)
                    }
                }
            } catch {
                // Non-blocking
            }
        }
        void fetchDefaultHSCode()
        return () => { isMounted = false }
    }, [])

    const cfg: SaleTypeConfig | null = form.saleTypeId ? (SALE_TYPE_CONFIG[form.saleTypeId] ?? null) : null
    const today = new Date().toISOString().split('T')[0]

    const qty = Math.max(1, toNumber(form.qty))
    const salePrice = Math.max(0, toNumber(form.salePricePerUnit))
    const discount = Math.max(0, toNumber(form.discount))
    const taxResult = calculateItemTax({
        saleType: cfg?.label || '',
        rateDesc: form.diRate,
        quantity: qty,
        unitPrice: salePrice,
        discount: discount,
        fixedNotifiedValueOrRetailPrice: cfg?.taxBase === 'retailPrice' ? salePrice * qty : undefined,
        furtherTaxPercent: toNumber(form.ftPercent),
        fedPercent: toNumber(form.fedPercent),
        extraTaxPercent: toNumber(form.extPercent),
        isExempt: form.exmt,
    })
    const taxableValue = taxResult.valueSalesExcludingST
    const gstAmount = taxResult.salesTaxApplicable
    const ftAmount = taxResult.furtherTax
    const fedAmount = taxResult.fedPayable
    const extAmount = taxResult.extraTax
    const totalTax = taxResult.totalTax
    const valueInclTax = taxResult.totalInvoiceValue

    async function loadUomForHSCode(hsCode: string) {
        if (cfg?.uomLocked) {
            setForm((current) => ({ ...current, uom: cfg.uomLocked || '' }))
            return
        }

        // Server tries the FBR DI HS_UOM API first, then falls back to the HS code table unit.
        try {
            const res = await fetch(`/api/tenant/fbr/hs-uom?hs_code=${encodeURIComponent(hsCode)}`)
            if (!res.ok) return
            const data = await res.json()
            const uoms: Array<{ description: string }> = data.uoms || []
            if (uoms.length === 0) return
            setForm((current) => {
                const existing = current.uom.trim().toLowerCase()
                const keepCurrent = uoms.length > 1 && !!existing
                    && uoms.some((u) => u.description.trim().toLowerCase() === existing)
                return { ...current, uom: keepCurrent ? current.uom : uoms[0].description }
            })
        } catch {
            // Non-blocking for POS data entry; the user can still enter the UOM manually.
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

        let effectiveHSCode = form.hsCode.trim()
        if (!effectiveHSCode && defaultHS) {
            effectiveHSCode = defaultHS
            setForm((current) => ({ ...current, hsCode: defaultHS }))
        }

        if (!effectiveHSCode) {
            setError('HS code could not be resolved from database.')
            return
        }

        if (!form.productDescription.trim()) {
            setError('Product description is required.')
            return
        }

        const effectiveUom = form.uom.trim() || cfg?.uomLocked || ''
        if (!effectiveUom) {
            setError('UOM is required.')
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
            hsCode: effectiveHSCode,
            price,
            taxRate,
            diRate: form.diRate,
            diSaleType: cfg.label,
            diFixedNotifiedValueOrRetailPrice: cfg.taxBase === 'retailPrice' ? price : null,
            unit: effectiveUom,
            sroScheduleNo: form.sroScheduleNo || null,
            sroItemSerialNo: form.sroItemSerialNo || null,
            isLocalOnly: true,
            qty: Math.max(1, toNumber(form.qty)),
            discount: Math.max(0, toNumber(form.discount)),
            valueSalesExcludingST: taxResult.valueSalesExcludingST,
            salesTaxApplicable: taxResult.salesTaxApplicable,
            furtherTax: taxResult.furtherTax,
            fedPayable: taxResult.fedPayable,
            extraTax: taxResult.extraTax,
            totalTax: taxResult.totalTax,
            totalInvoiceValue: taxResult.totalInvoiceValue,
            furtherTaxPercent: toNumber(form.ftPercent),
            fedPercent: toNumber(form.fedPercent),
            extraTaxPercent: toNumber(form.extPercent),
            isExempt: form.exmt,
        }
        console.log('Creating local product:', localProduct)
        onCreate(localProduct)
    }

    const inputCls = 'h-8 w-full rounded-lg border border-border bg-white px-2 text-xs text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:bg-surface-subtle disabled:text-muted'
    const readOnlyCls = `${inputCls} bg-surface-subtle tabular-nums text-right`
    const fmt = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="direct-product-title"
                onClick={(e) => e.stopPropagation()}
                className="flex max-h-[95dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-border bg-canvas shadow-modal sm:rounded-2xl"
            >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-white px-4 py-2.5">
                    <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Direct POS Product</p>
                        <h2 id="direct-product-title" className="text-sm font-semibold text-ink">Add Product (Local Only)</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-md text-sm text-muted hover:bg-surface hover:text-ink">
                        ✕
                    </button>
                </div>

                <form onSubmit={submitDirectProduct} className="flex min-h-0 flex-1 flex-col">
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
                        {error && (
                            <div className="rounded-lg border border-error-border bg-error-bg px-2.5 py-1.5 text-xs text-error">
                                {error}
                            </div>
                        )}

                        {/* Product */}
                        <Section title="Product">
                            <Field label="Sale Type" required className="col-span-2 sm:col-span-4 lg:col-span-4">
                                <select className={inputCls} value={form.saleTypeId} onChange={(e) => handleSaleTypeChange(e.target.value)} required>
                                    <option value="">Select sale type</option>
                                    {SALE_TYPE_LIST.map((item) => (
                                        <option key={item.id} value={item.id}>{item.label}</option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Product Description" required className="col-span-2 sm:col-span-4 lg:col-span-4">
                                <input
                                    className={inputCls}
                                    value={form.productDescription}
                                    onChange={(e) => setForm((current) => ({ ...current, productDescription: e.target.value }))}
                                    placeholder="Product name"
                                    required
                                />
                            </Field>
                            <Field label="HS Code" required className="col-span-1 sm:col-span-2 lg:col-span-2">
                                <input
                                    className={`${inputCls} font-mono`}
                                    value={form.hsCode}
                                    onChange={(e) => setForm((current) => ({ ...current, hsCode: e.target.value }))}
                                    onBlur={() => {
                                        if (form.hsCode.trim()) void loadUomForHSCode(form.hsCode.trim())
                                    }}
                                    placeholder={defaultHS ? `e.g. ${defaultHS}` : 'e.g. HS Code'}
                                    required
                                />
                            </Field>
                            <Field label="UOM" className="col-span-1 sm:col-span-2 lg:col-span-2">
                                <input className={inputCls} value={form.uom} onChange={(e) => setForm((current) => ({ ...current, uom: e.target.value }))} placeholder="PCS" />
                            </Field>
                        </Section>

                        {/* Pricing */}
                        <Section title="Pricing">
                            <Field label={`Qty (${form.uom || 'PCS'})`} required className="col-span-1 sm:col-span-2 lg:col-span-2">
                                <input className={`${inputCls} text-right`} type="number" min="1" value={form.qty} onChange={(e) => setForm((current) => ({ ...current, qty: e.target.value }))} />
                            </Field>
                            <Field label="Cost / Unit" className="col-span-1 sm:col-span-2 lg:col-span-2">
                                <input className={`${inputCls} text-right`} type="number" min="0" step="0.01" value={form.costPerUnit} onChange={(e) => setForm((current) => ({ ...current, costPerUnit: e.target.value }))} />
                            </Field>
                            <Field label="Sale Price / Unit" required className="col-span-1 sm:col-span-2 lg:col-span-3">
                                <input className={`${inputCls} text-right`} type="number" min="0" step="0.01" value={form.salePricePerUnit} onChange={(e) => setForm((current) => ({ ...current, salePricePerUnit: e.target.value }))} required />
                            </Field>
                            <Field label="Discount" className="col-span-1 sm:col-span-2 lg:col-span-2">
                                <input className={`${inputCls} text-right`} type="number" min="0" step="0.01" value={form.discount} onChange={(e) => setForm((current) => ({ ...current, discount: e.target.value }))} />
                            </Field>
                            <Field label="Taxable Value" className="col-span-2 sm:col-span-4 lg:col-span-3">
                                <input className={`${readOnlyCls} font-semibold`} value={fmt(taxableValue)} readOnly tabIndex={-1} />
                            </Field>
                        </Section>

                        {/* Tax */}
                        <Section title="Tax">
                            <Field label="Rate" className="col-span-2 sm:col-span-3 lg:col-span-3">
                                <select className={inputCls} value={form.rateId ?? ''} onChange={(e) => void handleRateChange(Number(e.target.value))} disabled={!cfg || ratesLoading}>
                                    <option value="">{ratesLoading ? 'Loading...' : 'Select rate'}</option>
                                    {rateOptions.map((rate) => (
                                        <option key={rate.id} value={rate.id}>{rate.desc}</option>
                                    ))}
                                </select>
                            </Field>
                            <div className="col-span-1 flex items-end sm:col-span-1 lg:col-span-1">
                                <label className="inline-flex h-8 items-center gap-1.5 text-[11px] font-semibold text-ink-secondary">
                                    <input type="checkbox" checked={form.exmt} onChange={(e) => setForm((current) => ({ ...current, exmt: e.target.checked }))} />
                                    Exempt
                                </label>
                            </div>
                            <Field label="GST Amt" className="col-span-1 sm:col-span-2 lg:col-span-2">
                                <input className={readOnlyCls} value={fmt(gstAmount)} readOnly tabIndex={-1} />
                            </Field>
                            <Field label="FT %" className="col-span-1 sm:col-span-1 lg:col-span-1">
                                <input className={`${inputCls} text-right`} type="number" min="0" step="0.01" value={form.ftPercent} onChange={(e) => setForm((current) => ({ ...current, ftPercent: e.target.value }))} />
                            </Field>
                            <Field label="FT Amt" className="col-span-1 sm:col-span-1 lg:col-span-1">
                                <input className={readOnlyCls} value={fmt(ftAmount)} readOnly tabIndex={-1} />
                            </Field>
                            <Field label="FED %" className="col-span-1 sm:col-span-1 lg:col-span-1">
                                <input className={`${inputCls} text-right`} type="number" min="0" step="0.01" value={form.fedPercent} onChange={(e) => setForm((current) => ({ ...current, fedPercent: e.target.value }))} />
                            </Field>
                            <Field label="FED Amt" className="col-span-1 sm:col-span-1 lg:col-span-1">
                                <input className={readOnlyCls} value={fmt(fedAmount)} readOnly tabIndex={-1} />
                            </Field>
                            <Field label="EXT %" className="col-span-1 sm:col-span-1 lg:col-span-1">
                                <input className={`${inputCls} text-right`} type="number" min="0" step="0.01" value={form.extPercent} onChange={(e) => setForm((current) => ({ ...current, extPercent: e.target.value }))} />
                            </Field>
                            <Field label="EXT Amt" className="col-span-1 sm:col-span-1 lg:col-span-1">
                                <input className={readOnlyCls} value={fmt(extAmount)} readOnly tabIndex={-1} />
                            </Field>
                            <Field label="Total Tax" className="col-span-2 sm:col-span-2 lg:col-span-12 xl:col-span-12">
                                <input className={`${readOnlyCls} font-semibold`} value={fmt(totalTax)} readOnly tabIndex={-1} />
                            </Field>
                        </Section>

                        {/* SRO */}
                        <Section title={`SRO · ${footerInfo}`}>
                            <Field label="SRO Schedule" className="col-span-2 sm:col-span-4 lg:col-span-7">
                                <select
                                    className={inputCls}
                                    value={form.sroScheduleId ?? ''}
                                    onChange={(e) => void handleSroChange(Number(e.target.value))}
                                    disabled={!cfg?.requiresSRO || sroLoading}
                                >
                                    <option value="">{cfg?.requiresSRO ? (sroLoading ? 'Loading SRO...' : 'Select SRO') : 'Not required'}</option>
                                    {sroOptions.map((sro) => (
                                        <option key={sro.id} value={sro.id}>{sro.desc}</option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="SR #" className="col-span-2 sm:col-span-4 lg:col-span-5">
                                <select
                                    className={inputCls}
                                    value={form.sroItemSerialNo}
                                    onChange={(e) => setForm((current) => ({ ...current, sroItemSerialNo: e.target.value }))}
                                    disabled={!cfg?.requiresSR || !form.sroScheduleId || srLoading}
                                >
                                    <option value="">{cfg?.requiresSR ? (srLoading ? 'Loading SR...' : 'Select SR#') : 'Not required'}</option>
                                    {srOptions.map((sr) => (
                                        <option key={sr.id} value={sr.desc}>{sr.desc}</option>
                                    ))}
                                </select>
                            </Field>
                        </Section>
                    </div>

                    {/* Footer: total + actions, always visible */}
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-white px-3 py-2.5 sm:px-4">
                        <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Value Incl. Tax</p>
                            <p className="text-lg font-bold tabular-nums text-primary">Rs {fmt(valueInclTax)}</p>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface">
                                Cancel
                            </button>
                            <button type="submit" className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark">
                                Validate &amp; Add
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <fieldset className="rounded-xl border border-border bg-white p-2.5 sm:p-3">
            <legend className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{title}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-12">
                {children}
            </div>
        </fieldset>
    )
}

function Field({ label, required, className = '', children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
    return (
        <label className={`block min-w-0 ${className}`}>
            <span className="mb-0.5 block truncate text-[10px] font-medium text-muted">
                {label}{required && <span className="text-error"> *</span>}
            </span>
            {children}
        </label>
    )
}
