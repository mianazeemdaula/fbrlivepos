'use client'

import { useState, useEffect } from 'react'
import { SCENARIO_DESCRIPTIONS, getRequiredScenarios } from '@/lib/di/scenarios'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedScenario {
    scenarioId: string
    description: string | null
    status: string
    invoiceNo?: string | null
}

interface DIConfig {
    businessActivity?: string
    sector?: string
    sellerProvince?: string
    sandboxScenarios?: SavedScenario[]
}

interface TestResult {
    success: boolean
    diInvoiceNumber?: string | null
    errors?: Array<{ code: string; message: string; item?: string; action: string }>
    error?: string
}

interface ScenarioFormData {
    buyerName: string
    buyerNTN: string
    buyerProvince: string
    buyerAddress: string
    buyerRegistrationType: 'Registered' | 'Unregistered'
    hsCode: string
    itemDescription: string
    quantity: string
    unitPrice: string
    taxRate: string
    rate: string
    uom: string
    saleType: string
    sroScheduleNo: string
}

interface Props {
    open: boolean
    onClose: () => void
    diConfig: DIConfig
    onScenariosUpdated: () => void
}

// ─── Scenario defaults ────────────────────────────────────────────────────────

function getScenarioDefaults(
    scenarioId: string,
    sellerProvince?: string,
): ScenarioFormData {
    const province = sellerProvince ?? 'Punjab'

    const base: ScenarioFormData = {
        buyerName: 'Test Buyer',
        buyerNTN: '',
        buyerProvince: province,
        buyerAddress: 'Test Address, City',
        buyerRegistrationType: 'Registered',
        hsCode: '8471.3000',
        itemDescription: 'Laptop Computer',
        quantity: '1',
        unitPrice: '100000',
        taxRate: '18',
        rate: '18%',
        uom: 'Numbers, pieces, units',
        saleType: 'Goods at Standard Rate (default)',
        sroScheduleNo: '',
    }

    switch (scenarioId) {
        case 'SN001':
            return { ...base, buyerRegistrationType: 'Registered', taxRate: '18', rate: '18%' }
        case 'SN002':
            return {
                ...base,
                buyerRegistrationType: 'Unregistered',
                buyerName: 'Walk-in Customer',
                buyerNTN: '',
                taxRate: '18',
                rate: '18%',
            }
        case 'SN003':
            return {
                ...base,
                hsCode: '7214.2000',
                itemDescription: 'Steel Bar (Melted and Re-Rolled)',
                uom: 'Metric Ton',
                taxRate: '17',
                rate: '17%',
                saleType: 'Sale of Steel (Melted and Re-Rolled)',
            }
        case 'SN004':
            return {
                ...base,
                hsCode: '7204.1000',
                itemDescription: 'Ship Scrap Metal',
                uom: 'Metric Ton',
                saleType: 'Sale by Ship Breakers',
            }
        case 'SN005':
            return {
                ...base,
                taxRate: '10',
                rate: '10%',
                saleType: 'Reduced Rate',
                sroScheduleNo: 'SRO.XXX',
            }
        case 'SN006':
            return {
                ...base,
                hsCode: '0101.2100',
                itemDescription: 'Exempt Agricultural Goods',
                taxRate: '0',
                rate: '0%',
                saleType: 'Exempt Goods',
            }
        case 'SN007':
            return {
                ...base,
                taxRate: '0',
                rate: '0%',
                saleType: 'Zero Rated Goods',
            }
        case 'SN008':
            return {
                ...base,
                saleType: '3rd Schedule Goods',
                itemDescription: '3rd Schedule Product',
            }
        case 'SN009':
            return {
                ...base,
                hsCode: '5201.0000',
                itemDescription: 'Cotton (Ginners to Spinners)',
                uom: 'Metric Ton',
                saleType: 'Cotton Spinners purchase from Cotton Ginners',
            }
        case 'SN010':
            return {
                ...base,
                hsCode: '8517.1200',
                itemDescription: 'Telecom Service',
                saleType: 'Telecom services rendered or provided',
            }
        case 'SN011':
            return {
                ...base,
                hsCode: '7214.2000',
                itemDescription: 'Toll Manufacturing (Steel)',
                uom: 'Metric Ton',
                saleType: 'Toll Manufacturing sale by Steel sector',
            }
        case 'SN012':
            return {
                ...base,
                hsCode: '2710.1200',
                itemDescription: 'Petroleum Product',
                uom: 'Liter',
                saleType: 'Sale of Petroleum products',
            }
        case 'SN015':
            return {
                ...base,
                hsCode: '8517.1200',
                itemDescription: 'Mobile Phone',
                saleType: 'Sale of mobile phones',
            }
        case 'SN016':
            return { ...base, saleType: 'Processing / Conversion of Goods' }
        case 'SN017':
            return {
                ...base,
                saleType: 'Sale of Goods where FED is charged in ST mode',
            }
        case 'SN018':
            return {
                ...base,
                itemDescription: 'Service with FED',
                saleType: 'Services rendered where FED is charged in ST mode',
            }
        case 'SN019':
            return {
                ...base,
                itemDescription: 'Service Rendered',
                saleType: 'Services rendered or provided',
            }
        case 'SN021':
            return {
                ...base,
                hsCode: '2523.2100',
                itemDescription: 'Cement Bag (50kg)',
                uom: 'Metric Ton',
                saleType: 'Sale of Cement / Concrete Block',
            }
        case 'SN022':
            return {
                ...base,
                hsCode: '2829.1900',
                itemDescription: 'Potassium Chlorate',
                uom: 'KG',
                saleType: 'Sale of Potassium Chlorate',
            }
        case 'SN024':
            return {
                ...base,
                saleType: 'Goods sold listed in SRO 297(I)/2023',
                sroScheduleNo: 'SRO 297',
            }
        case 'SN026':
            return {
                ...base,
                buyerRegistrationType: 'Unregistered',
                buyerName: 'Walk-in Customer',
                buyerNTN: '',
                saleType: 'Sale to End Consumer (Standard Rate)',
                rate: '18%',
                taxRate: '18',
            }
        case 'SN027':
            return {
                ...base,
                buyerRegistrationType: 'Unregistered',
                buyerName: 'Walk-in Customer',
                buyerNTN: '',
                saleType: 'Sale to End Consumer (3rd Schedule)',
                taxRate: '0',
                rate: '0%',
            }
        case 'SN028':
            return {
                ...base,
                buyerRegistrationType: 'Unregistered',
                buyerName: 'Walk-in Customer',
                buyerNTN: '',
                saleType: 'Sale to End Consumer (Reduced Rate)',
                taxRate: '10',
                rate: '10%',
            }
        default:
            return base
    }
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    if (status === 'PASSED')
        return (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                ✓ PASSED
            </span>
        )
    if (status === 'FAILED')
        return (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                ✗ FAILED
            </span>
        )
    return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
            PENDING
        </span>
    )
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROVINCES = [
    'Punjab',
    'Sindh',
    'Khyber Pakhtunkhwa',
    'Balochistan',
    'Islamabad',
    'Azad Jammu & Kashmir',
    'Gilgit-Baltistan',
]

