'use client'

import { useEffect, useState } from 'react'

interface Plan {
    id: string
    name: string
    slug: string
    description: string
    monthlyPrice: number
    yearlyPrice: number
    currency: string
    isActive: boolean
    isPublic: boolean
    sortOrder: number
    trialDays: number
    maxPosTerminals: number | null
    maxUsers: number | null
    maxProducts: number | null
    maxInvoicesMonth: number | null
    maxHsCodesAccess: number | null
    dataRetentionDays: number
    features: Array<{ key: string; value: string; label: string }>
    _count?: { tenantSubscriptions: number }
}

interface PlanFormState {
    name: string
    slug: string
    description: string
    monthlyPrice: string
    yearlyPrice: string
    currency: string
    maxPosTerminals: string
    maxUsers: string
    maxProducts: string
    maxInvoicesMonth: string
    maxHsCodesAccess: string
    dataRetentionDays: string
    trialDays: string
    sortOrder: string
    isActive: boolean
    isPublic: boolean
}

const inputClassName = 'w-full rounded-input border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-primary'

function createDefaultFormState(): PlanFormState {
    return {
        name: '',
        slug: '',
        description: '',
        monthlyPrice: '0',
        yearlyPrice: '0',
        currency: 'PKR',
        maxPosTerminals: '1',
        maxUsers: '2',
        maxProducts: '100',
        maxInvoicesMonth: '500',
        maxHsCodesAccess: '',
        dataRetentionDays: '365',
        trialDays: '0',
        sortOrder: '0',
        isActive: true,
        isPublic: true,
    }
}

function createFormStateFromPlan(plan: Plan): PlanFormState {
    return {
        name: plan.name,
        slug: plan.slug,
        description: plan.description,
        monthlyPrice: String(plan.monthlyPrice),
        yearlyPrice: String(plan.yearlyPrice),
        currency: plan.currency,
        maxPosTerminals: plan.maxPosTerminals == null ? '' : String(plan.maxPosTerminals),
        maxUsers: plan.maxUsers == null ? '' : String(plan.maxUsers),
        maxProducts: plan.maxProducts == null ? '' : String(plan.maxProducts),
        maxInvoicesMonth: plan.maxInvoicesMonth == null ? '' : String(plan.maxInvoicesMonth),
        maxHsCodesAccess: plan.maxHsCodesAccess == null ? '' : String(plan.maxHsCodesAccess),
        dataRetentionDays: String(plan.dataRetentionDays),
        trialDays: String(plan.trialDays),
        sortOrder: String(plan.sortOrder),
        isActive: plan.isActive,
        isPublic: plan.isPublic,
    }
}

function parseNullableInteger(value: string) {
    const trimmed = value.trim()
    return trimmed ? Number.parseInt(trimmed, 10) : null
}

function parseRequiredNumber(value: string) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
}

function parseRequiredInteger(value: string) {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : null
}

function normalizeSlug(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
}

