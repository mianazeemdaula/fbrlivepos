'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

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

interface TokenFormState {
    sandboxToken: string
    productionToken: string
}

export default function SettingsPage() {
    const router = useRouter()
    const { update } = useSession()
    const [diConfig, setDiConfig] = useState<DIConfig | null>(null)
    const [tokenForm, setTokenForm] = useState<TokenFormState>({ sandboxToken: '', productionToken: '' })
    const [loading, setLoading] = useState(true)
    const [savingTokens, setSavingTokens] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [resettingCircuit, setResettingCircuit] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [preferredIdType, setPreferredIdType] = useState<'NTN' | 'CNIC'>('NTN')
    const [savingIdType, setSavingIdType] = useState(false)

    const isOnboardingComplete = diConfig?.sandboxCompleted === true
    const isLive = diConfig?.environment === 'PRODUCTION'

    async function loadConfig(options?: { showLoading?: boolean }) {
        if (options?.showLoading ?? true) setLoading(true)
        try {
            const res = await fetch('/api/tenant/fbr-credentials')
            if (res.ok) {
                const config: DIConfig = await res.json()
                setDiConfig(config)
            }
        } catch { /* ignore */ } finally {
            if (options?.showLoading ?? true) setLoading(false)
        }
    }

    useEffect(() => { void loadConfig({ showLoading: true }) }, [])

    useEffect(() => {
        fetch('/api/tenant/profile')
            .then((r) => r.ok ? r.json() : null)
            .then((data) => { if (data?.preferredIdType) setPreferredIdType(data.preferredIdType) })
            .catch(() => { })
    }, [])



    async function handleSaveTokens(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!tokenForm.sandboxToken && !tokenForm.productionToken) {
            setMessage({ type: 'error', text: 'Enter at least one token to save.' })
            return
        }
        setSavingTokens(true)
        setMessage(null)
        try {
            const res = await fetch('/api/tenant/fbr-credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sellerNTN: diConfig?.sellerNTN,
                    sellerCNIC: diConfig?.sellerCNIC ?? undefined,
                    sellerBusinessName: diConfig?.sellerBusinessName,
                    sellerProvince: diConfig?.sellerProvince,
                    sellerAddress: diConfig?.sellerAddress,
                    businessActivity: diConfig?.businessActivity,
                    sector: diConfig?.sector,
                    sandboxToken: tokenForm.sandboxToken || undefined,
                    productionToken: tokenForm.productionToken || undefined,
                    environment: diConfig?.environment ?? 'SANDBOX',
                }),
            })
            if (res.ok) {
                if (tokenForm.sandboxToken || tokenForm.productionToken) {
                    await update({ diConfigured: true })
                }
                setMessage({ type: 'success', text: 'Tokens saved successfully.' })
                setTokenForm({ sandboxToken: '', productionToken: '' })
                await loadConfig({ showLoading: false })
            } else {
                const data = await res.json()
                setMessage({ type: 'error', text: data.error || 'Failed to save tokens.' })
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error' })
        } finally {
            setSavingTokens(false)
        }
    }

    async function handleSaveIdType() {
        setSavingIdType(true)
        setMessage(null)
        try {
            const res = await fetch('/api/tenant/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preferredIdType }),
            })
            if (res.ok) {
                setMessage({ type: 'success', text: 'Invoice ID type preference saved.' })
            } else {
                setMessage({ type: 'error', text: 'Failed to save preference.' })
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error' })
        } finally {
            setSavingIdType(false)
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

    return (
        <div className="p-6 lg:p-8 ">
            {/* ── Page header ── */}
            <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <p className="text-xs font-medium uppercase tracking-caps text-muted">Compliance setup</p>
                    <h1 className="text-page-title font-normal text-ink">Settings</h1>
                </div>


            </div>

            {/* Global alert */}
            {message && (
                <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${message.type === 'success'
                    ? 'border-success-border bg-success-bg text-success'
                    : 'border-error-border bg-error-bg text-error'}`}
                >
                    {message.text}
                </div>
            )}

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map((n) => (
                        <div key={n} className="h-24 animate-pulse rounded-2xl bg-border" />
                    ))}
                </div>
            ) : !diConfig?.configured ? (
                <div className="rounded-2xl border border-warning-bg bg-warning-bg p-6 text-sm text-warning">
                    PRAL DI credentials are not configured yet.{' '}
                    <a href="/onboarding" className="font-medium underline">Complete onboarding</a> to set up your credentials.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
                    {/* ── Business Information (read-only tile) ── */}
                    <section className="rounded-2xl border border-border bg-white p-5">
                        <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
                            <h2 className="text-ui-sm font-semibold text-ink">Business Information</h2>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-muted bg-surface-subtle px-2.5 py-1 text-xs text-muted">
                                <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Locked after onboarding
                            </span>
                        </div>
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                            <InfoField label="Business Name" value={diConfig.sellerBusinessName} />
                            <InfoField label="Seller NTN" value={diConfig.sellerNTN} />
                            {diConfig.sellerCNIC && <InfoField label="CNIC" value={diConfig.sellerCNIC} />}
                            <InfoField label="Province" value={diConfig.sellerProvince} />
                            <InfoField label="Business Activity" value={diConfig.businessActivity} />
                            <InfoField label="Sector" value={diConfig.sector} />
                            <div className="sm:col-span-2">
                                <InfoField label="Business Address" value={diConfig.sellerAddress} />
                            </div>
                        </dl>
                        {diConfig.irisRegistrationStatus && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                <StatusPill label="IRIS" value={diConfig.irisRegistrationStatus} />
                                {isOnboardingComplete && (
                                    <StatusPill label="Sandbox" value="Completed" variant="success" />
                                )}
                                {diConfig.isProductionReady && (
                                    <StatusPill label="Production" value="Ready" variant="success" />
                                )}
                            </div>
                        )}
                    </section>

                    {/* ── Right column: tokens + preferences stacked ── */}
                    <div className="flex flex-col gap-5">
                        {/* ── Security Tokens ── */}
                        <section className="rounded-2xl border border-border bg-white p-5">
                            <h2 className="mb-1 text-ui-sm font-semibold text-ink">Security Tokens</h2>
                            <p className="mb-4 text-xs text-muted">
                                Tokens are encrypted at rest with AES-256-GCM. Leave a field blank to keep the existing token.
                            </p>
                            <form onSubmit={handleSaveTokens} className="space-y-3">
                                <div>
                                    <label className="mb-1 flex items-center gap-2 text-xs font-medium text-muted">
                                        Sandbox Token (from IRIS)
                                        {diConfig.hasSandboxToken && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-xs text-success">
                                                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Stored
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type="password"
                                        value={tokenForm.sandboxToken}
                                        onChange={(e) => setTokenForm((f) => ({ ...f, sandboxToken: e.target.value }))}
                                        className="w-full rounded-input border border-border bg-surface-subtle px-3 py-2 text-sm font-mono text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                        placeholder={diConfig.hasSandboxToken ? 'Enter new token to replace existing…' : 'Paste your sandbox IRIS security token'}
                                        autoComplete="new-password"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 flex items-center gap-2 text-xs font-medium text-muted">
                                        Production Token (from IRIS)
                                        {diConfig.hasProductionToken && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-xs text-success">
                                                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Stored
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type="password"
                                        value={tokenForm.productionToken}
                                        onChange={(e) => setTokenForm((f) => ({ ...f, productionToken: e.target.value }))}
                                        className="w-full rounded-input border border-border bg-surface-subtle px-3 py-2 text-sm font-mono text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                        placeholder={diConfig.hasProductionToken ? 'Enter new token to replace existing…' : 'Paste your production IRIS security token'}
                                        autoComplete="new-password"
                                    />
                                </div>
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <button
                                        type="submit"
                                        disabled={savingTokens}
                                        className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
                                    >
                                        {savingTokens ? 'Saving…' : 'Save Tokens'}
                                    </button>
                                    {diConfig.configured && (
                                        <button
                                            type="button"
                                            onClick={handleVerify}
                                            disabled={verifying}
                                            className="rounded-full border border-border bg-white px-4 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface disabled:opacity-60"
                                        >
                                            {verifying ? 'Verifying…' : 'Verify Active Token'}
                                        </button>
                                    )}
                                    {diConfig.configured && (
                                        <button
                                            type="button"
                                            onClick={handleResetCircuit}
                                            disabled={resettingCircuit}
                                            className="rounded-full border border-warning-bg bg-warning-bg px-4 py-2 text-xs font-medium text-warning transition-colors hover:opacity-80 disabled:opacity-60"
                                            title="Reset DI circuit breaker if submissions are stuck with DI_CIRCUIT_OPEN"
                                        >
                                            {resettingCircuit ? 'Resetting…' : 'Reset DI Circuit'}
                                        </button>
                                    )}
                                </div>
                            </form>
                        </section>

                        {/* ── Invoice Preferences ── */}
                        <section className="rounded-2xl border border-border bg-white p-5">
                            <h2 className="mb-1 text-ui-sm font-semibold text-ink">Invoice Preferences</h2>
                            <p className="mb-4 text-xs text-muted">Default buyer identifier shown on new invoices at POS.</p>
                            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3">
                                <span className={`min-w-12 text-xs font-semibold ${preferredIdType === 'NTN' ? 'text-ink' : 'text-muted'}`}>NTN</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={preferredIdType === 'CNIC'}
                                    onClick={() => setPreferredIdType(preferredIdType === 'NTN' ? 'CNIC' : 'NTN')}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${preferredIdType === 'CNIC' ? 'bg-primary' : 'bg-border-strong'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${preferredIdType === 'CNIC' ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                                <span className={`min-w-12 text-xs font-semibold ${preferredIdType === 'CNIC' ? 'text-ink' : 'text-muted'}`}>CNIC</span>
                                <span className="ml-1 text-xs text-muted">Default buyer ID type for new invoices</span>
                            </div>
                            <div className="mt-3 flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleSaveIdType}
                                    disabled={savingIdType}
                                    className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
                                >
                                    {savingIdType ? 'Saving…' : 'Save Preference'}
                                </button>
                            </div>
                        </section>

                    </div>
                </div>
            )}
        </div>
    )
}

function InfoField({ label, value }: { label: string; value?: string | null }) {
    return (
        <div>
            <dt className="mb-0.5 text-xs text-muted">{label}</dt>
            <dd className="text-sm font-medium text-ink">{value || <span className="text-subtle">—</span>}</dd>
        </div>
    )
}

function StatusPill({
    label,
    value,
    variant = 'neutral',
}: {
    label: string
    value: string
    variant?: 'success' | 'neutral'
}) {
    const base =
        variant === 'success'
            ? 'bg-success-bg text-success border-success-border'
            : 'bg-surface-subtle text-muted border-border'
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${base}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {label}: {value}
        </span>
    )
}