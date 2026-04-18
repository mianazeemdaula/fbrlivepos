'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { SandboxScenariosModal } from './SandboxScenariosModal'

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
    const [showScenariosModal, setShowScenariosModal] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [step, setStep] = useState(1) // Wizard step: 1=Business Info, 2=Token, 3=Verify, 4=Sandbox, 5=Production

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

        const data = {
            sellerNTN: form.sellerNTN,
            sellerCNIC: form.sellerCNIC || undefined,
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

    return (
        <div className="p-6 max-w-2xl">
            <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

            {/* Integration Progress Steps */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
                <h2 className="text-sm font-semibold text-slate-400 mb-3">PRAL DI Integration Progress</h2>
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
                                    ? 'bg-blue-600 text-white'
                                    : step > s.n || (s.n === 1 && diConfig?.configured)
                                        ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                        : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                                    }`}
                            >
                                {step > s.n || (s.n === 1 && diConfig?.configured && step !== s.n) ? '✓ ' : `${s.n}. `}
                                {s.label}
                            </button>
                            {i < 4 && <div className="w-2 h-px bg-slate-700 mx-0.5" />}
                        </div>
                    ))}
                </div>
            </div>

            {/* PRAL DI Credentials */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
                <h2 className="text-lg font-semibold text-white mb-4">PRAL Digital Invoicing</h2>
                <p className="text-sm text-slate-400 mb-4">
                    Configure your PRAL DI credentials obtained from IRIS registration.
                    Tokens are encrypted at rest with AES-256-GCM.
                </p>

                {loading ? (
                    <div className="animate-pulse space-y-3">
                        <div className="h-10 bg-slate-800 rounded" />
                        <div className="h-10 bg-slate-800 rounded" />
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
                                    <label className="block text-xs text-slate-400 mb-1">Seller NTN (7 digits)</label>
                                    <input
                                        name="sellerNTN"
                                        required
                                        pattern="\d{7}"
                                        maxLength={7}
                                        value={form.sellerNTN}
                                        onChange={(e) => updateFormField('sellerNTN', e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        placeholder="1234567"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">CNIC (optional, 13 digits)</label>
                                    <input
                                        name="sellerCNIC"
                                        pattern="\d{13}"
                                        maxLength={13}
                                        value={form.sellerCNIC}
                                        onChange={(e) => updateFormField('sellerCNIC', e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        placeholder="3520112345678"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Business Name</label>
                                <input
                                    name="sellerBusinessName"
                                    required
                                    value={form.sellerBusinessName}
                                    onChange={(e) => updateFormField('sellerBusinessName', e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                    placeholder="Your registered business name"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Province</label>
                                    <select
                                        name="sellerProvince"
                                        required
                                        value={form.sellerProvince}
                                        onChange={(e) => updateFormField('sellerProvince', e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
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
                                    <label className="block text-xs text-slate-400 mb-1">Business Activity</label>
                                    <input
                                        name="businessActivity"
                                        required
                                        value={form.businessActivity}
                                        onChange={(e) => updateFormField('businessActivity', e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        placeholder="e.g. Retail, Manufacturing"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Business Address</label>
                                <input
                                    name="sellerAddress"
                                    required
                                    value={form.sellerAddress}
                                    onChange={(e) => updateFormField('sellerAddress', e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                    placeholder="Full business address"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Sector</label>
                                <input
                                    name="sector"
                                    required
                                    value={form.sector}
                                    onChange={(e) => updateFormField('sector', e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                    placeholder="e.g. Tier-1 Retailer"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Sandbox Security Token (from IRIS)</label>
                                <input
                                    name="sandboxToken"
                                    type="password"
                                    value={form.sandboxToken}
                                    onChange={(e) => updateFormField('sandboxToken', e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                                    placeholder={diConfig?.hasSandboxToken ? 'A sandbox token is already stored. Enter a new token to replace it.' : 'Paste your sandbox IRIS security token'}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Production Security Token (from IRIS)</label>
                                <input
                                    name="productionToken"
                                    type="password"
                                    value={form.productionToken}
                                    onChange={(e) => updateFormField('productionToken', e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                                    placeholder={diConfig?.hasProductionToken ? 'A production token is already stored. Enter a new token to replace it.' : 'Paste your production IRIS security token'}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Environment</label>
                                <select
                                    name="environment"
                                    value={form.environment}
                                    onChange={(e) => updateFormField('environment', e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
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
                                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
                                >
                                    {saving ? 'Saving...' : 'Save Credentials'}
                                </button>
                                {diConfig?.configured && (
                                    <button
                                        type="button"
                                        onClick={handleVerify}
                                        disabled={verifying}
                                        className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
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
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-white">Sandbox Test Scenarios</h2>
                            <p className="text-sm text-slate-400 mt-0.5">
                                Complete all mandatory scenarios to unlock your Production Token.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowScenariosModal(true)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
                        >
                            &#9654; Run Scenarios
                        </button>
                    </div>
                    {diConfig.sandboxScenarios && diConfig.sandboxScenarios.length > 0 && (
                        <div className="space-y-2">
                            {diConfig.sandboxScenarios.map((s) => (
                                <div
                                    key={s.scenarioId}
                                    className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-2"
                                >
                                    <div>
                                        <span className="text-sm text-white font-mono">{s.scenarioId}</span>
                                        {s.description && (
                                            <span className="text-xs text-slate-400 ml-2">{s.description}</span>
                                        )}
                                    </div>
                                    <span
                                        className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'PASSED'
                                                ? 'bg-green-500/10 text-green-400'
                                                : s.status === 'FAILED'
                                                    ? 'bg-red-500/10 text-red-400'
                                                    : 'bg-slate-700 text-slate-400'
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

            <SandboxScenariosModal
                open={showScenariosModal}
                onClose={() => setShowScenariosModal(false)}
                diConfig={{
                    businessActivity: diConfig?.businessActivity,
                    sector: diConfig?.sector,
                    sellerProvince: diConfig?.sellerProvince,
                    sandboxScenarios: diConfig?.sandboxScenarios,
                }}
                onScenariosUpdated={async () => {
                    const res = await fetch('/api/tenant/fbr-credentials')
                    if (res.ok) {
                        const config: DIConfig = await res.json()
                        setDiConfig(config)
                    }
                }}
            />
        </div>
    )
}