export default function SubscriptionsPage() {
    const [plans, setPlans] = useState<Plan[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
    const [form, setForm] = useState<PlanFormState>(createDefaultFormState)
    const [formLoading, setFormLoading] = useState(false)
    const [actionPlanId, setActionPlanId] = useState<string | null>(null)
    const [error, setError] = useState('')

    async function loadPlans() {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/subscriptions')
            if (res.ok) {
                const data = await res.json()
                setPlans(data.plans || [])
            }
        } catch {
            // Ignore
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadPlans()
    }, [])

    function resetForm() {
        setEditingPlanId(null)
        setForm(createDefaultFormState())
        setError('')
        setShowForm(false)
    }

    function openCreateForm() {
        setEditingPlanId(null)
        setForm(createDefaultFormState())
        setError('')
        setShowForm(true)
    }

    function openEditForm(plan: Plan) {
        setEditingPlanId(plan.id)
        setForm(createFormStateFromPlan(plan))
        setError('')
        setShowForm(true)
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setFormLoading(true)
        setError('')

        try {
            const monthlyPrice = parseRequiredNumber(form.monthlyPrice)
            const yearlyPrice = parseRequiredNumber(form.yearlyPrice)
            const dataRetentionDays = parseRequiredInteger(form.dataRetentionDays)
            const trialDays = parseRequiredInteger(form.trialDays)
            const sortOrder = parseRequiredInteger(form.sortOrder)

            if (monthlyPrice == null || yearlyPrice == null) {
                setError('Monthly and yearly price must be valid numbers')
                return
            }

            if (dataRetentionDays == null || trialDays == null || sortOrder == null) {
                setError('Retention days, trial days, and sort order must be valid integers')
                return
            }

            const res = await fetch(editingPlanId ? `/api/admin/subscriptions/${editingPlanId}` : '/api/admin/subscriptions', {
                method: editingPlanId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name.trim(),
                    slug: normalizeSlug(form.slug),
                    description: form.description.trim(),
                    priceMonthly: monthlyPrice,
                    priceYearly: yearlyPrice,
                    currency: form.currency.trim().toUpperCase(),
                    maxPosTerminals: parseNullableInteger(form.maxPosTerminals),
                    maxUsers: parseNullableInteger(form.maxUsers),
                    maxProducts: parseNullableInteger(form.maxProducts),
                    maxInvoicesMonth: parseNullableInteger(form.maxInvoicesMonth),
                    maxHsCodesAccess: parseNullableInteger(form.maxHsCodesAccess),
                    dataRetentionDays,
                    trialDays,
                    sortOrder,
                    isActive: form.isActive,
                    isPublic: form.isPublic,
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                setError(data.error || `Failed to ${editingPlanId ? 'update' : 'create'} plan`)
                return
            }

            resetForm()
            await loadPlans()
        } catch {
            setError('Network error')
        } finally {
            setFormLoading(false)
        }
    }

    async function handleTogglePlan(plan: Plan) {
        setActionPlanId(plan.id)
        setError('')

        try {
            const res = await fetch(`/api/admin/subscriptions/${plan.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isActive: !plan.isActive,
                    isPublic: !plan.isActive ? true : plan.isPublic,
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                setError(data.error || 'Failed to update plan status')
                return
            }

            await loadPlans()
        } catch {
            setError('Network error')
        } finally {
            setActionPlanId(null)
        }
    }

    const formTitle = editingPlanId ? 'Edit Subscription Plan' : 'New Subscription Plan'
    const submitLabel = formLoading ? (editingPlanId ? 'Saving...' : 'Creating...') : (editingPlanId ? 'Save Changes' : 'Create Plan')

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <p className="text-xs font-medium uppercase tracking-caps text-muted">Packages</p>
                    <h1 className="mt-1 text-page-title font-normal text-ink">Subscription Plans</h1>
                    <p className="mt-1 text-ui-xs text-muted">Manage pricing tiers and feature entitlements</p>
                </div>
                <button
                    onClick={() => (showForm && !editingPlanId ? resetForm() : openCreateForm())}
                    className="rounded-full bg-primary px-4 py-2 text-ui-xs font-medium text-white hover:bg-primary-dark transition-colors"
                >
                    {showForm && !editingPlanId ? 'Cancel' : '+ New Plan'}
                </button>
            </div>

            {error && !showForm && (
                <div className="mb-6 rounded-input bg-error-bg border border-error-border p-3 text-ui-xs text-error">
                    {error}
                </div>
            )}

            {/* Create / Edit form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white rounded-card shadow-card border border-border-muted mb-8 p-6">
                    {error && (
                        <div className="mb-4 rounded-input bg-error-bg border border-error-border p-3 text-ui-xs text-error">
                            {error}
                        </div>
                    )}
                    <h2 className="text-ui-sm font-semibold text-ink mb-5">{formTitle}</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted">Plan Name</label>
                            <input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} required className={inputClassName} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted">Slug</label>
                            <input value={form.slug} onChange={(e) => setForm((c) => ({ ...c, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} required className={inputClassName} placeholder="e.g. starter" />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted">Monthly Price (PKR)</label>
                            <input value={form.monthlyPrice} onChange={(e) => setForm((c) => ({ ...c, monthlyPrice: e.target.value }))} type="number" step="0.01" min="0" required className={inputClassName} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted">Yearly Price (PKR)</label>
                            <input value={form.yearlyPrice} onChange={(e) => setForm((c) => ({ ...c, yearlyPrice: e.target.value }))} type="number" step="0.01" min="0" required className={inputClassName} />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="mb-1.5 block text-xs font-medium text-muted">Description</label>
                        <textarea value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} required rows={3} className={`${inputClassName} resize-none`} placeholder="Short summary of what this plan includes" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted">Max POS Terminals</label>
                            <input value={form.maxPosTerminals} onChange={(e) => setForm((c) => ({ ...c, maxPosTerminals: e.target.value }))} type="number" min="1" className={inputClassName} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted">Max Users</label>
                            <input value={form.maxUsers} onChange={(e) => setForm((c) => ({ ...c, maxUsers: e.target.value }))} type="number" min="1" className={inputClassName} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted">Max Products</label>
                            <input value={form.maxProducts} onChange={(e) => setForm((c) => ({ ...c, maxProducts: e.target.value }))} type="number" min="1" className={inputClassName} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted">Max Invoices/Month</label>
                            <input value={form.maxInvoicesMonth} onChange={(e) => setForm((c) => ({ ...c, maxInvoicesMonth: e.target.value }))} type="number" min="1" className={inputClassName} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted">Max HS Codes</label>
                            <input value={form.maxHsCodesAccess} onChange={(e) => setForm((c) => ({ ...c, maxHsCodesAccess: e.target.value }))} type="number" min="1" className={inputClassName} placeholder="Unlimited if blank" />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted">Retention Days</label>
                            <input value={form.dataRetentionDays} onChange={(e) => setForm((c) => ({ ...c, dataRetentionDays: e.target.value }))} type="number" min="30" required className={inputClassName} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted">Trial Days</label>
                            <input value={form.trialDays} onChange={(e) => setForm((c) => ({ ...c, trialDays: e.target.value }))} type="number" min="0" max="90" required className={inputClassName} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted">Sort Order</label>
                            <input value={form.sortOrder} onChange={(e) => setForm((c) => ({ ...c, sortOrder: e.target.value }))} type="number" min="0" required className={inputClassName} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted">Currency</label>
                            <input value={form.currency} onChange={(e) => setForm((c) => ({ ...c, currency: e.target.value.toUpperCase() }))} maxLength={3} required className={inputClassName} />
                        </div>
                        <label className="flex items-center justify-between rounded-input border border-border bg-surface-subtle px-3 py-2.5 cursor-pointer">
                            <span className="text-sm text-ink">Plan is active</span>
                            <input checked={form.isActive} onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.checked }))} type="checkbox" className="h-4 w-4 rounded border-border accent-[#1A1A1A]" />
                        </label>
                        <label className="flex items-center justify-between rounded-input border border-border bg-surface-subtle px-3 py-2.5 cursor-pointer">
                            <span className="text-sm text-ink">Visible on public pricing</span>
                            <input checked={form.isPublic} onChange={(e) => setForm((c) => ({ ...c, isPublic: e.target.checked }))} type="checkbox" className="h-4 w-4 rounded border-border accent-[#1A1A1A]" />
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-border-muted pt-4">
                        <button type="button" onClick={resetForm}
                            className="rounded-full border border-border px-4 py-2 text-ui-xs font-medium text-ink hover:bg-surface transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={formLoading}
                            className="rounded-full bg-primary px-6 py-2 text-ui-xs font-medium text-white hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
                            {submitLabel}
                        </button>
                    </div>
                </form>
            )}

            {/* Plan cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-card shadow-card p-5 animate-pulse">
                            <div className="mb-3 h-5 w-24 rounded-full bg-border" />
                            <div className="h-3 w-16 rounded-full bg-border" />
                        </div>
                    ))
                    : plans.map((plan) => (
                        <div key={plan.id} className="bg-white rounded-card shadow-card border border-border-muted p-5">
                            {/* Card header */}
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="text-base font-semibold text-ink">{plan.name}</h3>
                                    <p className="mt-0.5 font-mono text-xs text-muted">{plan.slug}</p>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${plan.isActive ? 'bg-success-bg text-success' : 'bg-error-bg text-error'}`}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                    {plan.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>

                            <p className="mb-3 min-h-10 text-ui-xs text-muted">{plan.description}</p>

                            {/* Price */}
                            <p className="text-2xl font-semibold text-ink">
                                PKR {plan.monthlyPrice.toLocaleString()}
                                <span className="text-sm font-normal text-muted">/mo</span>
                            </p>
                            <p className="text-xs text-muted">PKR {plan.yearlyPrice.toLocaleString()} yearly</p>
                            <p className="mb-4 mt-0.5 text-xs font-medium text-success">
                                {plan._count?.tenantSubscriptions ?? 0} active subscribers
                            </p>

                            {/* Limits */}
                            <div className="mb-4 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border-muted pt-3 text-xs">
                                <span className="text-muted">POS: <span className="font-medium text-ink">{plan.maxPosTerminals ?? 'Unlimited'}</span></span>
                                <span className="text-muted">Users: <span className="font-medium text-ink">{plan.maxUsers ?? 'Unlimited'}</span></span>
                                <span className="text-muted">Products: <span className="font-medium text-ink">{plan.maxProducts ?? 'Unlimited'}</span></span>
                                <span className="text-muted">Invoices: <span className="font-medium text-ink">{plan.maxInvoicesMonth ?? 'Unlimited'}</span></span>
                            </div>

                            {/* Feature flags */}
                            {plan.features.length > 0 && (
                                <ul className="mb-4 space-y-1.5 border-t border-border-muted pt-3">
                                    {plan.features.map((f) => (
                                        <li key={f.key} className="flex justify-between text-xs">
                                            <span className="text-muted">{f.key}</span>
                                            <span className={`font-medium ${f.value === 'true' ? 'text-success' : f.value === 'false' ? 'text-muted' : 'text-ink'}`}>{f.value}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 border-t border-border-muted pt-3">
                                <button type="button" onClick={() => openEditForm(plan)}
                                    className="flex-1 rounded-full border border-border px-3 py-2 text-ui-xs font-medium text-ink hover:bg-surface transition-colors">
                                    Edit
                                </button>
                                <button type="button" onClick={() => handleTogglePlan(plan)} disabled={actionPlanId === plan.id}
                                    className={`flex-1 rounded-full px-3 py-2 text-ui-xs font-medium transition-colors disabled:opacity-60 ${plan.isActive
                                        ? 'bg-error-bg text-error hover:bg-error-border'
                                        : 'bg-success-bg text-success hover:bg-success-border'
                                        }`}>
                                    {actionPlanId === plan.id ? 'Saving...' : plan.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    )
}
