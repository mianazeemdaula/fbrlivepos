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
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <p className="text-xs font-medium uppercase tracking-caps text-muted">Buyer registry</p>
                    <h1 className="mt-1 text-page-title font-normal text-ink">Customers</h1>
                    <p className="mt-1 text-ui-xs text-muted">{total} total customers</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowVerifyModal(true)}
                        className="rounded-full border border-border bg-white px-4 py-2 text-ui-xs font-medium text-ink hover:bg-surface transition-colors"
                    >
                        Verify NTN/CNIC
                    </button>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="rounded-full bg-primary px-4 py-2 text-ui-xs font-medium text-white hover:bg-primary-dark transition-colors"
                    >
                        {showForm ? 'Cancel' : '+ Add Customer'}
                    </button>
                </div>
            </div>

            {message && (
                <div className={`text-ui-xs rounded-input p-3 mb-4 ${message.type === 'success'
                    ? 'bg-success-bg text-success border border-success-border'
                    : 'bg-error-bg text-error border border-error-border'
                    }`}
                >
                    {message.text}
                </div>
            )}

            {/* Add Customer Form */}
            {showForm && (
                <div className="bg-white rounded-card shadow-card mb-6 p-6">
                    <h2 className="text-ui-sm font-semibold text-ink mb-4">New Customer</h2>
                    <form onSubmit={handleAddCustomer} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-xs text-muted">Name *</label>
                                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full rounded-input border border-border px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:border-primary"
                                    placeholder="Business or person name" />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-muted">NTN/CNIC</label>
                                <input value={form.ntnCnic} onChange={(e) => setForm({ ...form, ntnCnic: normalizeNtnCnic(e.target.value) })}
                                    inputMode="numeric" maxLength={13}
                                    className="w-full rounded-input border border-border px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:border-primary"
                                    placeholder="7-digit NTN or 13-digit CNIC" />
                                {form.ntnCnic && !isValidNtnCnic(normalizedFormNtnCnic) && (
                                    <p className="mt-1 text-xs text-warning">Use 7 digits for NTN or 13 digits for CNIC.</p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-xs text-muted">Phone</label>
                                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: normalizeMobile(e.target.value) })}
                                    inputMode="numeric" maxLength={11}
                                    className="w-full rounded-input border border-border px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:border-primary"
                                    placeholder="03001234567" />
                                {form.phone && !isValidMobile(normalizedFormPhone) && (
                                    <p className="mt-1 text-xs text-warning">Use a Pakistani mobile number like 03001234567.</p>
                                )}
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-muted">Email</label>
                                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className="w-full rounded-input border border-border px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:border-primary"
                                    placeholder="email@example.com" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-xs text-muted">Province</label>
                                <select value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })}
                                    className="w-full rounded-input border border-border px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:border-primary">
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
                                <label className="mb-1 block text-xs text-muted">Address</label>
                                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                                    className="w-full rounded-input border border-border px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:border-primary"
                                    placeholder="Business address" />
                            </div>
                        </div>
                        <button type="submit" disabled={saving}
                            className="rounded-full bg-primary px-4 py-2 text-ui-xs font-medium text-white disabled:opacity-70 hover:bg-primary-dark transition-colors">
                            {saving ? 'Saving...' : 'Add Customer'}
                        </button>
                    </form>
                </div>
            )}

            {/* Search */}
            <div className="mb-4">
                <input type="text" placeholder="Search by name, NTN, or phone..."
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    className="w-full max-w-md rounded-input border border-border bg-white px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-primary" />
            </div>

            {/* Table */}
            <div className="bg-white rounded-card shadow-card overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border-muted">
                            <th className="p-4 text-left text-ui-xs font-normal text-muted">Name</th>
                            <th className="p-4 text-left text-ui-xs font-normal text-muted">NTN/CNIC</th>
                            <th className="p-4 text-left text-ui-xs font-normal text-muted">Phone</th>
                            <th className="p-4 text-left text-ui-xs font-normal text-muted">Province</th>
                            <th className="p-4 text-left text-ui-xs font-normal text-muted">FBR Register</th>
                            <th className="p-4 text-left text-ui-xs font-normal text-muted">FBR Status</th>
                            <th className="p-4 text-left text-ui-xs font-normal text-muted">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="p-8 text-center text-muted">Loading...</td></tr>
                        ) : customers.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-muted">No customers found</td></tr>
                        ) : (
                            customers.map((c) => (
                                <tr key={c.id} className="border-b border-border-muted hover:bg-surface-subtle transition-colors">
                                    <td className="px-4 py-2 font-medium text-ink">{c.name}</td>
                                    <td className="px-4 py-2 font-mono text-ui-xs text-muted">{c.ntnCnic || '—'}</td>
                                    <td className="px-4 py-2 text-muted">{c.phone || '—'}</td>
                                    <td className="px-4 py-2 text-muted">{c.province || '—'}</td>
                                    <td className="px-4 py-2">
                                        {c.fbrVerified ? (
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium w-fit ${c.registrationType === 'Registered' ? 'bg-success-bg text-success' : 'bg-accent-light text-warning'}`}>
                                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                                {c.registrationType}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted">Not verified</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2">
                                        {c.atlStatus ? (
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium w-fit ${c.atlStatus === 'Active' ? 'bg-success-bg text-success' : 'bg-error-bg text-error'}`}>
                                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                                ATL: {c.atlStatus}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted">Not verified</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2">
                                        {c.ntnCnic && (
                                            <button onClick={() => handleVerifyBuyer(c.id, c.ntnCnic!)} disabled={verifying === c.id}
                                                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface disabled:opacity-50 transition-colors">
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
                    <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                        className="rounded-full border border-border bg-white px-3 py-1.5 text-ui-xs text-ink disabled:opacity-40 hover:bg-surface transition-colors">
                        Prev
                    </button>
                    <span className="px-3 py-1.5 text-ui-xs text-muted">Page {page} of {pages}</span>
                    <button disabled={page >= pages} onClick={() => setPage(page + 1)}
                        className="rounded-full border border-border bg-white px-3 py-1.5 text-ui-xs text-ink disabled:opacity-40 hover:bg-surface transition-colors">
                        Next
                    </button>
                </div>
            )}

            {/* Verify NTN/CNIC Modal */}
            {showVerifyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-card shadow-modal w-full max-w-md p-6">
                        <h3 className="text-heading-sm font-semibold text-ink mb-3">Verify Buyer NTN/CNIC</h3>
                        <p className="mb-4 text-ui-xs text-muted">
                            Check a buyer&apos;s registration status and Active Taxpayer List (ATL) status with FBR.
                        </p>
                        <div className="flex gap-2 mb-4">
                            <input type="text" value={verifyNtn} onChange={(e) => setVerifyNtn(normalizeNtnCnic(e.target.value))}
                                inputMode="numeric" maxLength={13} placeholder="Enter 7-digit NTN or 13-digit CNIC"
                                className="flex-1 rounded-input border border-border px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:border-primary" />
                            <button onClick={handleQuickVerify} disabled={verifying === 'quick' || !verifyNtn}
                                className="rounded-full bg-primary px-4 py-2 text-ui-xs font-medium text-white disabled:opacity-70 hover:bg-primary-dark transition-colors">
                                {verifying === 'quick' ? 'Checking...' : 'Verify'}
                            </button>
                        </div>
                        {verifyResult && (
                            <div className="mb-4 rounded-xl border border-border-muted bg-surface-subtle p-4">
                                <div className="grid grid-cols-2 gap-3 text-ui-xs">
                                    <div>
                                        <span className="">Registration:</span>
                                        <p className={`font-medium mt-0.5 ${verifyResult.registrationType === 'Registered' ? 'text-success' : 'text-warning'}`}>
                                            {verifyResult.registrationType}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="">ATL Status:</span>
                                        <p className={`font-medium mt-0.5 ${verifyResult.atlStatus === 'Active' ? 'text-success' : 'text-error'}`}>
                                            {verifyResult.atlStatus}
                                        </p>
                                    </div>
                                </div>
                                <p className={`text-xs mt-2 ${verifyResult.verified ? 'text-success' : 'text-warning'}`}>
                                    {verifyResult.verified ? 'Buyer verified with FBR' : 'Could not verify — buyer may not be in FBR system'}
                                </p>
                            </div>
                        )}
                        <button onClick={() => { setShowVerifyModal(false); setVerifyResult(null); setVerifyNtn('') }}
                            className="w-full rounded-input border border-border py-2.5 text-ui-xs text-ink hover:bg-surface transition-colors">
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
