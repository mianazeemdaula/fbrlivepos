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

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className="app-panel flex w-full max-w-md flex-col overflow-hidden rounded-2xl shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Customer</p>
                        <h2 className="mt-0.5 text-base font-bold text-white">Add / Search Customer</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-[#8d897d] hover:bg-white/14 hover:text-white"
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10">
                    {(['search', 'new'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => { setTab(t); setError(null) }}
                            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === t
                                ? 'border-b-2 border-accent text-accent'
                                : 'text-[#8d897d] hover:text-white'
                                }`}
                        >
                            {t === 'search' ? 'Search Existing' : 'New Customer'}
                        </button>
                    ))}
                </div>

                <div className="max-h-[70vh] overflow-auto p-5">
                    {/* ── Currently selected ── */}
                    {selectedCustomer && (
                        <div className="mb-4 flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/8 px-3 py-2.5">
                            <span className="text-green-400">✓</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{selectedCustomer.name}</p>
                                {selectedCustomer.ntnCnic && (
                                    <p className="font-mono text-xs text-[#8d897d]">{selectedCustomer.ntnCnic}</p>
                                )}
                            </div>
                            <button
                                onClick={() => { onClearCustomer(); onClose() }}
                                className="shrink-0 text-xs text-red-300 hover:text-red-200"
                            >
                                Remove
                            </button>
                        </div>
                    )}

                    {tab === 'search' && (
                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Search by name, NTN or CNIC…"
                                value={search}
                                onChange={(e) => handleSearch(e.target.value)}
                                autoFocus
                                className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white placeholder:text-[#8d897d]"
                            />
                            {searching && (
                                <p className="text-center text-xs text-[#8d897d]">Searching…</p>
                            )}
                            {results.length > 0 && (
                                <div className="space-y-1">
                                    {results.map((c) => (
                                        <button
                                            key={c.id}
                                            onClick={() => { onSelectCustomer(c); onClose() }}
                                            className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2.5 text-left hover:border-white/20 hover:bg-white/10"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-medium text-white">{c.name}</span>
                                                {c.registrationType && (
                                                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${c.fbrVerified
                                                        ? 'bg-green-500/10 text-green-400'
                                                        : 'bg-white/8 text-[#8d897d]'
                                                        }`}>
                                                        {c.fbrVerified ? '✓ ' : ''}{c.registrationType}
                                                    </span>
                                                )}
                                            </div>
                                            {c.ntnCnic && (
                                                <span className="font-mono text-xs text-[#8d897d]">{c.ntnCnic}</span>
                                            )}
                                            {c.phone && (
                                                <span className="ml-2 text-xs text-[#8d897d]">{c.phone}</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {!searching && search.length >= 2 && results.length === 0 && (
                                <div className="rounded-xl border border-white/10 bg-white/4 p-4 text-center">
                                    <p className="mb-2 text-sm text-[#8d897d]">No customers found.</p>
                                    <button
                                        onClick={() => setTab('new')}
                                        className="text-sm text-[#f0d9a0] hover:underline"
                                    >
                                        + Add new customer
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'new' && (
                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Full Name *"
                                value={form.name}
                                onChange={(e) => setField('name', e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white placeholder:text-[#8d897d]"
                            />

                            {/* NTN/CNIC + verify */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="NTN (7 digits) or CNIC (13 digits)"
                                    value={form.ntnCnic}
                                    onChange={(e) => {
                                        setField('ntnCnic', normalizeNtnCnic(e.target.value))
                                        setVerifyResult(null)
                                    }}
                                    inputMode="numeric"
                                    maxLength={13}
                                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white placeholder:text-[#8d897d]"
                                />
                                <button
                                    type="button"
                                    onClick={handleVerify}
                                    disabled={verifying || !form.ntnCnic}
                                    className="shrink-0 rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-xs font-medium text-[#d8d0bf] hover:bg-white/12 disabled:opacity-40"
                                >
                                    {verifying ? '…' : 'Verify FBR'}
                                </button>
                            </div>

                            {verifyResult && (
                                <div className={`rounded-lg border p-2.5 text-xs space-y-0.5 ${verifyResult.success
                                    ? 'border-green-500/30 bg-green-500/8 text-green-300'
                                    : 'border-red-500/30 bg-red-500/10 text-red-300'
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

                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    placeholder="Phone"
                                    value={form.phone}
                                    onChange={(e) => setField('phone', normalizeMobile(e.target.value))}
                                    inputMode="numeric"
                                    maxLength={11}
                                    className="min-w-0 rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white placeholder:text-[#8d897d]"
                                />
                                <select
                                    value={form.registrationType}
                                    onChange={(e) => setField('registrationType', e.target.value)}
                                    className="min-w-0 rounded-xl border border-white/10 bg-[#0e1d17] px-3 py-2 text-sm text-white"
                                >
                                    <option value="">Reg. Type</option>
                                    <option value="Registered">Registered</option>
                                    <option value="Unregistered">Unregistered</option>
                                </select>
                            </div>

                            <select
                                value={form.province}
                                onChange={(e) => setField('province', e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-[#0e1d17] px-3 py-2 text-sm text-white"
                            >
                                <option value="">Province</option>
                                {PROVINCES.map((p) => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>

                            <input
                                type="text"
                                placeholder="Address"
                                value={form.address}
                                onChange={(e) => setField('address', e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white placeholder:text-[#8d897d]"
                            />

                            {error && (
                                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                                    {error}
                                </p>
                            )}

                            <div className="flex gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 rounded-full bg-accent py-2.5 text-sm font-medium text-primary hover:bg-(--accent-soft) disabled:opacity-50"
                                >
                                    {saving ? 'Saving…' : 'Save & Select'}
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-[#8d897d] hover:bg-white/6"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
