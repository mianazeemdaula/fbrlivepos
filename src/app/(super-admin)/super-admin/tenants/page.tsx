'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PaginationControls } from '@/components/pagination-controls'

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
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const params = new URLSearchParams()
                if (search) params.set('q', search)
                if (filter !== 'all') params.set('status', filter.toUpperCase())
                params.set('page', String(page))
                const res = await fetch(`/api/admin/tenants?${params.toString()}`)
                if (res.ok) {
                    const data = await res.json()
                    setTenants(data.data || [])
                    setTotal(data.total ?? 0)
                    setTotalPages(data.pages ?? 1)
                }
            } catch {
                // Ignore
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [search, filter, page])

    const from = total === 0 ? 0 : (page - 1) * 25 + 1
    const to = Math.min(page * 25, total)

    return (
        <div className="p-8">
            <div className="mb-8">
                <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Accounts</p>
                <h1 className="brand-heading text-3xl font-bold text-white">Tenants</h1>
                <p className="mt-1 text-sm text-[#c1bcaf]">Manage all registered businesses on the platform</p>
            </div>

            <div className="flex gap-3 mb-4">
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value)
                        setPage(1)
                    }}
                    className="flex-1 max-w-sm rounded-xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white placeholder:text-[#8d897d]"
                />
                <select
                    value={filter}
                    onChange={(e) => {
                        setFilter(e.target.value)
                        setPage(1)
                    }}
                    className="rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
                >
                    <option value="all">All tenants</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                </select>
            </div>

            <div className="app-panel overflow-hidden rounded-2xl">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10 bg-white/3">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8d897d]">Business</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8d897d]">Plan</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8d897d]">DI Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8d897d]">Invoices</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8d897d]">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8d897d]">Joined</th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="border-b border-white/10">
                                    <td colSpan={7} className="px-4 py-3">
                                        <div className="h-4 rounded bg-white/10 animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : tenants.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#8d897d]">
                                    No tenants found.
                                </td>
                            </tr>
                        ) : (
                            tenants.map((t) => (
                                <tr key={t.id} className="border-b border-white/10 transition-colors hover:bg-white/6">
                                    <td className="px-4 py-3">
                                        <p className="text-sm text-white font-medium">{t.name}</p>
                                        <p className="text-xs text-[#8d897d]">{t.email}</p>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-[#d8d0bf]">
                                        {t.subscription?.plan?.name || <span className="text-[#8d897d]">—</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        {t.diCredentials?.isProductionReady ? (
                                            <span className="text-xs text-emerald-400 font-medium">Production</span>
                                        ) : t.diCredentials ? (
                                            <span className="text-xs text-amber-400 font-medium">{t.diCredentials.environment}</span>
                                        ) : (
                                            <span className="text-xs text-[#8d897d]">Not set</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-[#d8d0bf]">
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
                                    <td className="px-4 py-3 text-xs text-[#8d897d]">
                                        {new Date(t.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/super-admin/tenants/${t.id}`}
                                            className="text-xs font-medium text-[#f0d9a0] transition-colors hover:text-[#f6e7bf]"
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

            {!loading && total > 0 && (
                <PaginationControls
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    summary={`Showing ${from}-${to} of ${total.toLocaleString()} tenants`}
                />
            )}
        </div>
    )
}
