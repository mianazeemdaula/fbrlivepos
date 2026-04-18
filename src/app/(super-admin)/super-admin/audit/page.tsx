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
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Audit Log</h1>
                    <p className="text-slate-400 text-sm mt-1">Track all platform-level administrative actions</p>
                </div>
                <input
                    type="text"
                    placeholder="Filter by action..."
                    value={actionFilter}
                    onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-800">
                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Time</th>
                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Actor</th>
                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Role</th>
                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Action</th>
                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Entity</th>
                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">IP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="border-b border-slate-800/50">
                                    <td colSpan={6} className="px-4 py-3">
                                        <div className="h-4 bg-slate-800 rounded animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : entries.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-slate-500 text-sm">
                                    No audit entries found.
                                </td>
                            </tr>
                        ) : (
                            entries.map((entry) => (
                                <tr key={entry.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                                        {new Date(entry.createdAt).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-sm text-slate-300">{entry.actorEmail || '—'}</p>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-500">
                                        {entry.actorRole || '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                                            {entry.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-500">
                                        {entry.entity ? `${entry.entity}:${entry.entityId?.slice(0, 8)}` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-600 font-mono">
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
                        className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
                    >
                        Previous
                    </button>
                    <span className="px-3 py-1.5 text-sm text-slate-500">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
                    >
                        Next
                    </button>
                </div>
            )
            }
        </div >
    )
}
