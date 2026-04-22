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
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Platform controls</p>
                    <h1 className="brand-heading text-3xl font-bold text-white">Feature Flags</h1>
                    <p className="mt-1 text-sm text-[#c1bcaf]">Control platform features globally or per tenant</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--accent-soft)]"
                >
                    {showForm ? 'Cancel' : '+ New Flag'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleCreate} className="app-panel mb-6 rounded-2xl p-6">
                    <h2 className="text-sm font-semibold text-white mb-4">New Feature Flag</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-[#c1bcaf]">Key</label>
                            <input name="key" required className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white" placeholder="e.g. email_invoices" />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-[#c1bcaf]">Description</label>
                            <input name="description" className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-[#c1bcaf]">Default State</label>
                            <select name="isEnabled" className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white">
                                <option value="false">Disabled</option>
                                <option value="true">Enabled</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm text-[#c1bcaf] transition-colors hover:bg-white/6 hover:text-white">Cancel</button>
                        <button
                            type="submit"
                            disabled={formLoading}
                            className="rounded-full bg-[var(--accent)] px-6 py-2 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {formLoading ? 'Creating...' : 'Create Flag'}
                        </button>
                    </div>
                </form>
            )}

            <div className="space-y-2">
                {loading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="app-panel rounded-2xl p-5 animate-pulse">
                            <div className="h-5 w-32 rounded bg-white/10" />
                        </div>
                    ))
                    : flags.length === 0
                        ? (
                            <div className="app-panel rounded-2xl p-12 text-center text-sm text-[#8d897d]">No feature flags configured.</div>
                        )
                        : flags.map((flag) => (
                            <div key={flag.id} className="app-panel rounded-2xl px-5 py-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-sm font-semibold text-white font-mono">{flag.key}</h3>
                                        {flag.description && (
                                            <p className="mt-0.5 text-xs text-[#8d897d]">{flag.description}</p>
                                        )}
                                        {flag.tenantOverrides.length > 0 && (
                                            <p className="mt-1 text-xs text-[#8d897d]">
                                                {flag.tenantOverrides.length} tenant override(s)
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleToggle(flag.id, flag.isEnabled)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${flag.isEnabled
                                            ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20'
                                            : 'bg-white/10 text-[#c1bcaf] hover:bg-white/12 border border-white/10'
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
