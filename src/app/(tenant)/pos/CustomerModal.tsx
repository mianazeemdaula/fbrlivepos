'use client'

import { useState } from 'react'
import { isValidMobile, isValidNtnCnic, normalizeMobile, normalizeNtnCnic } from '@/lib/validation/pakistan'

interface CustomerResult {
    id: string
    name: string
    ntnCnic: string | null
    email?: string | null
    phone: string | null
    province: string | null
    address: string | null
    registrationType: string | null
    fbrVerified: boolean
}

interface NewCustomerForm {
    name: string
    ntnCnic: string
    phone: string
    province: string
    registrationType: string
    address: string
}

interface Props {
    /** The currently selected customer chip data (if any) */
    selectedCustomer: {
        id: string
        name: string
        ntnCnic: string | null
        registrationType: string | null
    } | null
    onSelectCustomer: (c: CustomerResult) => void
    onClearCustomer: () => void
    /** Called after a new customer is saved */
    onSaveNewCustomer: (form: NewCustomerForm) => Promise<{ error?: string } | void>
    onClose: () => void
}

const PROVINCES = [
    { value: 'Punjab', label: 'Punjab' },
    { value: 'Sindh', label: 'Sindh' },
    { value: 'Khyber Pakhtunkhwa', label: 'KPK' },
    { value: 'Balochistan', label: 'Balochistan' },
    { value: 'Islamabad', label: 'Islamabad' },
]

