'use client'

import { useEffect, useMemo, useState } from 'react'
import { getScenarioPreview } from '@/lib/di/scenario-catalog'
import { ALL_SCENARIO_IDS, SCENARIO_DESCRIPTIONS, getRequiredScenarios } from '@/lib/di/scenarios'

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

interface Props {
    open?: boolean
    onClose?: () => void
    diConfig: DIConfig
    onScenariosUpdated: () => void
    embedded?: boolean
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'PASSED') {
        return (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                PASSED
            </span>
        )
    }

    if (status === 'FAILED') {
        return (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                FAILED
            </span>
        )
    }

    return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
            PENDING
        </span>
    )
}

export function SandboxScenariosModal({ open = false, onClose, diConfig, onScenariosUpdated, embedded = false }: Props) {
    const [activeScenario, setActiveScenario] = useState<string | null>(null)
    const [runningScenarioId, setRunningScenarioId] = useState<string | null>(null)
    const [runningAll, setRunningAll] = useState(false)
    const [results, setResults] = useState<Record<string, TestResult>>({})
    const [statuses, setStatuses] = useState<Record<string, string>>({})
    const isVisible = embedded || open

    useEffect(() => {
        if (!isVisible) {
            return
        }

        const nextStatuses: Record<string, string> = {}
        for (const scenario of diConfig.sandboxScenarios ?? []) {
            nextStatuses[scenario.scenarioId] = scenario.status
        }

        setStatuses(nextStatuses)
    }, [diConfig.sandboxScenarios, isVisible])

    useEffect(() => {
        if (!isVisible) {
            return
        }

        setResults({})
        setActiveScenario(null)
        setRunningScenarioId(null)
        setRunningAll(false)
    }, [isVisible])

    const businessActivity = diConfig.businessActivity ?? ''
    const sector = diConfig.sector ?? ''
    const requiredIds = useMemo(
        () => getRequiredScenarios(businessActivity, sector),
        [businessActivity, sector],
    )
    const requiredIdSet = useMemo(() => new Set(requiredIds), [requiredIds])
    const allScenarioIds = useMemo(() => ALL_SCENARIO_IDS, [])

    const passed = requiredIds.filter((id) => statuses[id] === 'PASSED').length
    const total = requiredIds.length
    const progressPct = total > 0 ? Math.round((passed / total) * 100) : 0

    if (!isVisible) {
        return null
    }

    const wrapperClassName = embedded
        ? ''
        : 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'

    const containerClassName = embedded
        ? 'flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl'
        : 'flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl'

    async function runScenario(scenarioId: string) {
        setRunningScenarioId(scenarioId)

        try {
            const res = await fetch('/api/tenant/di/sandbox-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenarioId }),
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

            return data.success === true
        } catch {
            setResults((prev) => ({
                ...prev,
                [scenarioId]: { success: false, error: 'Network error. Check connection.' },
            }))
            setStatuses((prev) => ({ ...prev, [scenarioId]: 'FAILED' }))
            return false
        } finally {
            setRunningScenarioId((current) => (current === scenarioId ? null : current))
        }
    }

    async function runAllRequired() {
        const pendingScenarioIds = requiredIds.filter((id) => statuses[id] !== 'PASSED')
        if (pendingScenarioIds.length === 0) {
            return
        }

        setRunningAll(true)
        try {
            for (const scenarioId of pendingScenarioIds) {
                await runScenario(scenarioId)
            }
        } finally {
            setRunningAll(false)
            setRunningScenarioId(null)
        }
    }

    return (
        <div className={wrapperClassName}>
            <div className={containerClassName}>
                <div className="flex items-start justify-between p-6 border-b border-slate-800">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Sandbox Test Scenarios</h2>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Guide-backed buyer and item examples are preloaded for sandbox only.
                        </p>
                    </div>
                    {!embedded && onClose && (
                        <button
                            onClick={onClose}
                            className="ml-4 mt-0.5 text-slate-400 hover:text-white"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className="px-6 py-4 border-b border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-sm text-slate-300">
                                {passed} / {total} required scenarios passed
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                Seller details come from the logged-in tenant configuration. Buyer details use the FBR guide test examples.
                            </p>
                        </div>
                        <button
                            onClick={runAllRequired}
                            disabled={runningAll || !!runningScenarioId || total === 0}
                            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            {runningAll ? 'Submitting required scenarios...' : 'Run Remaining Required'}
                        </button>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-500 rounded-full transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
                    {allScenarioIds.map((scenarioId) => {
                        const status = statuses[scenarioId] ?? 'PENDING'
                        const description = SCENARIO_DESCRIPTIONS[scenarioId] ?? scenarioId
                        const isActive = activeScenario === scenarioId
                        const result = results[scenarioId]
                        const preview = getScenarioPreview(scenarioId)
                        const isRunning = runningScenarioId === scenarioId
                        const isRequired = requiredIdSet.has(scenarioId)

                        return (
                            <div
                                key={scenarioId}
                                className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden"
                            >
                                <div className="flex items-center justify-between px-4 py-3 gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="font-mono text-xs text-slate-400 shrink-0 bg-slate-700 px-2 py-0.5 rounded">
                                            {scenarioId}
                                        </span>
                                        <span
                                            className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${isRequired
                                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                                                : 'bg-slate-700 text-slate-400 border border-slate-600'
                                                }`}
                                        >
                                            {isRequired ? 'Required' : 'Optional'}
                                        </span>
                                        <span className="text-sm text-white truncate">{description}</span>
                                    </div>
                                    <div className="flex items-center gap-2 ml-3 shrink-0">
                                        <StatusBadge status={status} />
                                        <button
                                            onClick={() =>
                                                setActiveScenario((current) =>
                                                    current === scenarioId ? null : scenarioId,
                                                )
                                            }
                                            className="text-xs px-3 py-1.5 rounded-lg font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                                        >
                                            {isActive ? 'Hide' : 'Preview'}
                                        </button>
                                        <button
                                            onClick={() => runScenario(scenarioId)}
                                            disabled={runningAll || !!runningScenarioId}
                                            className="text-xs px-3 py-1.5 rounded-lg font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white transition-colors"
                                        >
                                            {isRunning ? 'Submitting...' : status === 'PASSED' ? 'Re-run' : 'Run'}
                                        </button>
                                    </div>
                                </div>

                                {isActive && (
                                    <div className="border-t border-slate-700 px-4 py-4 space-y-4">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                                                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                                                    Buyer Example
                                                </p>
                                                <div className="space-y-2 text-sm">
                                                    <div>
                                                        <span className="text-slate-500">Name:</span>{' '}
                                                        <span className="text-white">{preview.buyer.businessName}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">NTN/CNIC:</span>{' '}
                                                        <span className="text-white font-mono">
                                                            {preview.buyer.ntcnic ?? 'Not provided'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">Registration:</span>{' '}
                                                        <span className="text-white">{preview.buyer.registrationType}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">Province:</span>{' '}
                                                        <span className="text-white">{preview.buyer.province}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">Address:</span>{' '}
                                                        <span className="text-white">{preview.buyer.address}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                                                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                                                    Scenario Items
                                                </p>
                                                <div className="space-y-3">
                                                    {preview.items.map((item, index) => (
                                                        <div key={`${scenarioId}-${index}`} className="border border-slate-700 rounded-lg p-3 space-y-2">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="text-sm text-white truncate">
                                                                    {item.productDescription || 'No description'}
                                                                </span>
                                                                <span className="text-xs text-slate-400 font-mono">
                                                                    {item.hsCode}
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                                                                <div>Rate: <span className="text-slate-200">{item.rate}</span></div>
                                                                <div>Sale type: <span className="text-slate-200">{item.saleType}</span></div>
                                                                <div>Quantity: <span className="text-slate-200">{item.quantity}</span></div>
                                                                <div>UOM: <span className="text-slate-200">{item.uoM}</span></div>
                                                                <div>Value excl. ST: <span className="text-slate-200">{item.valueSalesExcludingST}</span></div>
                                                                <div>Sales tax: <span className="text-slate-200">{item.salesTaxApplicable}</span></div>
                                                                <div>Total values: <span className="text-slate-200">{item.totalValues}</span></div>
                                                                <div>Fixed value/MRP: <span className="text-slate-200">{item.fixedNotifiedValueOrRetailPrice}</span></div>
                                                                <div>SRO schedule: <span className="text-slate-200">{item.sroScheduleNo || 'N/A'}</span></div>
                                                                <div>SRO serial: <span className="text-slate-200">{item.sroItemSerialNo || 'N/A'}</span></div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

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
                                                            Scenario accepted by PRAL sandbox.
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
                                                            Submission failed: {result.error ?? 'Validation failed'}
                                                        </p>
                                                        {result.errors && result.errors.length > 0 && (
                                                            <ul className="space-y-1">
                                                                {result.errors.map((error, index) => (
                                                                    <li key={index} className="text-xs text-red-300">
                                                                        <span className="font-mono text-red-400">
                                                                            [{error.code}]
                                                                        </span>{' '}
                                                                        {error.message}
                                                                        {error.item && (
                                                                            <span className="text-red-400/60">
                                                                                {' '}
                                                                                ({error.item})
                                                                            </span>
                                                                        )}
                                                                        {error.action && (
                                                                            <span className="block text-slate-400 pl-2">
                                                                                {error.action}
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

                    {allScenarioIds.length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-8">
                            No scenarios found for your business type. Update your business activity and sector in Settings.
                        </p>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between gap-4">
                    <p className="text-xs text-slate-500">
                        Sandbox examples are taken from the FBR guide and should be replaced with actual buyer data during real invoicing.
                    </p>
                    {!embedded && onClose && (
                        <button
                            onClick={onClose}
                            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
