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

const inputClassName = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50'

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
                    <h1 className="text-2xl font-bold text-white">Subscription Plans</h1>
                    <p className="text-slate-400 text-sm mt-1">Manage pricing tiers and feature entitlements</p>
                </div>
                <button
                    onClick={() => (showForm && !editingPlanId ? resetForm() : openCreateForm())}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                    {showForm && !editingPlanId ? 'Cancel' : '+ New Plan'}
                </button>
            </div>

            {error && !showForm && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg p-3 mb-6">
                    {error}
                </div>
            )}

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg p-3 mb-4">
                            {error}
                        </div>
                    )}
                    <h2 className="text-sm font-semibold text-white mb-4">{formTitle}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Plan Name</label>
                            <input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} required className={inputClassName} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Slug</label>
                            <input value={form.slug} onChange={(e) => setForm((current) => ({ ...current, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} required className={inputClassName} placeholder="e.g. starter" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Monthly Price (PKR)</label>
                            <input value={form.monthlyPrice} onChange={(e) => setForm((current) => ({ ...current, monthlyPrice: e.target.value }))} type="number" step="0.01" min="0" required className={inputClassName} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Yearly Price (PKR)</label>
                            <input value={form.yearlyPrice} onChange={(e) => setForm((current) => ({ ...current, yearlyPrice: e.target.value }))} type="number" step="0.01" min="0" required className={inputClassName} />
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
                        <textarea value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} required rows={3} className={`${inputClassName} resize-none`} placeholder="Short summary of what this plan includes" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Max POS Terminals</label>
                            <input value={form.maxPosTerminals} onChange={(e) => setForm((current) => ({ ...current, maxPosTerminals: e.target.value }))} type="number" min="1" className={inputClassName} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Max Users</label>
                            <input value={form.maxUsers} onChange={(e) => setForm((current) => ({ ...current, maxUsers: e.target.value }))} type="number" min="1" className={inputClassName} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Max Products</label>
                            <input value={form.maxProducts} onChange={(e) => setForm((current) => ({ ...current, maxProducts: e.target.value }))} type="number" min="1" className={inputClassName} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Max Invoices/Month</label>
                            <input value={form.maxInvoicesMonth} onChange={(e) => setForm((current) => ({ ...current, maxInvoicesMonth: e.target.value }))} type="number" min="1" className={inputClassName} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Max HS Codes</label>
                            <input value={form.maxHsCodesAccess} onChange={(e) => setForm((current) => ({ ...current, maxHsCodesAccess: e.target.value }))} type="number" min="1" className={inputClassName} placeholder="Unlimited if blank" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Retention Days</label>
                            <input value={form.dataRetentionDays} onChange={(e) => setForm((current) => ({ ...current, dataRetentionDays: e.target.value }))} type="number" min="30" required className={inputClassName} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Trial Days</label>
                            <input value={form.trialDays} onChange={(e) => setForm((current) => ({ ...current, trialDays: e.target.value }))} type="number" min="0" max="90" required className={inputClassName} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Sort Order</label>
                            <input value={form.sortOrder} onChange={(e) => setForm((current) => ({ ...current, sortOrder: e.target.value }))} type="number" min="0" required className={inputClassName} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Currency</label>
                            <input value={form.currency} onChange={(e) => setForm((current) => ({ ...current, currency: e.target.value.toUpperCase() }))} maxLength={3} required className={inputClassName} />
                        </div>
                        <label className="flex items-center justify-between bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-300">
                            <span>Plan is active</span>
                            <input checked={form.isActive} onChange={(e) => setForm((current) => ({ ...current, isActive: e.target.checked }))} type="checkbox" className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500/50" />
                        </label>
                        <label className="flex items-center justify-between bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-300">
                            <span>Visible on public pricing</span>
                            <input checked={form.isPublic} onChange={(e) => setForm((current) => ({ ...current, isPublic: e.target.checked }))} type="checkbox" className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500/50" />
                        </label>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">Cancel</button>
                        <button
                            type="submit"
                            disabled={formLoading}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            {submitLabel}
                        </button>
                    </div>
                </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse">
                            <div className="h-6 bg-slate-800 rounded w-24 mb-3" />
                            <div className="h-4 bg-slate-800 rounded w-16" />
                        </div>
                    ))
                    : plans.map((plan) => (
                        <div key={plan.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="text-base font-bold text-white">{plan.name}</h3>
                                    <p className="text-xs text-slate-600 font-mono mt-0.5">{plan.slug}</p>
                                </div>
                                <span
                                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${plan.isActive
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : 'bg-red-500/10 text-red-400'
                                        }`}
                                >
                                    {plan.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <p className="text-sm text-slate-400 mb-3 min-h-10">{plan.description}</p>
                            <p className="text-2xl font-bold text-indigo-400 mb-1">
                                {plan.currency} {plan.monthlyPrice.toLocaleString()}
                                <span className="text-sm font-normal text-slate-500">/mo</span>
                            </p>
                            <p className="text-xs text-slate-500 mb-1">
                                {plan.currency} {plan.yearlyPrice.toLocaleString()} yearly
                            </p>
                            <p className="text-xs text-slate-500 mb-4">
                                {plan._count?.tenantSubscriptions ?? 0} active subscribers
                            </p>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500 mb-4 border-t border-slate-800 pt-3">
                                <span>POS: <span className="text-slate-300">{plan.maxPosTerminals ?? 'Unlimited'}</span></span>
                                <span>Users: <span className="text-slate-300">{plan.maxUsers ?? 'Unlimited'}</span></span>
                                <span>Products: <span className="text-slate-300">{plan.maxProducts ?? 'Unlimited'}</span></span>
                                <span>Invoices: <span className="text-slate-300">{plan.maxInvoicesMonth ?? 'Unlimited'}</span></span>
                            </div>
                            {plan.features.length > 0 && (
                                <ul className="space-y-1 border-t border-slate-800 pt-3 mb-4">
                                    {plan.features.map((f) => (
                                        <li key={f.key} className="text-xs text-slate-500 flex justify-between">
                                            <span>{f.key}</span>
                                            <span className="text-slate-300">{f.value}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="flex gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => openEditForm(plan)}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleTogglePlan(plan)}
                                    disabled={actionPlanId === plan.id}
                                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${plan.isActive
                                        ? 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300'
                                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300'
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
