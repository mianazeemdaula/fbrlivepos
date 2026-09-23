'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PaginationControls } from '@/components/pagination-controls'
import { SubscriptionStatusBadge } from './[tenantId]/SubscriptionManager'

function subscriptionExpiry(sub: NonNullable<Tenant['subscription']>) {
    const iso = sub.status === 'TRIALING' && sub.trialEndsAt ? sub.trialEndsAt : sub.currentPeriodEnd
    if (!iso) return null
    const date = new Date(iso)
    const daysLeft = Math.ceil((date.getTime() - Date.now()) / 86_400_000)
    const lapsed = (sub.status === 'ACTIVE' || sub.status === 'TRIALING') && daysLeft < 0
    return { date, daysLeft, status: lapsed ? 'PAST_DUE' : sub.status }
}

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
        currentPeriodEnd?: string | null
        trialEndsAt?: string | null
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
        <div className="p-4 lg:p-6">
            <div className="mb-4">
                <h1 className="text-page-title font-semibold tracking-tight text-ink">Tenants</h1>
                <p className="mt-0.5 text-ui-xs text-muted">Manage all registered businesses on the platform</p>
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
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">Business</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">Email</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">Plan</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">Plan Status</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">Expires</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">DI Status</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">Invoices</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">Status</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">Joined</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap" />
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="border-b border-border">
                                    <td colSpan={10} className="px-3 py-2">
                                        <div className="h-4 rounded bg-border animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : tenants.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted">
                                    No tenants found.
                                </td>
                            </tr>
                        ) : (
                            tenants.map((t) => (
                                <tr key={t.id} className="border-b border-border transition-colors hover:bg-surface-subtle">
                                    <td className="max-w-[220px] truncate px-3 py-2 text-sm font-medium text-ink" title={t.name}>{t.name}</td>
                                    <td className="max-w-[220px] truncate px-3 py-2 text-xs text-muted" title={t.email}>{t.email}</td>
                                    <td className="px-3 py-2 text-sm text-ink">
                                        {t.subscription?.plan?.name || <span className="text-muted">—</span>}
                                    </td>
                                    {(() => {
                                        const expiry = t.subscription ? subscriptionExpiry(t.subscription) : null
                                        return (
                                            <>
                                                <td className="px-3 py-2">
                                                    {expiry ? <SubscriptionStatusBadge status={expiry.status} /> : <span className="text-xs text-muted">—</span>}
                                                </td>
                                                <td className={`whitespace-nowrap px-3 py-2 text-xs ${!expiry ? 'text-muted' : expiry.daysLeft < 0 ? 'text-rose-600' : expiry.daysLeft <= 7 ? 'text-amber-600' : 'text-ink'}`}>
                                                    {expiry ? expiry.date.toLocaleDateString() : '—'}
                                                </td>
                                            </>
                                        )
                                    })()}
                                    <td className="px-3 py-2">
                                        {t.diCredentials?.isProductionReady ? (
                                            <span className="text-xs text-emerald-700 font-medium">Production</span>
                                        ) : t.diCredentials ? (
                                            <span className="text-xs text-amber-700 font-medium">{t.diCredentials.environment}</span>
                                        ) : (
                                            <span className="text-xs text-muted">Not set</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-sm text-ink">
                                        {t._count?.invoices ?? 0}
                                    </td>
                                    <td className="px-3 py-2">
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.isActive
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : 'bg-red-50 text-red-700'
                                                }`}
                                        >
                                            {t.isActive ? 'Active' : 'Suspended'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-muted">
                                        {new Date(t.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <Link
                                            href={`/super-admin/tenants/${t.id}`}
                                            className="text-xs font-medium text-primary transition-colors hover:text-primary-dark"
                                        >
                                            Edit
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