const COMMON_UOMS = [
    'Numbers, pieces, units',
    'KG',
    'Metric Ton',
    'Liter',
    'Meter',
    'Square Meter',
    'KWH',
    'Dozen',
    'Gram',
    'Milliliter',
]

const COMMON_RATES = ['18%', '17%', '13%', '10%', '5%', '1%', '0%']

const COMMON_SALE_TYPES = [
    'Goods at Standard Rate (default)',
    'Exempt Goods',
    'Zero Rated Goods',
    'Reduced Rate',
    '3rd Schedule Goods',
    'Sale to End Consumer (Standard Rate)',
    'Sale to End Consumer (3rd Schedule)',
    'Sale to End Consumer (Reduced Rate)',
    'Sale of Steel (Melted and Re-Rolled)',
    'Sale by Ship Breakers',
    'Toll Manufacturing sale by Steel sector',
    'Sale of Petroleum products',
    'Sale of mobile phones',
    'Processing / Conversion of Goods',
    'Sale of Goods where FED is charged in ST mode',
    'Services rendered where FED is charged in ST mode',
    'Services rendered or provided',
    'Sale of Cement / Concrete Block',
    'Sale of Potassium Chlorate',
    'Goods sold listed in SRO 297(I)/2023',
    'Telecom services rendered or provided',
    'Cotton Spinners purchase from Cotton Ginners',
]

