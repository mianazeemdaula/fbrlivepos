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
                    <p className="text-xs font-medium uppercase tracking-caps text-muted">Platform controls</p>
                    <h1 className="text-page-title font-normal text-ink">Feature Flags</h1>
                    <p className="mt-1 text-sm text-muted">Control platform features globally or per tenant</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
                >
                    {showForm ? 'Cancel' : '+ New Flag'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleCreate} className="bg-white rounded-card shadow-card mb-6 p-6">
                    <h2 className="text-sm font-semibold text-ink mb-4">New Feature Flag</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted">Key</label>
                            <input name="key" required className="w-full rounded-input border border-border bg-white px-3 py-2 text-sm text-ink" placeholder="e.g. email_invoices" />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted">Description</label>
                            <input name="description" className="w-full rounded-input border border-border bg-white px-3 py-2 text-sm text-ink" />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted">Default State</label>
                            <select name="isEnabled" className="w-full rounded-input border border-border bg-white px-3 py-2 text-sm text-ink">
                                <option value="false">Disabled</option>
                                <option value="true">Enabled</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm text-muted transition-colors hover:bg-surface hover:text-ink">Cancel</button>
                        <button
                            type="submit"
                            disabled={formLoading}
                            className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {formLoading ? 'Creating...' : 'Create Flag'}
                        </button>
                    </div>
                </form>
            )}

            <div className="space-y-2">
                {loading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-card shadow-card rounded-2xl p-5 animate-pulse">
                            <div className="h-5 w-32 rounded bg-border" />
                        </div>
                    ))
                    : flags.length === 0
                        ? (
                            <div className="bg-white rounded-card shadow-card rounded-2xl p-12 text-center text-sm text-muted">No feature flags configured.</div>
                        )
                        : flags.map((flag) => (
                            <div key={flag.id} className="bg-white rounded-card shadow-card rounded-2xl px-5 py-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-sm font-semibold text-ink font-mono">{flag.key}</h3>
                                        {flag.description && (
                                            <p className="mt-0.5 text-xs text-muted">{flag.description}</p>
                                        )}
                                        {flag.tenantOverrides.length > 0 && (
                                            <p className="mt-1 text-xs text-muted">
                                                {flag.tenantOverrides.length} tenant override(s)
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleToggle(flag.id, flag.isEnabled)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${flag.isEnabled
                                            ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20'
                                            : 'bg-border text-muted hover:bg-border-strong border border-border'
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
