'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

interface TenantFeature {
    key: string
    label: string
    description: string
    enabled: boolean
}

export function TenantFeatures({
    tenantId,
    onChanged,
    onError,
}: {
    tenantId: string
    onChanged: (message: string) => void
    onError: (message: string) => void
}) {
    const [features, setFeatures] = useState<TenantFeature[] | null>(null)
    const [savingKey, setSavingKey] = useState<string | null>(null)

    useEffect(() => {
        fetch(`/api/admin/tenants/${tenantId}/features`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => setFeatures(data?.features ?? []))
            .catch(() => setFeatures([]))
    }, [tenantId])

    async function toggle(feature: TenantFeature) {
        setSavingKey(feature.key)
        try {
            const res = await fetch(`/api/admin/tenants/${tenantId}/features`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: feature.key, enabled: !feature.enabled }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                onError(data.error || 'Failed to update feature.')
                return
            }
            setFeatures((current) => current?.map((f) => (f.key === feature.key ? { ...f, enabled: !f.enabled } : f)) ?? null)
            onChanged(`${feature.label} ${feature.enabled ? 'disabled' : 'enabled'} for this tenant.`)
        } catch {
            onError('Network error while updating feature.')
        } finally {
            setSavingKey(null)
        }
    }

    return (
        <div className="bg-white rounded-2xl border border-border mb-6 p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-ink">Features</h2>
            </div>
            <p className="mb-4 text-xs text-muted">Optional features enabled only for selected tenants.</p>

            {features === null ? (
                <div className="h-12 animate-pulse rounded-xl bg-border" />
            ) : (
                <div className="space-y-2">
                    {features.map((feature) => (
                        <div key={feature.key} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-subtle p-3.5">
                            <div>
                                <p className="text-sm font-semibold text-ink">{feature.label}</p>
                                <p className="text-xs text-muted">{feature.description}</p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={feature.enabled}
                                aria-label={`Toggle ${feature.label}`}
                                disabled={savingKey === feature.key}
                                onClick={() => toggle(feature)}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50 ${feature.enabled ? 'bg-primary' : 'bg-border-strong'}`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${feature.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