// ─── Main component ───────────────────────────────────────────────────────────

export function SandboxScenariosModal({ open, onClose, diConfig, onScenariosUpdated }: Props) {
    const [activeScenario, setActiveScenario] = useState<string | null>(null)
    const [form, setForm] = useState<ScenarioFormData>(() =>
        getScenarioDefaults('SN001', diConfig.sellerProvince),
    )
    const [running, setRunning] = useState(false)
    const [results, setResults] = useState<Record<string, TestResult>>({})
    const [statuses, setStatuses] = useState<Record<string, string>>({})

    // Sync statuses from diConfig when modal opens
    useEffect(() => {
        if (open) {
            const map: Record<string, string> = {}
            for (const s of diConfig.sandboxScenarios ?? []) {
                map[s.scenarioId] = s.status
            }
            setStatuses(map)
            setActiveScenario(null)
            setResults({})
        }
    }, [open, diConfig.sandboxScenarios])

    if (!open) return null

    const businessActivity = diConfig.businessActivity ?? ''
    const sector = diConfig.sector ?? ''
    const requiredIds = getRequiredScenarios(businessActivity, sector)

    const passed = requiredIds.filter((id) => statuses[id] === 'PASSED').length
    const total = requiredIds.length
    const progressPct = total > 0 ? Math.round((passed / total) * 100) : 0

    function openForm(scenarioId: string) {
        setActiveScenario(scenarioId)
        setForm(getScenarioDefaults(scenarioId, diConfig.sellerProvince))
    }

    function updateForm<K extends keyof ScenarioFormData>(field: K, value: ScenarioFormData[K]) {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    async function runTest(scenarioId: string) {
        setRunning(true)
        try {
            const res = await fetch('/api/tenant/di/sandbox-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scenarioId,
                    buyer: {
                        name: form.buyerName,
                        ntn: form.buyerNTN || undefined,
                        province: form.buyerProvince,
                        address: form.buyerAddress,
                        registrationType: form.buyerRegistrationType,
                    },
                    item: {
                        hsCode: form.hsCode,
                        description: form.itemDescription,
                        quantity: parseFloat(form.quantity) || 1,
                        unitPrice: parseFloat(form.unitPrice) || 0,
                        taxRate: parseFloat(form.taxRate) || 0,
                        rate: form.rate,
                        uom: form.uom,
                        saleType: form.saleType,
                        sroScheduleNo: form.sroScheduleNo || undefined,
                    },
                }),
            })

            const data = await res.json()
            const result: TestResult = {
                success: data.success ?? false,
                diInvoiceNumber: data.diInvoiceNumber,
                errors: data.errors,
                error: data.error,
            }

            setResults((prev) => ({ ...prev, [scenarioId]: result }))
            setStatuses((prev) => ({
                ...prev,
                [scenarioId]: data.success ? 'PASSED' : 'FAILED',
            }))

            if (data.success) {
                onScenariosUpdated()
            }
        } catch {
            setResults((prev) => ({
                ...prev,
                [scenarioId]: { success: false, error: 'Network error. Check connection.' },
            }))
        } finally {
            setRunning(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-slate-800">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Sandbox Test Scenarios</h2>
                        <p className="text-sm text-slate-400 mt-0.5">
                            {businessActivity || 'Your sector'} — Run each scenario to verify your integration
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white ml-4 mt-0.5"
                    >
                        ✕
                    </button>
                </div>

                {/* Progress */}
                <div className="px-6 py-4 border-b border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-300">
                            {passed} / {total} scenarios passed
                        </span>
                        {passed === total && total > 0 && (
                            <span className="text-xs text-green-400 font-medium">
                                🎉 All complete — request Production Token from IRIS
                            </span>
                        )}
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-500 rounded-full transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>

                {/* Scenario list */}
                <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
                    {requiredIds.map((scenarioId) => {
                        const status = statuses[scenarioId] ?? 'PENDING'
                        const description = SCENARIO_DESCRIPTIONS[scenarioId] ?? scenarioId
                        const isActive = activeScenario === scenarioId
                        const result = results[scenarioId]

                        return (
                            <div
                                key={scenarioId}
                                className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden"
                            >
                                {/* Row header */}
                                <div className="flex items-center justify-between px-4 py-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="font-mono text-xs text-slate-400 shrink-0 bg-slate-700 px-2 py-0.5 rounded">
                                            {scenarioId}
                                        </span>
                                        <span className="text-sm text-white truncate">{description}</span>
                                    </div>
                                    <div className="flex items-center gap-2 ml-3 shrink-0">
                                        <StatusBadge status={status} />
                                        <button
                                            onClick={() =>
                                                isActive ? setActiveScenario(null) : openForm(scenarioId)
                                            }
                                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${isActive
                                                    ? 'bg-slate-700 text-slate-300'
                                                    : status === 'PASSED'
                                                        ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                                                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                                                }`}
                                        >
                                            {isActive ? 'Cancel' : status === 'PASSED' ? 'Re-run' : '▶ Run'}
                                        </button>
                                    </div>
                                </div>

                                {/* Inline form */}
                                {isActive && (
                                    <div className="border-t border-slate-700 px-4 py-4 space-y-4">
                                        {/* Buyer section */}
                                        <div>
                                            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                                Buyer Information
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">
                                                        Buyer Name
                                                    </label>
                                                    <input
                                                        value={form.buyerName}
                                                        onChange={(e) =>
                                                            updateForm('buyerName', e.target.value)
                                                        }
                                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white"
                                                        placeholder="Test Buyer Ltd."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">
                                                        Registration Type
                                                    </label>
                                                    <select
                                                        value={form.buyerRegistrationType}
                                                        onChange={(e) =>
                                                            updateForm(
                                                                'buyerRegistrationType',
                                                                e.target.value as 'Registered' | 'Unregistered',
                                                            )
                                                        }
                                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white"
                                                    >
                                                        <option value="Registered">Registered</option>
                                                        <option value="Unregistered">Unregistered</option>
                                                    </select>
                                                </div>
                                                {form.buyerRegistrationType === 'Registered' && (
                                                    <div>
                                                        <label className="block text-xs text-slate-400 mb-1">
                                                            Buyer NTN (7 digits)
                                                        </label>
                                                        <input
                                                            value={form.buyerNTN}
                                                            onChange={(e) =>
                                                                updateForm('buyerNTN', e.target.value)
                                                            }
                                                            maxLength={7}
                                                            pattern="\d{7}"
                                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white font-mono"
                                                            placeholder="1234567"
                                                        />
                                                    </div>
                                                )}
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">
                                                        Buyer Province
                                                    </label>
                                                    <select
                                                        value={form.buyerProvince}
                                                        onChange={(e) =>
                                                            updateForm('buyerProvince', e.target.value)
                                                        }
                                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white"
                                                    >
                                                        <option value="">Select province</option>
                                                        {PROVINCES.map((p) => (
                                                            <option key={p} value={p}>
                                                                {p}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-xs text-slate-400 mb-1">
                                                        Buyer Address
                                                    </label>
                                                    <input
                                                        value={form.buyerAddress}
                                                        onChange={(e) =>
                                                            updateForm('buyerAddress', e.target.value)
                                                        }
                                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white"
                                                        placeholder="123 Business Street, Karachi"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Item section */}
                                        <div>
                                            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                                Test Item
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">
                                                        HS Code
                                                    </label>
                                                    <input
                                                        value={form.hsCode}
                                                        onChange={(e) =>
                                                            updateForm('hsCode', e.target.value)
                                                        }
                                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white font-mono"
                                                        placeholder="8471.3000"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">
                                                        Description
                                                    </label>
                                                    <input
                                                        value={form.itemDescription}
                                                        onChange={(e) =>
                                                            updateForm('itemDescription', e.target.value)
                                                        }
                                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white"
                                                        placeholder="Product Name"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">
                                                        Quantity
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0.0001"
                                                        step="0.0001"
                                                        value={form.quantity}
                                                        onChange={(e) =>
                                                            updateForm('quantity', e.target.value)
                                                        }
                                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">
                                                        Unit Price (PKR)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step="0.01"
                                                        value={form.unitPrice}
                                                        onChange={(e) =>
                                                            updateForm('unitPrice', e.target.value)
                                                        }
                                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">
                                                        Tax Rate (%)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="0.01"
                                                        value={form.taxRate}
                                                        onChange={(e) =>
                                                            updateForm('taxRate', e.target.value)
                                                        }
                                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">
                                                        UOM
                                                    </label>
                                                    <select
                                                        value={form.uom}
                                                        onChange={(e) => updateForm('uom', e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white"
                                                    >
                                                        {COMMON_UOMS.map((u) => (
                                                            <option key={u} value={u}>
                                                                {u}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">
                                                        Rate String{' '}
                                                        <span className="text-slate-500">(exact PRAL value)</span>
                                                    </label>
                                                    <select
                                                        value={form.rate}
                                                        onChange={(e) => updateForm('rate', e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white"
                                                    >
                                                        {COMMON_RATES.map((r) => (
                                                            <option key={r} value={r}>
                                                                {r}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">
                                                        Sale Type{' '}
                                                        <span className="text-slate-500">(exact PRAL value)</span>
                                                    </label>
                                                    <select
                                                        value={form.saleType}
                                                        onChange={(e) => updateForm('saleType', e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white"
                                                    >
                                                        {COMMON_SALE_TYPES.map((s) => (
                                                            <option key={s} value={s}>
                                                                {s}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-xs text-slate-400 mb-1">
                                                        SRO Schedule No.{' '}
                                                        <span className="text-slate-500">(if applicable)</span>
                                                    </label>
                                                    <input
                                                        value={form.sroScheduleNo}
                                                        onChange={(e) =>
                                                            updateForm('sroScheduleNo', e.target.value)
                                                        }
                                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white"
                                                        placeholder="Leave blank if not applicable"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Submit */}
                                        <button
                                            onClick={() => runTest(scenarioId)}
                                            disabled={running}
                                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            {running
                                                ? '⏳ Submitting to PRAL sandbox...'
                                                : `▶ Run ${scenarioId} Test`}
                                        </button>

                                        {/* Result */}
                                        {result && (
                                            <div
                                                className={`rounded-lg p-3 text-sm space-y-2 ${result.success
                                                        ? 'bg-green-500/10 border border-green-500/20'
                                                        : 'bg-red-500/10 border border-red-500/20'
                                                    }`}
                                            >
                                                {result.success ? (
                                                    <div>
                                                        <p className="text-green-400 font-medium">
                                                            ✓ PASSED — Scenario accepted by PRAL
                                                        </p>
                                                        {result.diInvoiceNumber && (
                                                            <p className="text-green-400/70 text-xs mt-1 font-mono">
                                                                FBR Invoice No: {result.diInvoiceNumber}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <p className="text-red-400 font-medium">
                                                            ✗ FAILED — {result.error ?? 'Validation failed'}
                                                        </p>
                                                        {result.errors && result.errors.length > 0 && (
                                                            <ul className="space-y-1">
                                                                {result.errors.map((e, i) => (
                                                                    <li key={i} className="text-xs text-red-300">
                                                                        <span className="font-mono text-red-400">
                                                                            [{e.code}]
                                                                        </span>{' '}
                                                                        {e.message}
                                                                        {e.item && (
                                                                            <span className="text-red-400/60">
                                                                                {' '}
                                                                                ({e.item})
                                                                            </span>
                                                                        )}
                                                                        {e.action && (
                                                                            <span className="block text-slate-400 pl-2">
                                                                                → {e.action}
                                                                            </span>
                                                                        )}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    {requiredIds.length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-8">
                            No scenarios found for your business type. Update your business activity and sector in
                            Settings.
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                        Scenarios run against the PRAL sandbox endpoint. No production data is affected.
                    </p>
                    <button
                        onClick={onClose}
                        className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
