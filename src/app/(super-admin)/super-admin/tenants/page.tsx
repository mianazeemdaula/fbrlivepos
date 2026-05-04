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
                <p className="text-xs font-medium uppercase tracking-caps text-muted">Accounts</p>
                <h1 className="text-page-title font-normal text-ink">Tenants</h1>
                <p className="mt-1 text-sm text-muted">Manage all registered businesses on the platform</p>
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
                    className="flex-1 max-w-sm rounded-input border border-border bg-white px-4 py-2 text-sm text-ink placeholder:text-muted"
                />
                <select
                    value={filter}
                    onChange={(e) => {
                        setFilter(e.target.value)
                        setPage(1)
                    }}
                    className="rounded-input border border-border bg-white px-3 py-2 text-sm text-ink"
                >
                    <option value="all">All tenants</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                </select>
            </div>

            <div className="bg-white rounded-card shadow-card overflow-hidden rounded-2xl">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border bg-surface-subtle">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Business</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Plan</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">DI Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Invoices</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Joined</th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="border-b border-border">
                                    <td colSpan={7} className="px-4 py-3">
                                        <div className="h-4 rounded bg-border animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : tenants.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                                    No tenants found.
                                </td>
                            </tr>
                        ) : (
                            tenants.map((t) => (
                                <tr key={t.id} className="border-b border-border transition-colors hover:bg-surface-subtle">
                                    <td className="px-4 py-3">
                                        <p className="text-sm text-ink font-medium">{t.name}</p>
                                        <p className="text-xs text-muted">{t.email}</p>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-ink">
                                        {t.subscription?.plan?.name || <span className="text-muted">—</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        {t.diCredentials?.isProductionReady ? (
                                            <span className="text-xs text-emerald-400 font-medium">Production</span>
                                        ) : t.diCredentials ? (
                                            <span className="text-xs text-amber-400 font-medium">{t.diCredentials.environment}</span>
                                        ) : (
                                            <span className="text-xs text-muted">Not set</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-ink">
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
                                    <td className="px-4 py-3 text-xs text-muted">
                                        {new Date(t.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/super-admin/tenants/${t.id}`}
                                            className="text-xs font-medium text-muted transition-colors hover:text-cream"
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
