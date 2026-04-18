'use client'

import { useEffect, useState } from 'react'

interface FeatureFlag {
    id: string
    key: string
    description: string | null
    isEnabled: boolean
    tenantOverrides: Array<{
        tenantId: string
        isEnabled: boolean
        tenant: { businessName: string }
    }>
}

export default function FeatureFlagsPage() {
    const [flags, setFlags] = useState<FeatureFlag[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [formLoading, setFormLoading] = useState(false)

    async function loadFlags() {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/feature-flags')
            if (res.ok) {
                const data = await res.json()
                setFlags(data.flags || [])
            }
        } catch {
            // Ignore
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadFlags()
    }, [])

    async function handleToggle(flagId: string, currentState: boolean) {
        try {
            await fetch('/api/admin/feature-flags', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ flagId, isEnabled: !currentState }),
            })
            loadFlags()
        } catch {
            // Ignore
        }
    }

    async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setFormLoading(true)

        const fd = new FormData(e.currentTarget)

        try {
            await fetch('/api/admin/feature-flags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: fd.get('key'),
                    description: fd.get('description') || null,
                    isEnabled: fd.get('isEnabled') === 'true',
                }),
            })
            setShowForm(false)
            loadFlags()
        } catch {
            // Ignore
        } finally {
            setFormLoading(false)
        }
    }

    return (
        <div className="p-8">
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Feature Flags</h1>
                    <p className="text-slate-400 text-sm mt-1">Control platform features globally or per tenant</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                    {showForm ? 'Cancel' : '+ New Flag'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleCreate} className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
                    <h2 className="text-sm font-semibold text-white mb-4">New Feature Flag</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Key</label>
                            <input name="key" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="e.g. email_invoices" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
                            <input name="description" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Default State</label>
                            <select name="isEnabled" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                                <option value="false">Disabled</option>
                                <option value="true">Enabled</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">Cancel</button>
                        <button
                            type="submit"
                            disabled={formLoading}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            {formLoading ? 'Creating...' : 'Create Flag'}
                        </button>
                    </div>
                </form>
            )}

            <div className="space-y-2">
                {loading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse">
                            <div className="h-5 bg-slate-800 rounded w-32" />
                        </div>
                    ))
                    : flags.length === 0
                        ? (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-sm">No feature flags configured.</div>
                        )
                        : flags.map((flag) => (
                            <div key={flag.id} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-sm font-semibold text-white font-mono">{flag.key}</h3>
                                        {flag.description && (
                                            <p className="text-xs text-slate-500 mt-0.5">{flag.description}</p>
                                        )}
                                        {flag.tenantOverrides.length > 0 && (
                                            <p className="text-xs text-slate-600 mt-1">
                                                {flag.tenantOverrides.length} tenant override(s)
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleToggle(flag.id, flag.isEnabled)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${flag.isEnabled
                                            ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                                            }`}
                                    >
                                        {flag.isEnabled ? 'Enabled' : 'Disabled'}
                                    </button>
                                </div>
                            </div>
                        ))}
            </div>
        </div>
    )
}
