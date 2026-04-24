'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { isValidSellerNtn, normalizeNtnCnic } from '@/lib/validation/pakistan'
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
    sandboxCompleted?: boolean
    sandboxCompletedAt?: string | null
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
    const [resettingCircuit, setResettingCircuit] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [preferredIdType, setPreferredIdType] = useState<'NTN' | 'CNIC'>('NTN')
    const [activeTab, setActiveTab] = useState<'business' | 'sandbox'>('business')

    const normalizedSellerCnic = normalizeNtnCnic(form.sellerCNIC)
    const isBusinessSetupLocked = diConfig?.sandboxCompleted === true

    async function loadConfig(options?: { showLoading?: boolean }) {
        if (options?.showLoading ?? true) {
            setLoading(true)
        }

        try {
            const res = await fetch('/api/tenant/fbr-credentials')
            if (res.ok) {
                const config: DIConfig = await res.json()
                setDiConfig(config)
                setForm(createFormStateFromConfig(config))
            }
        } catch {
            // Ignore
        } finally {
            if (options?.showLoading ?? true) {
                setLoading(false)
            }
        }
    }

    useEffect(() => {
        void loadConfig({ showLoading: true })
    }, [])

    useEffect(() => {
        fetch('/api/tenant/profile')
            .then((r) => r.ok ? r.json() : null)
            .then((data) => { if (data?.preferredIdType) setPreferredIdType(data.preferredIdType) })
            .catch(() => { })
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
                let successMessage = 'PRAL DI credentials saved successfully!'
                if (data.sandboxToken || data.productionToken) {
                    await update({ diConfigured: true })
                }

                const prefRes = await fetch('/api/tenant/profile', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ preferredIdType }),
                })

                if (!prefRes.ok) {
                    successMessage += ' Invoice ID type preference could not be updated.'
                }

                setMessage({ type: 'success', text: successMessage })
                await loadConfig({ showLoading: false })
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

    async function handleResetCircuit() {
        setResettingCircuit(true)
        setMessage(null)
        try {
            const res = await fetch('/api/tenant/fbr/reset-circuit', { method: 'POST' })
            const data = await res.json()
            if (res.ok) {
                setMessage({ type: 'success', text: 'DI circuit breaker reset. You can now retry submissions.' })
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to reset circuit.' })
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error' })
        } finally {
            setResettingCircuit(false)
        }
    }

    function updateFormField<K extends keyof DIFormState>(field: K, value: DIFormState[K]) {
        setForm((current) => ({ ...current, [field]: value }))
    }

    return (
        <div className="p-6 lg:p-8">
            <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Compliance setup</p>
            <h1 className="brand-heading mb-6 mt-2 text-3xl font-bold text-white">Settings</h1>

            {/* <div className="mb-6 grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-white/4 p-2 sm:grid-cols-2">
                <button
                    type="button"
                    onClick={() => setActiveTab('business')}
                    className={`rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${activeTab === 'business'
                        ? 'bg-accent text-primary'
                        : 'bg-white/6 text-[#c1bcaf] hover:bg-white/10'
                        }`}
                >
                    1. PRAL Business Setup
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('sandbox')}
                    className={`rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${activeTab === 'sandbox'
                        ? 'bg-accent text-primary'
                        : 'bg-white/6 text-[#c1bcaf] hover:bg-white/10'
                        }`}
                >
                    2. Sandbox Test Scenarios
                </button>
            </div> */}

            {activeTab === 'business' && (
                <>

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
                                        {isBusinessSetupLocked && (
                                            <p className="mt-2 text-xs text-amber-300">
                                                Business setup is locked because sandbox scenarios are completed. You can still update sandbox/production tokens and environment.
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
                                                disabled={isBusinessSetupLocked}
                                                className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
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
                                                disabled={isBusinessSetupLocked}
                                                className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
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
                                            disabled={isBusinessSetupLocked}
                                            className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
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
                                                disabled={isBusinessSetupLocked}
                                                className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
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
                                                disabled={isBusinessSetupLocked}
                                                className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
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
                                            disabled={isBusinessSetupLocked}
                                            className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
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
                                            disabled={isBusinessSetupLocked}
                                            className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                                            placeholder="e.g. Tier-1 Retailer"
                                        />
                                    </div>

                                    <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/4 px-3 py-3">
                                        <input
                                            type="checkbox"
                                            checked={preferredIdType === 'CNIC'}
                                            onChange={(e) => setPreferredIdType(e.target.checked ? 'CNIC' : 'NTN')}
                                            disabled={isBusinessSetupLocked}
                                            className="mt-0.5 h-4 w-4 rounded border-white/30 bg-white/8 text-accent focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
                                        />
                                        <div>
                                            <p className="text-sm font-medium text-white">Default Invoice ID Type</p>
                                            <p className="mt-0.5 text-xs text-[#c1bcaf]">
                                                Check to use CNIC by default on invoices. Uncheck to use NTN by default.
                                            </p>
                                        </div>
                                    </label>

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

                                    <div className="flex gap-3 flex-wrap">
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
                                        {diConfig?.configured && (
                                            <button
                                                type="button"
                                                onClick={handleResetCircuit}
                                                disabled={resettingCircuit}
                                                className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/20"
                                                title="Reset DI circuit if submissions are blocked with DI_CIRCUIT_OPEN"
                                            >
                                                {resettingCircuit ? 'Resetting...' : 'Reset DI Circuit'}
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'sandbox' && (
                <div className="app-panel rounded-2xl p-4 sm:p-6">
                    {loading ? (
                        <p className="text-sm text-[#c1bcaf]">Loading sandbox configuration...</p>
                    ) : !diConfig?.configured ? (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300">
                            Configure PRAL DI credentials first in the PRAL Business Setup tab.
                        </div>
                    ) : diConfig.environment !== 'SANDBOX' ? (
                        <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4 text-sm text-sky-300">
                            Switch environment to Sandbox in PRAL Business Setup before running test scenarios.
                        </div>
                    ) : (
                        <SandboxScenariosModal
                            embedded
                            diConfig={{
                                businessActivity: diConfig.businessActivity,
                                sector: diConfig.sector,
                                sellerProvince: diConfig.sellerProvince,
                                sandboxScenarios: diConfig.sandboxScenarios,
                            }}
                            onScenariosUpdated={() => void loadConfig({ showLoading: false })}
                        />
                    )}
                </div>
            )}
        </div>
    )
}
