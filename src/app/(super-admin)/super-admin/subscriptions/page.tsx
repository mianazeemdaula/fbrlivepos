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

const inputClassName = 'w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white placeholder:text-[#8d897d] focus:outline-none focus:ring-2 focus:ring-[#f0d9a0]/30'

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
            const res = await fetch(editingPlanId ? `/api/admin/subscriptions/${editingPlanId}` : '/api/admin/subscriptions', {
                method: editingPlanId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name.trim(),
                    slug: form.slug.trim(),
                    description: form.description.trim(),
                    priceMonthly: Number.parseFloat(form.monthlyPrice),
                    priceYearly: Number.parseFloat(form.yearlyPrice),
                    currency: form.currency.trim().toUpperCase(),
                    maxPosTerminals: parseNullableInteger(form.maxPosTerminals),
                    maxUsers: parseNullableInteger(form.maxUsers),
                    maxProducts: parseNullableInteger(form.maxProducts),
                    maxInvoicesMonth: parseNullableInteger(form.maxInvoicesMonth),
                    maxHsCodesAccess: parseNullableInteger(form.maxHsCodesAccess),
                    dataRetentionDays: Number.parseInt(form.dataRetentionDays, 10),
                    trialDays: Number.parseInt(form.trialDays, 10),
                    sortOrder: Number.parseInt(form.sortOrder, 10),
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
            <div className="flex items-start justify-between mb-8">
                <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Packages</p>
                    <h1 className="brand-heading text-3xl font-bold text-white">Subscription Plans</h1>
                    <p className="mt-1 text-sm text-[#c1bcaf]">Manage pricing tiers and feature entitlements</p>
                </div>
                <button
                    onClick={() => (showForm && !editingPlanId ? resetForm() : openCreateForm())}
                    className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--accent-soft)]"
                >
                    {showForm && !editingPlanId ? 'Cancel' : '+ New Plan'}
                </button>
            </div>

            {error && !showForm && (
                <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                    {error}
                </div>
            )}

            {showForm && (
                <form onSubmit={handleSubmit} className="app-panel mb-6 rounded-2xl p-6">
                    {error && (
                        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                            {error}
                        </div>
                    )}
                    <h2 className="text-sm font-semibold text-white mb-4">{formTitle}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-[#c1bcaf]">Plan Name</label>
                            <input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} required className={inputClassName} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-[#c1bcaf]">Slug</label>
                            <input value={form.slug} onChange={(e) => setForm((current) => ({ ...current, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} required className={inputClassName} placeholder="e.g. starter" />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-[#c1bcaf]">Monthly Price (PKR)</label>
                            <input value={form.monthlyPrice} onChange={(e) => setForm((current) => ({ ...current, monthlyPrice: e.target.value }))} type="number" step="0.01" min="0" required className={inputClassName} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-[#c1bcaf]">Yearly Price (PKR)</label>
                            <input value={form.yearlyPrice} onChange={(e) => setForm((current) => ({ ...current, yearlyPrice: e.target.value }))} type="number" step="0.01" min="0" required className={inputClassName} />
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="mb-1.5 block text-xs font-medium text-[#c1bcaf]">Description</label>
                        <textarea value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} required rows={3} className={`${inputClassName} resize-none`} placeholder="Short summary of what this plan includes" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-[#c1bcaf]">Max POS Terminals</label>
                            <input value={form.maxPosTerminals} onChange={(e) => setForm((current) => ({ ...current, maxPosTerminals: e.target.value }))} type="number" min="1" className={inputClassName} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-[#c1bcaf]">Max Users</label>
                            <input value={form.maxUsers} onChange={(e) => setForm((current) => ({ ...current, maxUsers: e.target.value }))} type="number" min="1" className={inputClassName} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-[#c1bcaf]">Max Products</label>
                            <input value={form.maxProducts} onChange={(e) => setForm((current) => ({ ...current, maxProducts: e.target.value }))} type="number" min="1" className={inputClassName} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-[#c1bcaf]">Max Invoices/Month</label>
                            <input value={form.maxInvoicesMonth} onChange={(e) => setForm((current) => ({ ...current, maxInvoicesMonth: e.target.value }))} type="number" min="1" className={inputClassName} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-[#c1bcaf]">Max HS Codes</label>
                            <input value={form.maxHsCodesAccess} onChange={(e) => setForm((current) => ({ ...current, maxHsCodesAccess: e.target.value }))} type="number" min="1" className={inputClassName} placeholder="Unlimited if blank" />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-[#c1bcaf]">Retention Days</label>
                            <input value={form.dataRetentionDays} onChange={(e) => setForm((current) => ({ ...current, dataRetentionDays: e.target.value }))} type="number" min="30" required className={inputClassName} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-[#c1bcaf]">Trial Days</label>
                            <input value={form.trialDays} onChange={(e) => setForm((current) => ({ ...current, trialDays: e.target.value }))} type="number" min="0" max="90" required className={inputClassName} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-[#c1bcaf]">Sort Order</label>
                            <input value={form.sortOrder} onChange={(e) => setForm((current) => ({ ...current, sortOrder: e.target.value }))} type="number" min="0" required className={inputClassName} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-[#c1bcaf]">Currency</label>
                            <input value={form.currency} onChange={(e) => setForm((current) => ({ ...current, currency: e.target.value.toUpperCase() }))} maxLength={3} required className={inputClassName} />
                        </div>
                        <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-[#d8d0bf]">
                            <span>Plan is active</span>
                            <input checked={form.isActive} onChange={(e) => setForm((current) => ({ ...current, isActive: e.target.checked }))} type="checkbox" className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500/50" />
                        </label>
                        <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-[#d8d0bf]">
                            <span>Visible on public pricing</span>
                            <input checked={form.isPublic} onChange={(e) => setForm((current) => ({ ...current, isPublic: e.target.checked }))} type="checkbox" className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500/50" />
                        </label>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={resetForm} className="rounded-lg px-4 py-2 text-sm text-[#c1bcaf] transition-colors hover:bg-white/6 hover:text-white">Cancel</button>
                        <button
                            type="submit"
                            disabled={formLoading}
                            className="rounded-full bg-[var(--accent)] px-6 py-2 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {submitLabel}
                        </button>
                    </div>
                </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="app-panel rounded-2xl p-5 animate-pulse">
                            <div className="mb-3 h-6 w-24 rounded bg-white/10" />
                            <div className="h-4 w-16 rounded bg-white/10" />
                        </div>
                    ))
                    : plans.map((plan) => (
                        <div key={plan.id} className="app-panel rounded-2xl p-5">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="text-base font-bold text-white">{plan.name}</h3>
                                    <p className="mt-0.5 font-mono text-xs text-[#8d897d]">{plan.slug}</p>
                                </div>
                                <span
                                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${plan.isActive
                                        ? 'bg-emerald-500/10 text-emerald-300'
                                        : 'bg-red-500/10 text-red-300'
                                        }`}
                                >
                                    {plan.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <p className="mb-3 min-h-10 text-sm text-[#c1bcaf]">{plan.description}</p>
                            <p className="mb-1 text-2xl font-bold text-[#f0d9a0]">
                                {plan.currency} {plan.monthlyPrice.toLocaleString()}
                                <span className="text-sm font-normal text-[#8d897d]">/mo</span>
                            </p>
                            <p className="mb-1 text-xs text-[#8d897d]">
                                {plan.currency} {plan.yearlyPrice.toLocaleString()} yearly
                            </p>
                            <p className="mb-4 text-xs text-[#8d897d]">
                                {plan._count?.tenantSubscriptions ?? 0} active subscribers
                            </p>
                            <div className="mb-4 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-white/10 pt-3 text-xs text-[#8d897d]">
                                <span>POS: <span className="text-[#e7e0cf]">{plan.maxPosTerminals ?? 'Unlimited'}</span></span>
                                <span>Users: <span className="text-[#e7e0cf]">{plan.maxUsers ?? 'Unlimited'}</span></span>
                                <span>Products: <span className="text-[#e7e0cf]">{plan.maxProducts ?? 'Unlimited'}</span></span>
                                <span>Invoices: <span className="text-[#e7e0cf]">{plan.maxInvoicesMonth ?? 'Unlimited'}</span></span>
                            </div>
                            {plan.features.length > 0 && (
                                <ul className="mb-4 space-y-1 border-t border-white/10 pt-3">
                                    {plan.features.map((f) => (
                                        <li key={f.key} className="flex justify-between text-xs text-[#8d897d]">
                                            <span>{f.key}</span>
                                            <span className="text-[#e7e0cf]">{f.value}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="flex gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => openEditForm(plan)}
                                    className="flex-1 rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm font-medium text-[#f6f0e4] transition-colors hover:bg-white/10"
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleTogglePlan(plan)}
                                    disabled={actionPlanId === plan.id}
                                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${plan.isActive
                                        ? 'border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                                        : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                                        }`}
                                >
                                    {actionPlanId === plan.id ? 'Saving...' : plan.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    )
}
