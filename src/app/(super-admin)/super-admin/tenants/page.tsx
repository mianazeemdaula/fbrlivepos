'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Tenant {
    id: string
    name: string
    email: string
    phone: string | null
    isActive: boolean
    diCredentials: { environment: string; isProductionReady: boolean; lastVerifiedAt: string | null } | null
    createdAt: string
    subscription?: {
        plan?: { name: string; slug: string }
        status: string
    } | null
    _count?: { invoices: number; users: number }
}

export default function TenantsPage() {
    const [tenants, setTenants] = useState<Tenant[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('all')

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const params = new URLSearchParams()
                if (search) params.set('q', search)
                if (filter !== 'all') params.set('status', filter.toUpperCase())
                const res = await fetch(`/api/admin/tenants?${params.toString()}`)
                if (res.ok) {
                    const data = await res.json()
                    setTenants(data.data || [])
                }
            } catch {
                // Ignore
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [search, filter])

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Tenants</h1>
                <p className="text-slate-400 text-sm mt-1">Manage all registered businesses on the platform</p>
            </div>

            <div className="flex gap-3 mb-4">
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 max-w-sm bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                    <option value="all">All tenants</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                </select>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/80">
                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Business</th>
                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Plan</th>
                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">DI Status</th>
                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Invoices</th>
                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Joined</th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="border-b border-slate-800/50">
                                    <td colSpan={7} className="px-4 py-3">
                                        <div className="h-4 bg-slate-800 rounded animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : tenants.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-slate-500 text-sm">
                                    No tenants found.
                                </td>
                            </tr>
                        ) : (
                            tenants.map((t) => (
                                <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <p className="text-sm text-white font-medium">{t.name}</p>
                                        <p className="text-xs text-slate-500">{t.email}</p>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-300">
                                        {t.subscription?.plan?.name || <span className="text-slate-600">—</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        {t.diCredentials?.isProductionReady ? (
                                            <span className="text-xs text-emerald-400 font-medium">Production</span>
                                        ) : t.diCredentials ? (
                                            <span className="text-xs text-amber-400 font-medium">{t.diCredentials.environment}</span>
                                        ) : (
                                            <span className="text-xs text-slate-600">Not set</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-300">
                                        {t._count?.invoices ?? 0}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.isActive
                                                    ? 'bg-emerald-500/10 text-emerald-400'
                                                    : 'bg-red-500/10 text-red-400'
                                                }`}
                                        >
                                            {t.isActive ? 'Active' : 'Suspended'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-500">
                                        {new Date(t.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/super-admin/tenants/${t.id}`}
                                            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                                        >
                                            Manage →
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
