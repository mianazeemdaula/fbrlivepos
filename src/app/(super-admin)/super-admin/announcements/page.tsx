'use client'

import { useEffect, useState } from 'react'
import { PaginationControls } from '@/components/pagination-controls'

type AnnouncementType = 'INFO' | 'WARNING' | 'MAINTENANCE' | 'FEATURE'

interface Announcement {
    id: string
    title: string
    body: string
    type: AnnouncementType
    targetPlans: string[]
    startsAt: string
    endsAt: string | null
    isDismissable: boolean
    createdAt: string
}

const TYPE_STYLES: Record<AnnouncementType, { label: string; color: string; dot: string }> = {
    INFO: { label: 'Info', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20', dot: 'bg-sky-400' },
    WARNING: { label: 'Warning', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400' },
    MAINTENANCE: { label: 'Maintenance', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', dot: 'bg-orange-400' },
    FEATURE: { label: 'Feature', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
}

export default function AnnouncementsPage() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const [showForm, setShowForm] = useState(false)
    const [formLoading, setFormLoading] = useState(false)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [error, setError] = useState('')

    async function loadAnnouncements() {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/announcements?page=${page}`)
            if (res.ok) {
                const data = await res.json()
                setAnnouncements(data.announcements || [])
                setTotal(data.meta?.total ?? 0)
                setTotalPages(data.meta?.totalPages ?? 1)
            }
        } catch {
            // Ignore
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadAnnouncements()
    }, [page])

    async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setFormLoading(true)
        setError('')

        const fd = new FormData(e.currentTarget)

        try {
            const res = await fetch('/api/admin/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: fd.get('title'),
                    body: fd.get('body'),
                    type: fd.get('type'),
                    targetPlans: [],
                    startsAt: new Date(fd.get('startsAt') as string).toISOString(),
                    endsAt: fd.get('endsAt') ? new Date(fd.get('endsAt') as string).toISOString() : null,
                    isDismissable: fd.get('isDismissable') === 'true',
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                setError(data.error || 'Failed to create announcement')
                return
            }

            setShowForm(false)
            setPage(1)
            loadAnnouncements()
        } catch {
            setError('Network error')
        } finally {
            setFormLoading(false)
        }
    }

    async function handleDelete(id: string) {
        setDeleteId(id)
        try {
            await fetch(`/api/admin/announcements?id=${id}`, { method: 'DELETE' })
            if (announcements.length === 1 && page > 1) {
                setPage(page - 1)
            } else {
                loadAnnouncements()
            }
        } catch {
            // Ignore
        } finally {
            setDeleteId(null)
        }
    }

    const isActive = (a: Announcement) => {
        const now = new Date()
        const starts = new Date(a.startsAt)
        const ends = a.endsAt ? new Date(a.endsAt) : null
        return starts <= now && (!ends || ends >= now)
    }

    const from = total === 0 ? 0 : (page - 1) * 20 + 1
    const to = Math.min(page * 20, total)

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Announcements</h1>
                    <p className="text-slate-400 text-sm mt-1">Publish platform-wide notices to tenants</p>
                </div>
                <button
                    onClick={() => { setShowForm(!showForm); setError('') }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    {showForm ? 'Cancel' : 'New Announcement'}
                </button>
            </div>

            {/* Create form */}
            {showForm && (
                <form onSubmit={handleCreate} className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
                    <h2 className="text-sm font-semibold text-white mb-4">Create Announcement</h2>

                    {error && (
                        <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg p-3">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Title</label>
                            <input
                                name="title"
                                required
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                                placeholder="e.g. Scheduled Maintenance on Saturday"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Body</label>
                            <textarea
                                name="body"
                                required
                                rows={3}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none"
                                placeholder="Announcement details..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Type</label>
                            <select
                                name="type"
                                defaultValue="INFO"
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            >
                                <option value="INFO">Info</option>
                                <option value="WARNING">Warning</option>
                                <option value="MAINTENANCE">Maintenance</option>
                                <option value="FEATURE">Feature</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Dismissable</label>
                            <select
                                name="isDismissable"
                                defaultValue="true"
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            >
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Starts At</label>
                            <input
                                name="startsAt"
                                type="datetime-local"
                                required
                                defaultValue={new Date().toISOString().slice(0, 16)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Ends At <span className="text-slate-600">(optional)</span></label>
                            <input
                                name="endsAt"
                                type="datetime-local"
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={formLoading}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white transition-colors"
                        >
                            {formLoading ? 'Publishing...' : 'Publish'}
                        </button>
                    </div>
                </form>
            )}

            {/* List */}
            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse">
                            <div className="flex gap-3 mb-3">
                                <div className="h-5 w-20 bg-slate-800 rounded-full" />
                                <div className="h-5 w-40 bg-slate-800 rounded" />
                            </div>
                            <div className="h-4 bg-slate-800 rounded w-3/4 mb-2" />
                            <div className="h-3 bg-slate-800 rounded w-1/2" />
                        </div>
                    ))}
                </div>
            ) : announcements.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-slate-700 mb-4">
                        <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0" />
                    </svg>
                    <p className="text-slate-500 text-sm">No announcements yet.</p>
                    <p className="text-slate-600 text-xs mt-1">Create one to notify your tenants.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {announcements.map((a) => {
                        const style = TYPE_STYLES[a.type]
                        const active = isActive(a)
                        return (
                            <div key={a.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center flex-wrap gap-2 mb-2">
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${style.color}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                                {style.label}
                                            </span>
                                            {active ? (
                                                <span className="text-xs text-emerald-400 font-medium">● Active</span>
                                            ) : (
                                                <span className="text-xs text-slate-600 font-medium">Inactive</span>
                                            )}
                                            {!a.isDismissable && (
                                                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">Persistent</span>
                                            )}
                                        </div>
                                        <h3 className="text-sm font-semibold text-white mb-1">{a.title}</h3>
                                        <p className="text-xs text-slate-400 leading-relaxed">{a.body}</p>
                                        <div className="flex items-center gap-3 mt-3 text-xs text-slate-600">
                                            <span>Starts {new Date(a.startsAt).toLocaleString()}</span>
                                            {a.endsAt && <span>· Ends {new Date(a.endsAt).toLocaleString()}</span>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(a.id)}
                                        disabled={deleteId === a.id}
                                        className="shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
                                        title="Delete announcement"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6" />
                                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                            <path d="M10 11v6" /><path d="M14 11v6" />
                                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {!loading && total > 0 && (
                <PaginationControls
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    summary={`Showing ${from}-${to} of ${total.toLocaleString()} announcements`}
                />
            )}
        </div>
    )
}
