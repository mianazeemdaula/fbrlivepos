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
        <span className="text-xs px-2 py-0.5 rounded-full border border-[rgba(200,164,90,0.25)] bg-[rgba(200,164,90,0.12)] text-[#f0d9a0]">
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
        ? 'app-panel flex flex-col rounded-2xl border border-white/10 shadow-2xl'
        : 'app-panel flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-white/10 shadow-2xl'

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
                <div className="flex items-start justify-between border-b border-white/10 p-6">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Sandbox Test Scenarios</h2>
                        <p className="mt-0.5 text-sm text-[#c1bcaf]">
                            Guide-backed buyer and item examples are preloaded for sandbox only.
                        </p>
                    </div>
                    {!embedded && onClose && (
                        <button
                            onClick={onClose}
                            className="ml-4 mt-0.5 text-[#c1bcaf] transition-colors hover:text-white"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className="space-y-3 border-b border-white/10 px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-sm text-[#e7e0cf]">
                                {passed} / {total} required scenarios passed
                            </p>
                            <p className="mt-1 text-xs text-[#8d897d]">
                                Seller details come from the logged-in tenant configuration. Buyer details use the FBR guide test examples.
                            </p>
                        </div>
                        <button
                            onClick={runAllRequired}
                            disabled={runningAll || !!runningScenarioId || total === 0}
                            className="rounded-lg bg-[var(--primary-strong)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--primary)] disabled:cursor-not-allowed disabled:bg-[rgba(1,65,28,0.35)]"
                        >
                            {runningAll ? 'Submitting required scenarios...' : 'Run Remaining Required'}
                        </button>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[rgba(240,217,160,0.12)]">
                        <div
                            className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
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
                                className="overflow-hidden rounded-xl border border-white/10 bg-[rgba(29,44,34,0.72)]"
                            >
                                <div className="flex items-center justify-between px-4 py-3 gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="shrink-0 rounded bg-[rgba(240,217,160,0.12)] px-2 py-0.5 font-mono text-xs text-[#f0d9a0]">
                                            {scenarioId}
                                        </span>
                                        <span
                                            className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${isRequired
                                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                                                : 'border border-white/10 bg-[rgba(255,255,255,0.06)] text-[#c1bcaf]'
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
                                            className="rounded-lg border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-medium text-[#d8d0bf] transition-colors hover:bg-white/10 hover:text-white"
                                        >
                                            {isActive ? 'Hide' : 'Preview'}
                                        </button>
                                        <button
                                            onClick={() => runScenario(scenarioId)}
                                            disabled={runningAll || !!runningScenarioId}
                                            className="rounded-lg bg-[var(--primary-strong)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--primary)] disabled:cursor-not-allowed disabled:bg-[rgba(1,65,28,0.35)]"
                                        >
                                            {isRunning ? 'Submitting...' : status === 'PASSED' ? 'Re-run' : 'Run'}
                                        </button>
                                    </div>
                                </div>

                                {isActive && (
                                    <div className="space-y-4 border-t border-white/10 px-4 py-4">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <div className="rounded-xl border border-white/10 bg-[rgba(10,18,13,0.4)] p-4">
                                                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[#c1bcaf]">
                                                    Buyer Example
                                                </p>
                                                <div className="space-y-2 text-sm">
                                                    <div>
                                                        <span className="text-[#8d897d]">Name:</span>{' '}
                                                        <span className="text-white">{preview.buyer.businessName}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[#8d897d]">NTN/CNIC:</span>{' '}
                                                        <span className="text-white font-mono">
                                                            {preview.buyer.ntcnic ?? 'Not provided'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[#8d897d]">Registration:</span>{' '}
                                                        <span className="text-white">{preview.buyer.registrationType}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[#8d897d]">Province:</span>{' '}
                                                        <span className="text-white">{preview.buyer.province}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[#8d897d]">Address:</span>{' '}
                                                        <span className="text-white">{preview.buyer.address}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="rounded-xl border border-white/10 bg-[rgba(10,18,13,0.4)] p-4">
                                                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[#c1bcaf]">
                                                    Scenario Items
                                                </p>
                                                <div className="space-y-3">
                                                    {preview.items.map((item, index) => (
                                                        <div key={`${scenarioId}-${index}`} className="space-y-2 rounded-lg border border-white/10 p-3">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="text-sm text-white truncate">
                                                                    {item.productDescription || 'No description'}
                                                                </span>
                                                                <span className="font-mono text-xs text-[#c1bcaf]">
                                                                    {item.hsCode}
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2 text-xs text-[#8d897d]">
                                                                <div>Rate: <span className="text-[#e7e0cf]">{item.rate}</span></div>
                                                                <div>Sale type: <span className="text-[#e7e0cf]">{item.saleType}</span></div>
                                                                <div>Quantity: <span className="text-[#e7e0cf]">{item.quantity}</span></div>
                                                                <div>UOM: <span className="text-[#e7e0cf]">{item.uoM}</span></div>
                                                                <div>Value excl. ST: <span className="text-[#e7e0cf]">{item.valueSalesExcludingST}</span></div>
                                                                <div>Sales tax: <span className="text-[#e7e0cf]">{item.salesTaxApplicable}</span></div>
                                                                <div>Total values: <span className="text-[#e7e0cf]">{item.totalValues}</span></div>
                                                                <div>Fixed value/MRP: <span className="text-[#e7e0cf]">{item.fixedNotifiedValueOrRetailPrice}</span></div>
                                                                <div>SRO schedule: <span className="text-[#e7e0cf]">{item.sroScheduleNo || 'N/A'}</span></div>
                                                                <div>SRO serial: <span className="text-[#e7e0cf]">{item.sroItemSerialNo || 'N/A'}</span></div>
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
                                                                            <span className="block pl-2 text-[#c1bcaf]">
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
                        <p className="py-8 text-center text-sm text-[#c1bcaf]">
                            No scenarios found for your business type. Update your business activity and sector in Settings.
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-white/10 px-6 py-4">
                    <p className="text-xs text-[#8d897d]">
                        Sandbox examples are taken from the FBR guide and should be replaced with actual buyer data during real invoicing.
                    </p>
                    {!embedded && onClose && (
                        <button
                            onClick={onClose}
                            className="rounded-lg border border-white/10 bg-white/6 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
