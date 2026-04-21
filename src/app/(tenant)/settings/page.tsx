'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ALL_SCENARIO_IDS } from '@/lib/di/scenarios'
import { isValidSellerNtn, normalizeNtnCnic } from '@/lib/validation/pakistan'

interface DIConfig {
    configured: boolean
    sellerNTN?: string
    sellerCNIC?: string | null
    sellerProvince?: string
    sellerBusinessName?: string
    sellerAddress?: string
    businessActivity?: string
    sector?: string
    environment?: string
    irisRegistrationStatus?: string
    hasSandboxToken?: boolean
    hasProductionToken?: boolean
    isProductionReady?: boolean
    sandboxScenarios?: Array<{
        scenarioId: string
        description: string | null
        status: string
    }>
}

interface DIFormState {
    sellerNTN: string
    sellerCNIC: string
    sellerBusinessName: string
    sellerProvince: string
    sellerAddress: string
    businessActivity: string
    sector: string
    sandboxToken: string
    productionToken: string
    environment: string
}

function createEmptyFormState(): DIFormState {
    return {
        sellerNTN: '',
        sellerCNIC: '',
        sellerBusinessName: '',
        sellerProvince: '',
        sellerAddress: '',
        businessActivity: '',
        sector: '',
        sandboxToken: '',
        productionToken: '',
        environment: 'SANDBOX',
    }
}

function createFormStateFromConfig(config?: DIConfig | null): DIFormState {
    return {
        sellerNTN: config?.sellerNTN ?? '',
        sellerCNIC: config?.sellerCNIC ?? '',
        sellerBusinessName: config?.sellerBusinessName ?? '',
        sellerProvince: config?.sellerProvince ?? '',
        sellerAddress: config?.sellerAddress ?? '',
        businessActivity: config?.businessActivity ?? '',
        sector: config?.sector ?? '',
        sandboxToken: '',
        productionToken: '',
        environment: config?.environment ?? 'SANDBOX',
    }
}

