'use client'

import { useEffect, useState, useCallback } from 'react'
import { isValidMobile, isValidNtnCnic, normalizeMobile, normalizeNtnCnic } from '@/lib/validation/pakistan'

interface Customer {
    id: string
    name: string
    ntnCnic: string | null
    phone: string | null
    email: string | null
    province: string | null
    address: string | null
    registrationType: string | null
    atlStatus: string | null
    fbrVerified: boolean
    fbrVerifiedAt: string | null
    isActive: boolean
    createdAt: string
}

interface VerifyResult {
    registrationType: string
    atlStatus: string
    verified: boolean
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [pages, setPages] = useState(1)
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)

    // Add customer form
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ name: '', ntnCnic: '', phone: '', email: '', province: '', address: '' })
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Verification state
    const [verifying, setVerifying] = useState<string | null>(null)
    const [verifyNtn, setVerifyNtn] = useState('')
    const [showVerifyModal, setShowVerifyModal] = useState(false)
    const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)

    const normalizedFormNtnCnic = normalizeNtnCnic(form.ntnCnic)
    const normalizedFormPhone = normalizeMobile(form.phone)

    const fetchCustomers = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ page: String(page), limit: '25' })
            if (search) params.set('q', search)
            const res = await fetch(`/api/customers?${params}`)
            if (res.ok) {
                const data = await res.json()
                setCustomers(data.data)
                setTotal(data.total)
                setPages(data.pages)
            }
        } catch { /* ignore */ } finally {
            setLoading(false)
        }
    }, [page, search])

    useEffect(() => { fetchCustomers() }, [fetchCustomers])

    useEffect(() => {
        const timer = setTimeout(() => { setPage(1); fetchCustomers() }, 300)
        return () => clearTimeout(timer)
    }, [search, fetchCustomers])

    async function handleAddCustomer(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setMessage(null)

        if (normalizedFormNtnCnic && !isValidNtnCnic(normalizedFormNtnCnic)) {
            setMessage({ type: 'error', text: 'NTN/CNIC must be 7 digits for NTN or 13 digits for CNIC.' })
            setSaving(false)
            return
        }

        if (normalizedFormPhone && !isValidMobile(normalizedFormPhone)) {
            setMessage({ type: 'error', text: 'Mobile must be a valid Pakistani number like 03001234567.' })
            setSaving(false)
            return
        }

        try {
            const res = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name,
                    ntnCnic: normalizedFormNtnCnic || undefined,
                    phone: normalizedFormPhone || undefined,
                    email: form.email || undefined,
                    province: form.province || undefined,
                    address: form.address || undefined,
                }),
            })
            const data = await res.json()
            if (res.ok) {
                setMessage({ type: 'success', text: 'Customer added successfully' })
                setForm({ name: '', ntnCnic: '', phone: '', email: '', province: '', address: '' })
                setShowForm(false)
                fetchCustomers()
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to add customer' })
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error' })
        } finally {
            setSaving(false)
        }
    }

    async function handleVerifyBuyer(customerId: string, ntnCnic: string) {
        setVerifying(customerId)
        try {
            const res = await fetch('/api/customers/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ntnCnic, customerId }),
            })
            const data = await res.json()
            if (res.ok) {
                setVerifyResult(data)
                setShowVerifyModal(true)
                fetchCustomers()
            } else {
                setMessage({ type: 'error', text: data.error || 'Verification failed' })
            }
        } catch {
            setMessage({ type: 'error', text: 'Verification failed — network error' })
        } finally {
            setVerifying(null)
        }
    }

    async function handleQuickVerify() {
        const normalized = normalizeNtnCnic(verifyNtn)
        if (!normalized) return
        if (!isValidNtnCnic(normalized)) {
            setMessage({ type: 'error', text: 'Enter a valid 7-digit NTN or 13-digit CNIC.' })
            return
        }
        setVerifying('quick')
        setVerifyResult(null)
        try {
            const res = await fetch('/api/customers/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ntnCnic: normalized }),
            })
            const data = await res.json()
            if (res.ok) {
                setVerifyResult(data)
            } else {
                setMessage({ type: 'error', text: data.error || 'Verification failed' })
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error' })
        } finally {
            setVerifying(null)
        }
    }

    return (
        <div className="p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Buyer registry</p>
                    <h1 className="brand-heading mt-2 text-3xl font-bold text-white">Customers</h1>
                    <p className="mt-1 text-sm text-[#c1bcaf]">{total} total customers</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowVerifyModal(true)}
                        className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-medium text-[#d8d0bf] transition-colors hover:bg-white/10"
                    >
                        Verify NTN/CNIC
                    </button>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-(--accent-soft)"
                    >
                        {showForm ? 'Cancel' : '+ Add Customer'}
                    </button>
                </div>
            </div>

            {message && (
                <div className={`text-sm rounded-lg p-3 mb-4 ${message.type === 'success'
                    ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                    }`}
                >
                    {message.text}
                </div>
            )}

            {/* Add Customer Form */}
            {showForm && (
                <div className="app-panel mb-6 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">New Customer</h2>
                    <form onSubmit={handleAddCustomer} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-xs text-[#c1bcaf]">Name *</label>
                                <input
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                                    placeholder="Business or person name"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-[#c1bcaf]">NTN/CNIC</label>
                                <input
                                    value={form.ntnCnic}
                                    onChange={(e) => setForm({ ...form, ntnCnic: normalizeNtnCnic(e.target.value) })}
                                    inputMode="numeric"
                                    maxLength={13}
                                    className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                                    placeholder="7-digit NTN or 13-digit CNIC"
                                />
                                {form.ntnCnic && !isValidNtnCnic(normalizedFormNtnCnic) && (
                                    <p className="mt-1 text-xs text-amber-400">Use 7 digits for NTN or 13 digits for CNIC.</p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-xs text-[#c1bcaf]">Phone</label>
                                <input
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: normalizeMobile(e.target.value) })}
                                    inputMode="numeric"
                                    maxLength={11}
                                    className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                                    placeholder="03001234567"
                                />
                                {form.phone && !isValidMobile(normalizedFormPhone) && (
                                    <p className="mt-1 text-xs text-amber-400">Use a Pakistani mobile number like 03001234567.</p>
                                )}
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-[#c1bcaf]">Email</label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                                    placeholder="email@example.com"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-xs text-[#c1bcaf]">Province</label>
                                <select
                                    value={form.province}
                                    onChange={(e) => setForm({ ...form, province: e.target.value })}
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
                                <label className="mb-1 block text-xs text-[#c1bcaf]">Address</label>
                                <input
                                    value={form.address}
                                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                                    className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                                    placeholder="Business address"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-primary disabled:opacity-70"
                        >
                            {saving ? 'Saving...' : 'Add Customer'}
                        </button>
                    </form>
                </div>
            )}

            {/* Search */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search by name, NTN, or phone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full max-w-md rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-white placeholder:text-[#8d897d]"
                />
            </div>

            {/* Table */}
            <div className="app-panel overflow-hidden rounded-2xl">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="p-3 text-left font-medium text-[#8d897d]">Name</th>
                            <th className="p-3 text-left font-medium text-[#8d897d]">NTN/CNIC</th>
                            <th className="p-3 text-left font-medium text-[#8d897d]">Phone</th>
                            <th className="p-3 text-left font-medium text-[#8d897d]">Province</th>
                            <th className="p-3 text-left font-medium text-[#8d897d]">FBR Status</th>
                            <th className="p-3 text-left font-medium text-[#8d897d]">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="p-8 text-center text-[#8d897d]">Loading...</td></tr>
                        ) : customers.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-[#8d897d]">No customers found</td></tr>
                        ) : (
                            customers.map((c) => (
                                <tr key={c.id} className="border-b border-white/10 hover:bg-white/6">
                                    <td className="p-3 text-white">{c.name}</td>
                                    <td className="p-3 font-mono text-xs text-[#d8d0bf]">{c.ntnCnic || '—'}</td>
                                    <td className="p-3 text-[#d8d0bf]">{c.phone || '—'}</td>
                                    <td className="p-3 text-[#d8d0bf]">{c.province || '—'}</td>
                                    <td className="p-3">
                                        {c.fbrVerified ? (
                                            <div className="flex flex-col gap-0.5">
                                                <span className={`text-xs px-2 py-0.5 rounded-full inline-block w-fit ${c.registrationType === 'Registered'
                                                    ? 'bg-green-500/10 text-green-400'
                                                    : 'bg-yellow-500/10 text-yellow-400'
                                                    }`}>
                                                    {c.registrationType}
                                                </span>
                                                {c.atlStatus && (
                                                    <span className={`text-xs px-2 py-0.5 rounded-full inline-block w-fit ${c.atlStatus === 'Active'
                                                        ? 'bg-green-500/10 text-green-400'
                                                        : 'bg-red-500/10 text-red-400'
                                                        }`}>
                                                        ATL: {c.atlStatus}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-[#8d897d]">Not verified</span>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        {c.ntnCnic && (
                                            <button
                                                onClick={() => handleVerifyBuyer(c.id, c.ntnCnic!)}
                                                disabled={verifying === c.id}
                                                className="rounded-lg border border-white/10 bg-white/6 px-3 py-1 text-xs text-[#f0d9a0] hover:bg-white/10"
                                            >
                                                {verifying === c.id ? 'Checking...' : c.fbrVerified ? 'Re-verify' : 'Verify FBR'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
                <div className="mt-4 flex justify-center gap-2">
                    <button
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                        className="rounded-xl border border-white/10 bg-white/6 px-3 py-1 text-sm text-[#d8d0bf] disabled:opacity-50"
                    >
                        Prev
                    </button>
                    <span className="px-3 py-1 text-sm text-[#8d897d]">
                        Page {page} of {pages}
                    </span>
                    <button
                        disabled={page >= pages}
                        onClick={() => setPage(page + 1)}
                        className="rounded-xl border border-white/10 bg-white/6 px-3 py-1 text-sm text-[#d8d0bf] disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Verify NTN/CNIC Modal */}
            {showVerifyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
                    <div className="app-panel w-full max-w-md rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Verify Buyer NTN/CNIC</h3>
                        <p className="mb-4 text-sm text-[#c1bcaf]">
                            Check a buyer&apos;s registration status and Active Taxpayer List (ATL) status with FBR.
                        </p>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={verifyNtn}
                                onChange={(e) => setVerifyNtn(normalizeNtnCnic(e.target.value))}
                                inputMode="numeric"
                                maxLength={13}
                                placeholder="Enter 7-digit NTN or 13-digit CNIC"
                                className="flex-1 rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                            />
                            <button
                                onClick={handleQuickVerify}
                                disabled={verifying === 'quick' || !verifyNtn}
                                className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-primary disabled:opacity-70"
                            >
                                {verifying === 'quick' ? 'Checking...' : 'Verify'}
                            </button>
                        </div>

                        {verifyResult && (
                            <div className="mb-4 rounded-2xl border border-white/10 bg-white/6 p-4">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-[#8d897d]">Registration Type:</span>
                                        <p className={`font-medium ${verifyResult.registrationType === 'Registered' ? 'text-green-400' : 'text-yellow-400'}`}>
                                            {verifyResult.registrationType}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-[#8d897d]">ATL Status:</span>
                                        <p className={`font-medium ${verifyResult.atlStatus === 'Active' ? 'text-green-400' : 'text-red-400'}`}>
                                            {verifyResult.atlStatus}
                                        </p>
                                    </div>
                                </div>
                                <p className={`text-xs mt-2 ${verifyResult.verified ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {verifyResult.verified ? 'Buyer verified with FBR' : 'Could not verify — buyer may not be in FBR system'}
                                </p>
                            </div>
                        )}

                        <button
                            onClick={() => { setShowVerifyModal(false); setVerifyResult(null); setVerifyNtn('') }}
                            className="w-full rounded-xl border border-white/10 bg-white/6 py-2 text-sm text-[#d8d0bf] hover:bg-white/10"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
