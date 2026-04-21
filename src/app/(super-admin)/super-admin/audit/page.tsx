'use client'

import { useEffect, useState } from 'react'

interface AuditEntry {
    id: string
    action: string
    actorEmail: string
    actorRole: string
    entity: string | null
    entityId: string | null
    tenantId: string | null
    ipAddress: string | null
    createdAt: string
}

export default function AuditLogPage() {
    const [entries, setEntries] = useState<AuditEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [actionFilter, setActionFilter] = useState('')

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const params = new URLSearchParams({ page: String(page), limit: '30' })
                if (actionFilter) params.set('action', actionFilter)
                const res = await fetch(`/api/admin/audit?${params.toString()}`)
                if (res.ok) {
                    const data = await res.json()
                    setEntries(data.data || [])
                    setTotalPages(data.pages ?? 1)
                }
            } catch {
                // Ignore
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [page, actionFilter])

    return (
        <div className="p-8">
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Governance</p>
                    <h1 className="brand-heading text-3xl font-bold text-white">Audit Log</h1>
                    <p className="mt-1 text-sm text-[#c1bcaf]">Track all platform-level administrative actions</p>
                </div>
                <input
                    type="text"
                    placeholder="Filter by action..."
                    value={actionFilter}
                    onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
                    className="rounded-xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white placeholder:text-[#8d897d]"
                />
            </div>

            <div className="app-panel overflow-hidden rounded-2xl">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8d897d]">Time</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8d897d]">Actor</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8d897d]">Role</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8d897d]">Action</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8d897d]">Entity</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8d897d]">IP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="border-b border-white/10">
                                    <td colSpan={6} className="px-4 py-3">
                                        <div className="h-4 rounded bg-white/10 animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : entries.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#8d897d]">
                                    No audit entries found.
                                </td>
                            </tr>
                        ) : (
                            entries.map((entry) => (
                                <tr key={entry.id} className="border-b border-white/10 transition-colors hover:bg-white/6">
                                    <td className="px-4 py-3 text-xs whitespace-nowrap text-[#8d897d]">
                                        {new Date(entry.createdAt).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-sm text-[#d8d0bf]">{entry.actorEmail || '—'}</p>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-[#8d897d]">
                                        {entry.actorRole || '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="rounded border border-white/10 bg-white/6 px-2 py-0.5 font-mono text-xs text-[#d8d0bf]">
                                            {entry.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-[#8d897d]">
                                        {entry.entity ? `${entry.entity}:${entry.entityId?.slice(0, 8)}` : '—'}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-[#8d897d]">
                                        {entry.ipAddress || '—'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div >

            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-4">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-sm text-[#d8d0bf] disabled:opacity-40"
                    >
                        Previous
                    </button>
                    <span className="px-3 py-1.5 text-sm text-[#8d897d]">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-sm text-[#d8d0bf] disabled:opacity-40"
                    >
                        Next
                    </button>
                </div>
            )
            }
        </div >
    )
}