export default function SettingsPage() {
    const router = useRouter()
    const { update } = useSession()
    const [diConfig, setDiConfig] = useState<DIConfig | null>(null)
    const [form, setForm] = useState<DIFormState>(createEmptyFormState)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [step, setStep] = useState(1) // Wizard step: 1=Business Info, 2=Token, 3=Verify, 4=Sandbox, 5=Production

    const normalizedSellerCnic = normalizeNtnCnic(form.sellerCNIC)

    useEffect(() => {
        async function loadConfig() {
            try {
                const res = await fetch('/api/tenant/fbr-credentials')
                if (res.ok) {
                    const config: DIConfig = await res.json()
                    setDiConfig(config)
                    setForm(createFormStateFromConfig(config))
                    // Auto-detect wizard step
                    if (!config.configured) {
                        setStep(1)
                    } else if (!config.hasSandboxToken && !config.hasProductionToken) {
                        setStep(2)
                    } else if (!config.sandboxScenarios || config.sandboxScenarios.length === 0 || config.sandboxScenarios.some(s => s.status !== 'PASSED')) {
                        setStep(config.environment === 'SANDBOX' ? 4 : 5)
                    } else if (config.isProductionReady) {
                        setStep(5)
                    } else {
                        setStep(3)
                    }
                }
            } catch {
                // Ignore
            } finally {
                setLoading(false)
            }
        }
        loadConfig()
    }, [])

    async function handleSaveDI(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setSaving(true)
        setMessage(null)

        if (!isValidSellerNtn(form.sellerNTN)) {
            setMessage({ type: 'error', text: 'Seller NTN/registration must be 7, 8, or 9 digits. Values like 6650624-2 are accepted.' })
            setSaving(false)
            return
        }

        if (normalizedSellerCnic && normalizedSellerCnic.length !== 13) {
            setMessage({ type: 'error', text: 'Seller CNIC must be 13 digits when provided.' })
            setSaving(false)
            return
        }

        const data = {
            sellerNTN: form.sellerNTN,
            sellerCNIC: normalizedSellerCnic || undefined,
            sellerBusinessName: form.sellerBusinessName,
            sellerProvince: form.sellerProvince,
            sellerAddress: form.sellerAddress,
            businessActivity: form.businessActivity,
            sector: form.sector,
            sandboxToken: form.sandboxToken || undefined,
            productionToken: form.productionToken || undefined,
            environment: form.environment,
        }

        try {
            const res = await fetch('/api/tenant/fbr-credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })

            if (res.ok) {
                setMessage({ type: 'success', text: 'PRAL DI credentials saved successfully!' })
                if (data.sandboxToken || data.productionToken) {
                    await update({ diConfigured: true })
                }
                const updated = await fetch('/api/tenant/fbr-credentials')
                if (updated.ok) {
                    const config: DIConfig = await updated.json()
                    setDiConfig(config)
                    setForm(createFormStateFromConfig(config))
                }
            } else {
                const result = await res.json()
                setMessage({ type: 'error', text: result.error || 'Failed to save' })
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error' })
        } finally {
            setSaving(false)
        }
    }

    async function handleVerify() {
        setVerifying(true)
        setMessage(null)

        try {
            const res = await fetch('/api/tenant/fbr-credentials/verify', { method: 'POST' })
            const data = await res.json()

            if (res.ok && data.success) {
                await update({ diConfigured: true })
                setMessage({ type: 'success', text: 'PRAL DI token verified successfully!' })
                router.replace('/dashboard')
                router.refresh()
            } else {
                setMessage({ type: 'error', text: data.error || 'Verification failed' })
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error' })
        } finally {
            setVerifying(false)
        }
    }

    function updateFormField<K extends keyof DIFormState>(field: K, value: DIFormState[K]) {
        setForm((current) => ({ ...current, [field]: value }))
    }

    const sortedSandboxScenarios = [...(diConfig?.sandboxScenarios ?? [])].sort(
        (left, right) => ALL_SCENARIO_IDS.indexOf(left.scenarioId) - ALL_SCENARIO_IDS.indexOf(right.scenarioId),
    )

    return (
        <div className="max-w-3xl p-6 lg:p-8">
            <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Compliance setup</p>
            <h1 className="brand-heading mb-6 mt-2 text-3xl font-bold text-white">Settings</h1>

            {/* Integration Progress Steps */}
            <div className="app-panel mb-6 rounded-2xl p-4">
                <h2 className="mb-3 text-sm font-semibold text-[#c1bcaf]">PRAL DI Integration Progress</h2>
                <div className="flex items-center gap-1">
                    {[
                        { n: 1, label: 'Business Info' },
                        { n: 2, label: 'Token Setup' },
                        { n: 3, label: 'Verify Token' },
                        { n: 4, label: 'Sandbox Tests' },
                        { n: 5, label: 'Production' },
                    ].map((s, i) => (
                        <div key={s.n} className="flex items-center flex-1">
                            <button
                                onClick={() => setStep(s.n)}
                                className={`flex-1 text-center py-2 rounded-lg text-xs font-medium transition-colors ${step === s.n
                                    ? 'bg-accent text-primary'
                                    : step > s.n || (s.n === 1 && diConfig?.configured)
                                        ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                        : 'bg-white/6 text-[#8d897d] hover:bg-white/10'
                                    }`}
                            >
                                {step > s.n || (s.n === 1 && diConfig?.configured && step !== s.n) ? '✓ ' : `${s.n}. `}
                                {s.label}
                            </button>
                            {i < 4 && <div className="mx-0.5 h-px w-2 bg-white/10" />}
                        </div>
                    ))}
                </div>
            </div>

            {/* PRAL DI Credentials */}
            <div className="app-panel mb-6 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">PRAL Digital Invoicing</h2>
                <p className="mb-4 text-sm text-[#c1bcaf]">
                    Configure your PRAL DI credentials obtained from IRIS registration.
                    Tokens are encrypted at rest with AES-256-GCM.
                </p>

                {loading ? (
                    <div className="animate-pulse space-y-3">
                        <div className="h-10 rounded bg-white/10" />
                        <div className="h-10 rounded bg-white/10" />
                    </div>
                ) : (
                    <>
                        {diConfig?.configured && (
                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
                                <p className="text-sm text-green-400">
                                    DI configured — Environment: {diConfig.environment}
                                    {diConfig.isProductionReady && ' (Production Ready)'}
                                </p>
                                {diConfig.irisRegistrationStatus && (
                                    <p className="text-xs text-green-400/70 mt-1">
                                        IRIS Status: {diConfig.irisRegistrationStatus}
                                    </p>
                                )}
                            </div>
                        )}

                        <form onSubmit={handleSaveDI} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs text-[#c1bcaf]">Seller NTN / Registration No.</label>
                                    <input
                                        name="sellerNTN"
                                        required
                                        value={form.sellerNTN}
                                        onChange={(e) => updateFormField('sellerNTN', e.target.value)}
                                        className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                                        placeholder="1234567 or 6650624-2"
                                    />
                                    {form.sellerNTN && !isValidSellerNtn(form.sellerNTN) && (
                                        <p className="mt-1 text-xs text-amber-400">Use 7, 8, or 9 digits. Hyphenated values are normalized automatically.</p>
                                    )}
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs text-[#c1bcaf]">CNIC (optional fallback)</label>
                                    <input
                                        name="sellerCNIC"
                                        value={form.sellerCNIC}
                                        onChange={(e) => updateFormField('sellerCNIC', e.target.value)}
                                        className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                                        placeholder="3520112345678"
                                    />
                                    {form.sellerCNIC && normalizedSellerCnic.length !== 13 && (
                                        <p className="mt-1 text-xs text-amber-400">CNIC is optional, but if provided it must be 13 digits.</p>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-[#c1bcaf]">Business Name</label>
                                <input
                                    name="sellerBusinessName"
                                    required
                                    value={form.sellerBusinessName}
                                    onChange={(e) => updateFormField('sellerBusinessName', e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                                    placeholder="Your registered business name"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs text-[#c1bcaf]">Province</label>
                                    <select
                                        name="sellerProvince"
                                        required
                                        value={form.sellerProvince}
                                        onChange={(e) => updateFormField('sellerProvince', e.target.value)}
                                        className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                                    >
                                        <option value="">Select province</option>
                                        <option value="Punjab">Punjab</option>
                                        <option value="Sindh">Sindh</option>
                                        <option value="Khyber Pakhtunkhwa">Khyber Pakhtunkhwa</option>
                                        <option value="Balochistan">Balochistan</option>
                                        <option value="Islamabad">Islamabad</option>
                                        <option value="Azad Jammu & Kashmir">Azad Jammu & Kashmir</option>
                                        <option value="Gilgit-Baltistan">Gilgit-Baltistan</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs text-[#c1bcaf]">Business Activity</label>
                                    <input
                                        name="businessActivity"
                                        required
                                        value={form.businessActivity}
                                        onChange={(e) => updateFormField('businessActivity', e.target.value)}
                                        className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                                        placeholder="e.g. Retail, Manufacturing"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-[#c1bcaf]">Business Address</label>
                                <input
                                    name="sellerAddress"
                                    required
                                    value={form.sellerAddress}
                                    onChange={(e) => updateFormField('sellerAddress', e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                                    placeholder="Full business address"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-[#c1bcaf]">Sector</label>
                                <input
                                    name="sector"
                                    required
                                    value={form.sector}
                                    onChange={(e) => updateFormField('sector', e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                                    placeholder="e.g. Tier-1 Retailer"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-[#c1bcaf]">Sandbox Security Token (from IRIS)</label>
                                <input
                                    name="sandboxToken"
                                    type="password"
                                    value={form.sandboxToken}
                                    onChange={(e) => updateFormField('sandboxToken', e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm font-mono text-white"
                                    placeholder={diConfig?.hasSandboxToken ? 'A sandbox token is already stored. Enter a new token to replace it.' : 'Paste your sandbox IRIS security token'}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-[#c1bcaf]">Production Security Token (from IRIS)</label>
                                <input
                                    name="productionToken"
                                    type="password"
                                    value={form.productionToken}
                                    onChange={(e) => updateFormField('productionToken', e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm font-mono text-white"
                                    placeholder={diConfig?.hasProductionToken ? 'A production token is already stored. Enter a new token to replace it.' : 'Paste your production IRIS security token'}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-[#c1bcaf]">Environment</label>
                                <select
                                    name="environment"
                                    value={form.environment}
                                    onChange={(e) => updateFormField('environment', e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                                >
                                    <option value="SANDBOX">Sandbox (Testing)</option>
                                    <option value="PRODUCTION">Production</option>
                                </select>
                            </div>

                            {message && (
                                <div
                                    className={`text-sm rounded-lg p-3 ${message.type === 'success'
                                        ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                                        : 'bg-red-500/10 text-red-400 border border-red-500/30'
                                        }`}
                                >
                                    {message.text}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-primary disabled:opacity-70"
                                >
                                    {saving ? 'Saving...' : 'Save Credentials'}
                                </button>
                                {diConfig?.configured && (
                                    <button
                                        type="button"
                                        onClick={handleVerify}
                                        disabled={verifying}
                                        className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-medium text-[#d8d0bf] hover:bg-white/10"
                                    >
                                        {verifying ? 'Verifying...' : 'Verify Token'}
                                    </button>
                                )}
                            </div>
                        </form>
                    </>
                )}
            </div>

            {/* Sandbox Scenarios Progress */}
            {diConfig?.configured && diConfig.environment === 'SANDBOX' && (
                <div className="app-panel rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-white">Sandbox Test Scenarios</h2>
                            <p className="mt-0.5 text-sm text-[#c1bcaf]">
                                Use the dedicated scenarios page to run and review sandbox submissions.
                            </p>
                        </div>
                    </div>
                    {sortedSandboxScenarios.length > 0 && (
                        <div className="space-y-2">
                            {sortedSandboxScenarios.map((s) => (
                                <div
                                    key={s.scenarioId}
                                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/6 px-4 py-2"
                                >
                                    <div>
                                        <span className="text-sm text-white font-mono">{s.scenarioId}</span>
                                        {s.description && (
                                            <span className="ml-2 text-xs text-[#8d897d]">{s.description}</span>
                                        )}
                                    </div>
                                    <span
                                        className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'PASSED'
                                            ? 'bg-green-500/10 text-green-400'
                                            : s.status === 'FAILED'
                                                ? 'bg-red-500/10 text-red-400'
                                                : 'bg-white/8 text-[#8d897d]'
                                            }`}
                                    >
                                        {s.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
