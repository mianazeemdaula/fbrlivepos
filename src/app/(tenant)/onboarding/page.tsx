'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const BUSINESS_ACTIVITIES = [
    'Manufacturer', 'Importer', 'Distributor', 'Wholesaler',
    'Exporter', 'Retailer', 'Service Provider', 'Other',
]

const SECTORS = [
    'All Other Sectors', 'Steel', 'FMCG', 'Textile', 'Telecom',
    'Petroleum', 'Electricity Distribution', 'Gas Distribution',
    'Services', 'Automobile', 'CNG Stations', 'Pharmaceuticals', 'Wholesale / Retail',
]

const PROVINCES = ['PUNJAB', 'SINDH', 'KPK', 'BALOCHISTAN', 'ISLAMABAD', 'AJK', 'GILGIT-BALTISTAN']

interface Step1Form {
    sellerNTN: string
    sellerCNIC: string
    sellerBusinessName: string
    sellerProvince: string
    sellerAddress: string
}

interface Step2Form {
    businessActivity: string
    sector: string
}

interface Step3Form {
    sandboxToken: string
    productionToken: string
    environment: 'SANDBOX' | 'PRODUCTION'
}

interface ApplicableScenario {
    scenarioId: string
    description: string
    saleType: string
}

export default function OnboardingPage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [applicableScenarios, setApplicableScenarios] = useState<ApplicableScenario[]>([])
    const [scenariosLoading, setScenariosLoading] = useState(false)

    const [step1, setStep1] = useState<Step1Form>({
        sellerNTN: '',
        sellerCNIC: '',
        sellerBusinessName: '',
        sellerProvince: 'PUNJAB',
        sellerAddress: '',
    })

    const [step2, setStep2] = useState<Step2Form>({
        businessActivity: 'Manufacturer',
        sector: 'All Other Sectors',
    })

    const [step3, setStep3] = useState<Step3Form>({
        sandboxToken: '',
        productionToken: '',
        environment: 'SANDBOX',
    })

    useEffect(() => {
        if (step !== 2 || !step2.businessActivity || !step2.sector) return
        setScenariosLoading(true)

        fetch(`/api/tenant/di/scenarios?activity=${encodeURIComponent(step2.businessActivity)}&sector=${encodeURIComponent(step2.sector)}`)
            .then(r => r.json())
            .then(data => setApplicableScenarios(data.scenarios || []))
            .catch(() => { })
            .finally(() => setScenariosLoading(false))
    }, [step, step2.businessActivity, step2.sector])

    async function handleComplete() {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/tenant/di/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...step1,
                    ...step2,
                    ...step3,
                }),
            })

            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'Failed to save setup.')
                return
            }

            router.push('/dashboard')
        } catch {
            setError('Network error. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const stepTitles = [
        'Business Identity',
        'Activity & Sector',
        'PRAL Token',
        'Review & Complete',
    ]

    return (
        <div className="min-h-screen p-6 lg:p-10">
            <div className="mx-auto max-w-2xl">
                {/* Header */}
                <div className="mb-8">
                    <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Setup Wizard</p>
                    <h1 className="brand-heading mt-2 text-3xl font-bold text-white">FBR Digital Invoicing Setup</h1>
                    <p className="mt-2 text-sm text-[#8d897d]">
                        Complete these steps to configure your FBR DI credentials and start issuing compliant invoices.
                    </p>
                </div>

                {/* Step indicator */}
                <div className="mb-8 flex gap-2">
                    {stepTitles.map((title, i) => (
                        <div key={i} className="flex flex-1 flex-col items-center gap-1">
                            <div
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${i + 1 < step
                                    ? 'bg-green-500/80 text-white'
                                    : i + 1 === step
                                        ? 'bg-[#c8a45a] text-primary'
                                        : 'bg-white/10 text-[#8d897d]'
                                    }`}
                            >
                                {i + 1 < step ? '✓' : i + 1}
                            </div>
                            <p className="hidden text-center text-[10px] text-[#8d897d] sm:block">{title}</p>
                        </div>
                    ))}
                </div>

                {/* Panel */}
                <div className="app-panel rounded-2xl p-6">
                    {error && (
                        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    {/* ── Step 1: Business Identity ── */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold text-white">Business Identity</h2>
                            <p className="text-sm text-[#8d897d]">
                                Enter your taxpayer details exactly as registered with FBR/IRIS.
                            </p>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs text-[#c1bcaf]">NTN (7-digit)</label>
                                    <input
                                        value={step1.sellerNTN}
                                        onChange={e => setStep1(s => ({ ...s, sellerNTN: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
                                        placeholder="e.g. 2893028"
                                        className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white placeholder:text-[#8d897d]"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs text-[#c1bcaf]">CNIC (13-digit, optional)</label>
                                    <input
                                        value={step1.sellerCNIC}
                                        onChange={e => setStep1(s => ({ ...s, sellerCNIC: e.target.value.replace(/\D/g, '').slice(0, 13) }))}
                                        placeholder="e.g. 3530118686639"
                                        className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white placeholder:text-[#8d897d]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs text-[#c1bcaf]">Registered Business Name</label>
                                <input
                                    value={step1.sellerBusinessName}
                                    onChange={e => setStep1(s => ({ ...s, sellerBusinessName: e.target.value }))}
                                    placeholder="e.g. ALI PROTEIN FARM"
                                    className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white placeholder:text-[#8d897d]"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs text-[#c1bcaf]">Province</label>
                                <select
                                    value={step1.sellerProvince}
                                    onChange={e => setStep1(s => ({ ...s, sellerProvince: e.target.value }))}
                                    className="w-full rounded-xl border border-white/10 bg-[#0e1d17] px-3 py-2 text-sm text-white"
                                >
                                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs text-[#c1bcaf]">Business Address</label>
                                <textarea
                                    value={step1.sellerAddress}
                                    onChange={e => setStep1(s => ({ ...s, sellerAddress: e.target.value }))}
                                    rows={2}
                                    placeholder="Full business address as registered with FBR"
                                    className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white placeholder:text-[#8d897d] resize-none"
                                />
                            </div>

                            <button
                                onClick={() => {
                                    if (!step1.sellerNTN || !step1.sellerBusinessName || !step1.sellerAddress) {
                                        setError('NTN, business name, and address are required.')
                                        return
                                    }
                                    setError('')
                                    setStep(2)
                                }}
                                className="w-full rounded-full bg-accent py-2.5 text-sm font-medium text-primary transition-colors hover:bg-[--accent-soft]"
                            >
                                Next: Activity & Sector →
                            </button>
                        </div>
                    )}

                    {/* ── Step 2: Business Activity & Sector ── */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold text-white">Business Activity & Sector</h2>
                            <p className="text-sm text-[#8d897d]">
                                This determines which FBR invoice scenarios you are required to support.
                            </p>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs text-[#c1bcaf]">Business Activity</label>
                                    <select
                                        value={step2.businessActivity}
                                        onChange={e => setStep2(s => ({ ...s, businessActivity: e.target.value }))}
                                        className="w-full rounded-xl border border-white/10 bg-[#0e1d17] px-3 py-2 text-sm text-white"
                                    >
                                        {BUSINESS_ACTIVITIES.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs text-[#c1bcaf]">Sector</label>
                                    <select
                                        value={step2.sector}
                                        onChange={e => setStep2(s => ({ ...s, sector: e.target.value }))}
                                        className="w-full rounded-xl border border-white/10 bg-[#0e1d17] px-3 py-2 text-sm text-white"
                                    >
                                        {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            {scenariosLoading ? (
                                <p className="text-xs text-[#8d897d]">Loading applicable scenarios…</p>
                            ) : applicableScenarios.length > 0 ? (
                                <div className="rounded-xl border border-white/10 bg-[#0b1510] p-4">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#f0d9a0]">
                                        Applicable Scenarios ({applicableScenarios.length})
                                    </p>
                                    <div className="max-h-48 overflow-auto space-y-1">
                                        {applicableScenarios.map(s => (
                                            <div key={s.scenarioId} className="flex items-start gap-2 text-xs">
                                                <span className="shrink-0 font-mono text-[#c8a45a]">{s.scenarioId}</span>
                                                <span className="text-[#c1bcaf]">{s.description}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 rounded-full border border-white/10 py-2.5 text-sm text-[#c1bcaf] hover:bg-white/6"
                                >
                                    ← Back
                                </button>
                                <button
                                    onClick={() => { setError(''); setStep(3) }}
                                    className="flex-1 rounded-full bg-accent py-2.5 text-sm font-medium text-primary hover:bg-[--accent-soft]"
                                >
                                    Next: PRAL Token →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: PRAL Token ── */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold text-white">PRAL Bearer Token</h2>
                            <p className="text-sm text-[#8d897d]">
                                Your token is issued by PRAL and is valid for 5 years. It is stored encrypted.
                                Environment routing is determined by which token is active — same URL for sandbox and production.
                            </p>

                            <div>
                                <label className="mb-1 block text-xs text-[#c1bcaf]">Environment</label>
                                <div className="flex gap-2">
                                    {(['SANDBOX', 'PRODUCTION'] as const).map(env => (
                                        <button
                                            key={env}
                                            onClick={() => setStep3(s => ({ ...s, environment: env }))}
                                            className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-colors ${step3.environment === env
                                                ? 'border-[#c8a45a] bg-[#c8a45a]/10 text-[#f0d9a0]'
                                                : 'border-white/10 text-[#8d897d] hover:border-white/20'
                                                }`}
                                        >
                                            {env}
                                        </button>
                                    ))}
                                </div>
                                {step3.environment === 'PRODUCTION' && (
                                    <p className="mt-2 text-xs text-amber-400">
                                        ⚠ Production token enables live FBR submissions. Use Sandbox for testing.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="mb-1 block text-xs text-[#c1bcaf]">Sandbox Token</label>
                                <input
                                    type="password"
                                    value={step3.sandboxToken}
                                    onChange={e => setStep3(s => ({ ...s, sandboxToken: e.target.value }))}
                                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                    className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white font-mono placeholder:text-[#8d897d]"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs text-[#c1bcaf]">Production Token (when ready)</label>
                                <input
                                    type="password"
                                    value={step3.productionToken}
                                    onChange={e => setStep3(s => ({ ...s, productionToken: e.target.value }))}
                                    placeholder="Leave blank if not yet issued"
                                    className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white font-mono placeholder:text-[#8d897d]"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(2)}
                                    className="flex-1 rounded-full border border-white/10 py-2.5 text-sm text-[#c1bcaf] hover:bg-white/6"
                                >
                                    ← Back
                                </button>
                                <button
                                    onClick={() => { setError(''); setStep(4) }}
                                    className="flex-1 rounded-full bg-accent py-2.5 text-sm font-medium text-primary hover:bg-[--accent-soft]"
                                >
                                    Review →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 4: Review & Complete ── */}
                    {step === 4 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold text-white">Review & Complete</h2>

                            <div className="space-y-3 rounded-xl border border-white/10 bg-[#0b1510] p-4 text-sm">
                                <Row label="NTN" value={step1.sellerNTN} />
                                {step1.sellerCNIC && <Row label="CNIC" value={step1.sellerCNIC} />}
                                <Row label="Business Name" value={step1.sellerBusinessName} />
                                <Row label="Province" value={step1.sellerProvince} />
                                <Row label="Address" value={step1.sellerAddress} />
                                <Row label="Business Activity" value={step2.businessActivity} />
                                <Row label="Sector" value={step2.sector} />
                                <Row label="Environment" value={step3.environment} />
                                <Row label="Sandbox Token" value={step3.sandboxToken ? '●●●●●●●● (set)' : 'Not set'} />
                                <Row label="Production Token" value={step3.productionToken ? '●●●●●●●● (set)' : 'Not yet issued'} />
                                <Row label="Scenarios Initialised" value={`${applicableScenarios.length} scenarios for ${step2.businessActivity} / ${step2.sector}`} />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(3)}
                                    className="flex-1 rounded-full border border-white/10 py-2.5 text-sm text-[#c1bcaf] hover:bg-white/6"
                                >
                                    ← Back
                                </button>
                                <button
                                    onClick={handleComplete}
                                    disabled={loading}
                                    className="flex-1 rounded-full bg-accent py-2.5 text-sm font-medium text-primary hover:bg-[--accent-soft] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {loading ? 'Saving…' : '✓ Complete Setup'}
                                </button>
                            </div>

                            <p className="text-center text-xs text-[#8d897d]">
                                You can update these settings anytime in Settings → FBR Credentials.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-4">
            <span className="text-[#8d897d]">{label}</span>
            <span className="text-right text-white">{value || '—'}</span>
        </div>
    )
}