export default function CustomerModal({
    selectedCustomer,
    onSelectCustomer,
    onClearCustomer,
    onSaveNewCustomer,
    onClose,
}: Props) {
    const [tab, setTab] = useState<'search' | 'new'>(selectedCustomer ? 'search' : 'search')
    const [search, setSearch] = useState('')
    const [results, setResults] = useState<CustomerResult[]>([])
    const [searching, setSearching] = useState(false)
    const [saving, setSaving] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [verifyResult, setVerifyResult] = useState<{
        success: boolean
        registrationType?: string
        atlStatus?: string
        registrationNo?: string
        error?: string
    } | null>(null)
    const [error, setError] = useState<string | null>(null)

    const [form, setForm] = useState<NewCustomerForm>({
        name: '',
        ntnCnic: '',
        phone: '',
        province: '',
        registrationType: '',
        address: '',
    })

    async function handleSearch(q: string) {
        setSearch(q)
        if (q.length < 2) { setResults([]); return }
        setSearching(true)
        try {
            const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}&limit=10`)
            if (res.ok) {
                const data = await res.json()
                setResults(data.data || [])
            }
        } catch { /* ignore */ } finally {
            setSearching(false)
        }
    }

    function setField<K extends keyof NewCustomerForm>(key: K, value: NewCustomerForm[K]) {
        setForm((f) => ({ ...f, [key]: value }))
    }

    async function handleVerify() {
        const ntn = normalizeNtnCnic(form.ntnCnic)
        if (!ntn || !isValidNtnCnic(ntn)) {
            setError('Enter a valid 7-digit NTN or 13-digit CNIC to verify.')
            return
        }
        setVerifying(true)
        setVerifyResult(null)
        setError(null)
        try {
            const res = await fetch('/api/customers/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ntnCnic: ntn }),
            })
            const data = await res.json()
            if (res.ok) {
                setVerifyResult({
                    success: data.verified,
                    registrationType: data.registrationType,
                    atlStatus: data.atlStatus,
                    registrationNo: data.registrationNo,
                })
                if (data.registrationType && data.registrationType !== 'unknown') {
                    setField('registrationType', data.registrationType)
                }
            } else {
                setVerifyResult({ success: false, error: data.error || 'Verification failed' })
            }
        } catch {
            setVerifyResult({ success: false, error: 'Network error' })
        } finally {
            setVerifying(false)
        }
    }

    async function handleSave() {
        if (!form.name.trim()) { setError('Name is required.'); return }
        const ntn = normalizeNtnCnic(form.ntnCnic)
        const phone = normalizeMobile(form.phone)
        if (ntn && !isValidNtnCnic(ntn)) { setError('NTN must be 7 digits, CNIC must be 13 digits.'); return }
        if (phone && !isValidMobile(phone)) { setError('Phone must be a valid Pakistani mobile number.'); return }
        setSaving(true)
        setError(null)
        const result = await onSaveNewCustomer({ ...form, ntnCnic: ntn || '', phone: phone || '' })
        setSaving(false)
        if (result && result.error) {
            setError(result.error)
        } else {
            onClose()
        }
    }

    const inputCls = 'h-8 w-full min-w-0 rounded-lg border border-border bg-white px-2 text-xs text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30'

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="customer-modal-title"
                className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-white shadow-modal sm:rounded-2xl"
            >
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                    <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Customer</p>
                        <h2 id="customer-modal-title" className="text-sm font-semibold text-ink">Add / Search Customer</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-sm text-muted hover:bg-surface hover:text-ink"
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex shrink-0 gap-1 border-b border-border bg-surface-subtle p-1">
                    {(['search', 'new'] as const).map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => { setTab(t); setError(null) }}
                            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${tab === t
                                ? 'bg-white text-ink shadow-sm'
                                : 'text-muted hover:text-ink'
                                }`}
                        >
                            {t === 'search' ? 'Search Existing' : 'New Customer'}
                        </button>
                    ))}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                    {/* ── Currently selected ── */}
                    {selectedCustomer && (
                        <div className="mb-3 flex items-center gap-2.5 rounded-lg border border-success-border bg-success-bg px-2.5 py-2">
                            <span className="text-xs text-success">✓</span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-ink">{selectedCustomer.name}</p>
                                {selectedCustomer.ntnCnic && (
                                    <p className="font-mono text-[11px] text-muted">{selectedCustomer.ntnCnic}</p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => { onClearCustomer(); onClose() }}
                                className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-error hover:bg-error-bg"
                            >
                                Remove
                            </button>
                        </div>
                    )}

                    {tab === 'search' && (
                        <div className="space-y-2">
                            <input
                                type="search"
                                placeholder="Search by name, NTN or CNIC…"
                                value={search}
                                onChange={(e) => handleSearch(e.target.value)}
                                autoFocus
                                className={inputCls}
                            />
                            {searching && (
                                <p className="text-center text-[11px] text-muted">Searching…</p>
                            )}
                            {results.length > 0 && (
                                <div className="divide-y divide-border-muted overflow-hidden rounded-lg border border-border">
                                    {results.map((c) => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => { onSelectCustomer(c); onClose() }}
                                            className="block w-full px-2.5 py-2 text-left transition-colors hover:bg-surface-subtle"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="truncate text-xs font-medium text-ink">{c.name}</span>
                                                {c.registrationType && (
                                                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${c.fbrVerified
                                                        ? 'bg-success-bg text-success'
                                                        : 'bg-surface text-muted'
                                                        }`}>
                                                        {c.fbrVerified ? '✓ ' : ''}{c.registrationType}
                                                    </span>
                                                )}
                                            </div>
                                            {(c.ntnCnic || c.phone) && (
                                                <div className="mt-0.5 flex gap-2 text-[11px] text-muted">
                                                    {c.ntnCnic && <span className="font-mono">{c.ntnCnic}</span>}
                                                    {c.phone && <span>{c.phone}</span>}
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {!searching && search.length >= 2 && results.length === 0 && (
                                <div className="rounded-lg border border-dashed border-border-strong p-3 text-center">
                                    <p className="mb-1 text-xs text-muted">No customers found.</p>
                                    <button
                                        type="button"
                                        onClick={() => setTab('new')}
                                        className="text-xs font-medium text-primary hover:underline"
                                    >
                                        + Add new customer
                                    </button>
                                </div>
                            )}
                            {search.length < 2 && !selectedCustomer && (
                                <p className="text-center text-[11px] text-muted">Type at least 2 characters to search.</p>
                            )}
                        </div>
                    )}

                    {tab === 'new' && (
                        <div className="grid grid-cols-2 gap-2">
                            <Field label="Full Name" required className="col-span-2">
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setField('name', e.target.value)}
                                    autoFocus
                                    className={inputCls}
                                />
                            </Field>

                            {/* NTN/CNIC + verify */}
                            <Field label="NTN (7 digits) or CNIC (13 digits)" className="col-span-2">
                                <div className="flex gap-1.5">
                                    <input
                                        type="text"
                                        value={form.ntnCnic}
                                        onChange={(e) => {
                                            setField('ntnCnic', normalizeNtnCnic(e.target.value))
                                            setVerifyResult(null)
                                        }}
                                        inputMode="numeric"
                                        maxLength={13}
                                        className={`${inputCls} flex-1 font-mono`}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleVerify}
                                        disabled={verifying || !form.ntnCnic}
                                        className="h-8 shrink-0 rounded-lg border border-border bg-surface-subtle px-2.5 text-[11px] font-medium text-ink hover:bg-surface disabled:opacity-40"
                                    >
                                        {verifying ? 'Verifying…' : 'Verify FBR'}
                                    </button>
                                </div>
                            </Field>

                            {verifyResult && (
                                <div className={`col-span-2 space-y-0.5 rounded-lg border px-2.5 py-1.5 text-[11px] ${verifyResult.success
                                    ? 'border-success-border bg-success-bg text-success'
                                    : 'border-error-border bg-error-bg text-error'
                                    }`}>
                                    {verifyResult.success ? (
                                        <>
                                            <p>✓ Verified — {verifyResult.registrationType}</p>
                                            {verifyResult.atlStatus && <p>ATL: {verifyResult.atlStatus}</p>}
                                            {verifyResult.registrationNo && <p>Reg No: {verifyResult.registrationNo}</p>}
                                        </>
                                    ) : (
                                        <p>✗ {verifyResult.error || 'Not found in FBR'}</p>
                                    )}
                                </div>
                            )}

                            <Field label="Phone" className="col-span-2 min-[400px]:col-span-1">
                                <input
                                    type="text"
                                    placeholder="03XXXXXXXXX"
                                    value={form.phone}
                                    onChange={(e) => setField('phone', normalizeMobile(e.target.value))}
                                    inputMode="numeric"
                                    maxLength={11}
                                    className={inputCls}
                                />
                            </Field>
                            <Field label="Registration Type" className="col-span-2 min-[400px]:col-span-1">
                                <select
                                    value={form.registrationType}
                                    onChange={(e) => setField('registrationType', e.target.value)}
                                    className={inputCls}
                                >
                                    <option value="">Select</option>
                                    <option value="Registered">Registered</option>
                                    <option value="Unregistered">Unregistered</option>
                                </select>
                            </Field>

                            <Field label="Province" className="col-span-2">
                                <select
                                    value={form.province}
                                    onChange={(e) => setField('province', e.target.value)}
                                    className={inputCls}
                                >
                                    <option value="">Select province</option>
                                    {PROVINCES.map((p) => (
                                        <option key={p.value} value={p.value}>{p.label}</option>
                                    ))}
                                </select>
                            </Field>

                            <Field label="Address" className="col-span-2">
                                <input
                                    type="text"
                                    value={form.address}
                                    onChange={(e) => setField('address', e.target.value)}
                                    className={inputCls}
                                />
                            </Field>

                            {error && (
                                <p className="col-span-2 rounded-lg border border-error-border bg-error-bg px-2.5 py-1.5 text-[11px] text-error">
                                    {error}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer actions for the new-customer form, always visible */}
                {tab === 'new' && (
                    <div className="flex shrink-0 justify-end gap-2 border-t border-border px-3 py-2.5 sm:px-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                        >
                            {saving ? 'Saving…' : 'Save & Select'}
                        </button>
                    </div>
                )}
            </div>
        </div>
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
