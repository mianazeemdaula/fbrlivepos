'use client'

import { useEffect, useState, useCallback } from 'react'

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
        try {
            const res = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name,
                    ntnCnic: form.ntnCnic || undefined,
                    phone: form.phone || undefined,
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
        if (!verifyNtn) return
        setVerifying('quick')
        setVerifyResult(null)
        try {
            const res = await fetch('/api/customers/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ntnCnic: verifyNtn }),
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
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Customers</h1>
                    <p className="text-sm text-slate-400 mt-1">{total} total customers</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowVerifyModal(true)}
                        className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                        Verify NTN/CNIC
                    </button>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
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
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
                    <h2 className="text-lg font-semibold text-white mb-4">New Customer</h2>
                    <form onSubmit={handleAddCustomer} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Name *</label>
                                <input
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                    placeholder="Business or person name"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">NTN/CNIC</label>
                                <input
                                    value={form.ntnCnic}
                                    onChange={(e) => setForm({ ...form, ntnCnic: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                    placeholder="7-digit NTN or 13-digit CNIC"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Phone</label>
                                <input
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                    placeholder="+92 3XX XXXXXXX"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                    placeholder="email@example.com"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Province</label>
                                <select
                                    value={form.province}
                                    onChange={(e) => setForm({ ...form, province: e.target.value })}
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
                                <label className="block text-xs text-slate-400 mb-1">Address</label>
                                <input
                                    value={form.address}
                                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                    placeholder="Business address"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
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
                    className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>

            {/* Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-800">
                            <th className="text-left p-3 text-slate-400 font-medium">Name</th>
                            <th className="text-left p-3 text-slate-400 font-medium">NTN/CNIC</th>
                            <th className="text-left p-3 text-slate-400 font-medium">Phone</th>
                            <th className="text-left p-3 text-slate-400 font-medium">Province</th>
                            <th className="text-left p-3 text-slate-400 font-medium">FBR Status</th>
                            <th className="text-left p-3 text-slate-400 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading...</td></tr>
                        ) : customers.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-500">No customers found</td></tr>
                        ) : (
                            customers.map((c) => (
                                <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                    <td className="p-3 text-white">{c.name}</td>
                                    <td className="p-3 text-slate-300 font-mono text-xs">{c.ntnCnic || '—'}</td>
                                    <td className="p-3 text-slate-300">{c.phone || '—'}</td>
                                    <td className="p-3 text-slate-300">{c.province || '—'}</td>
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
                                            <span className="text-xs text-slate-500">Not verified</span>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        {c.ntnCnic && (
                                            <button
                                                onClick={() => handleVerifyBuyer(c.id, c.ntnCnic!)}
                                                disabled={verifying === c.id}
                                                className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 px-3 py-1 rounded-lg"
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
                <div className="flex justify-center gap-2 mt-4">
                    <button
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                        className="px-3 py-1 bg-slate-800 text-white rounded disabled:opacity-50 text-sm"
                    >
                        Prev
                    </button>
                    <span className="px-3 py-1 text-slate-400 text-sm">
                        Page {page} of {pages}
                    </span>
                    <button
                        disabled={page >= pages}
                        onClick={() => setPage(page + 1)}
                        className="px-3 py-1 bg-slate-800 text-white rounded disabled:opacity-50 text-sm"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Verify NTN/CNIC Modal */}
            {showVerifyModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold text-white mb-4">Verify Buyer NTN/CNIC</h3>
                        <p className="text-sm text-slate-400 mb-4">
                            Check a buyer&apos;s registration status and Active Taxpayer List (ATL) status with FBR.
                        </p>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={verifyNtn}
                                onChange={(e) => setVerifyNtn(e.target.value)}
                                placeholder="Enter 7-digit NTN or 13-digit CNIC"
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                            />
                            <button
                                onClick={handleQuickVerify}
                                disabled={verifying === 'quick' || !verifyNtn}
                                className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
                            >
                                {verifying === 'quick' ? 'Checking...' : 'Verify'}
                            </button>
                        </div>

                        {verifyResult && (
                            <div className="bg-slate-800 rounded-lg p-4 mb-4">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-slate-400">Registration Type:</span>
                                        <p className={`font-medium ${verifyResult.registrationType === 'Registered' ? 'text-green-400' : 'text-yellow-400'}`}>
                                            {verifyResult.registrationType}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">ATL Status:</span>
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
                            className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
