'use client'

import { useEffect, useState } from 'react'
import { CalendarClock, CreditCard, RefreshCw } from 'lucide-react'
import type { TenantSubscriptionDetail } from './EditTenantModal'

export interface PlanOption {
    id: string
    name: string
    monthlyPrice: number
    yearlyPrice: number
    isActive?: boolean
    trialDays?: number
}

interface SubscriptionManagerProps {
    tenantId: string
    subscription?: TenantSubscriptionDetail
    plans: PlanOption[]
    onChanged: (message: string) => Promise<void> | void
    onError: (message: string) => void
}

const STATUS_OPTIONS = ['ACTIVE', 'TRIALING', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'] as const
const PAYMENT_METHODS = ['BANK_TRANSFER', 'CASH', 'CARD', 'CHEQUE', 'JAZZCASH', 'EASYPAISA']

const STATUS_LABEL: Record<string, string> = {
    ACTIVE: 'Active',
    TRIALING: 'Trial',
    PAST_DUE: 'Expired',
    SUSPENDED: 'Suspended',
    CANCELLED: 'Cancelled',
}

const STATUS_STYLE: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    TRIALING: 'bg-sky-50 text-sky-700 border-sky-200',
    PAST_DUE: 'bg-rose-50 text-rose-700 border-rose-200',
    SUSPENDED: 'bg-amber-50 text-amber-700 border-amber-200',
    CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
}

const inputClass = 'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none'
const labelClass = 'mb-1 block text-xs font-medium text-muted'

function toDateInput(iso?: string | null) {
    return iso ? iso.slice(0, 10) : ''
}

function fromDateInput(value: string, endOfDay = false) {
    if (!value) return undefined
    return new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}`).toISOString()
}

function formatDate(iso?: string | null) {
    return iso ? new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

function daysLeft(iso?: string | null) {
    if (!iso) return null
    return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

export function SubscriptionStatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status] ?? STATUS_STYLE.CANCELLED}`}>
            {STATUS_LABEL[status] ?? status}
        </span>
    )
}

export function SubscriptionManager({ tenantId, subscription, plans, onChanged, onError }: SubscriptionManagerProps) {
    const [saving, setSaving] = useState<'' | 'save' | 'renew'>('')
    const [form, setForm] = useState({
        planId: '',
        billingCycle: 'MONTHLY' as 'MONTHLY' | 'YEARLY',
        status: 'ACTIVE' as string,
        currentPeriodStart: '',
        currentPeriodEnd: '',
        trialEndsAt: '',
    })
    const [renew, setRenew] = useState({
        cycles: 1,
        recordPayment: true,
        amount: '',
        paymentMethod: 'BANK_TRANSFER',
        paymentRef: '',
    })

    useEffect(() => {
        setForm({
            planId: subscription?.plan?.id ?? '',
            billingCycle: subscription?.billingCycle ?? 'MONTHLY',
            status: subscription?.status ?? 'ACTIVE',
            currentPeriodStart: toDateInput(subscription?.currentPeriodStart),
            currentPeriodEnd: toDateInput(subscription?.currentPeriodEnd),
            trialEndsAt: toDateInput(subscription?.trialEndsAt),
        })
    }, [subscription])

    const selectedPlan = plans.find((p) => p.id === (subscription?.plan?.id ?? form.planId))
    const cyclePrice = selectedPlan
        ? (form.billingCycle === 'YEARLY' ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice)
        : 0
    const suggestedAmount = cyclePrice * renew.cycles
    const effectiveStatus = subscription?.effectiveStatus ?? subscription?.status
    const remaining = daysLeft(subscription?.expiresAt ?? subscription?.currentPeriodEnd)

    async function saveSubscription(e: React.FormEvent) {
        e.preventDefault()
        if (!form.planId) {
            onError('Select a plan.')
            return
        }
        setSaving('save')
        try {
            const res = await fetch(`/api/admin/tenants/${tenantId}/subscription`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planId: form.planId,
                    billingCycle: form.billingCycle,
                    ...(subscription ? { status: form.status } : {}),
                    currentPeriodStart: fromDateInput(form.currentPeriodStart),
                    currentPeriodEnd: fromDateInput(form.currentPeriodEnd, true),
                    trialEndsAt: form.status === 'TRIALING' ? (fromDateInput(form.trialEndsAt, true) ?? null) : null,
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                onError(data.error || 'Failed to save subscription.')
                return
            }
            await onChanged(subscription ? 'Subscription updated.' : 'Subscription created.')
        } catch {
            onError('Network error while saving subscription.')
        } finally {
            setSaving('')
        }
    }

    async function renewSubscription() {
        setSaving('renew')
        try {
            const res = await fetch(`/api/admin/tenants/${tenantId}/subscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cycles: renew.cycles,
                    billingCycle: form.billingCycle,
                    recordPayment: renew.recordPayment,
                    ...(renew.recordPayment
                        ? {
                            amount: renew.amount === '' ? suggestedAmount : Number(renew.amount),
                            paymentMethod: renew.paymentMethod,
                            paymentRef: renew.paymentRef || undefined,
                        }
                        : {}),
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                onError(data.error || 'Failed to renew subscription.')
                return
            }
            setRenew((r) => ({ ...r, amount: '', paymentRef: '' }))
            await onChanged(renew.recordPayment ? 'Payment recorded and subscription renewed.' : 'Subscription renewed.')
        } catch {
            onError('Network error while renewing subscription.')
        } finally {
            setSaving('')
        }
    }

    return (
        <div className="mb-6 rounded-2xl border border-border bg-white p-6 shadow-xs">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                <div>
                    <h2 className="text-sm font-semibold text-ink">Subscription &amp; Billing</h2>
                    {subscription ? (
                        <p className="mt-1 text-sm text-muted">
                            <span className="font-semibold text-ink">{subscription.plan?.name}</span>
                            {' · '}{subscription.billingCycle === 'YEARLY' ? 'Yearly' : 'Monthly'}
                            {' · '}Expires <span className="font-medium text-ink">{formatDate(subscription.expiresAt ?? subscription.currentPeriodEnd)}</span>
                            {remaining !== null && (
                                <span className={remaining < 0 ? 'text-rose-600' : remaining <= 7 ? 'text-amber-600' : ''}>
                                    {' '}({remaining < 0 ? `${Math.abs(remaining)} days ago` : `${remaining} days left`})
                                </span>
                            )}
                        </p>
                    ) : (
                        <p className="mt-1 text-sm text-muted">No subscription. The tenant is on free-tier limits. Assign a plan below.</p>
                    )}
                </div>
                {effectiveStatus && <SubscriptionStatusBadge status={effectiveStatus} />}
            </div>

            {/* Plan, cycle, status and dates */}
            <form onSubmit={saveSubscription} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                    <label className={labelClass}>Plan</label>
                    <select
                        value={form.planId}
                        onChange={(e) => setForm((f) => ({ ...f, planId: e.target.value }))}
                        className={inputClass}
                    >
                        <option value="">Select plan</option>
                        {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                                {plan.name} — PKR {plan.monthlyPrice.toLocaleString()}/mo{plan.isActive === false ? ' (inactive)' : ''}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className={labelClass}>Billing cycle</label>
                    <select
                        value={form.billingCycle}
                        onChange={(e) => setForm((f) => ({ ...f, billingCycle: e.target.value as 'MONTHLY' | 'YEARLY' }))}
                        className={inputClass}
                    >
                        <option value="MONTHLY">Monthly</option>
                        <option value="YEARLY">Yearly</option>
                    </select>
                </div>
                {subscription && (
                    <div>
                        <label className={labelClass}>Status</label>
                        <select
                            value={form.status}
                            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                            className={inputClass}
                        >
                            {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                            ))}
                        </select>
                    </div>
                )}
                <div>
                    <label className={labelClass}>Period start</label>
                    <input
                        type="date"
                        value={form.currentPeriodStart}
                        onChange={(e) => setForm((f) => ({ ...f, currentPeriodStart: e.target.value }))}
                        className={inputClass}
                    />
                </div>
                <div>
                    <label className={labelClass}>Expiry date</label>
                    <input
                        type="date"
                        value={form.currentPeriodEnd}
                        onChange={(e) => setForm((f) => ({ ...f, currentPeriodEnd: e.target.value }))}
                        className={inputClass}
                    />
                </div>
                {form.status === 'TRIALING' && (
                    <div>
                        <label className={labelClass}>Trial ends</label>
                        <input
                            type="date"
                            value={form.trialEndsAt}
                            onChange={(e) => setForm((f) => ({ ...f, trialEndsAt: e.target.value }))}
                            className={inputClass}
                        />
                    </div>
                )}
                <div className="flex items-end sm:col-span-2 lg:col-span-3">
                    <button
                        type="submit"
                        disabled={saving !== ''}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                    >
                        <CalendarClock size={15} />
                        {saving === 'save' ? 'Saving...' : subscription ? 'Save changes' : 'Create subscription'}
                    </button>
                </div>
            </form>

            {/* Renew / record payment */}
            {subscription && (
                <div className="mt-6 rounded-xl border border-border bg-surface-subtle p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <RefreshCw size={15} className="text-primary" />
                        <h3 className="text-sm font-semibold text-ink">Renew subscription</h3>
                    </div>
                    <p className="mb-4 text-xs text-muted">
                        Extends the expiry by the selected number of {form.billingCycle === 'YEARLY' ? 'years' : 'months'} from the current expiry
                        (or from today if already expired) and reactivates an expired subscription.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                            <label className={labelClass}>{form.billingCycle === 'YEARLY' ? 'Years' : 'Months'}</label>
                            <input
                                type="number"
                                min={1}
                                max={36}
                                value={renew.cycles}
                                onChange={(e) => setRenew((r) => ({ ...r, cycles: Math.max(1, Number(e.target.value) || 1) }))}
                                className={inputClass}
                            />
                        </div>
                        <label className="flex items-end gap-2 pb-2 text-sm text-ink">
                            <input
                                type="checkbox"
                                checked={renew.recordPayment}
                                onChange={(e) => setRenew((r) => ({ ...r, recordPayment: e.target.checked }))}
                                className="h-4 w-4 accent-primary"
                            />
                            Record payment
                        </label>
                        {renew.recordPayment && (
                            <>
                                <div>
                                    <label className={labelClass}>Amount (PKR)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={renew.amount}
                                        placeholder={String(suggestedAmount)}
                                        onChange={(e) => setRenew((r) => ({ ...r, amount: e.target.value }))}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Method</label>
                                    <select
                                        value={renew.paymentMethod}
                                        onChange={(e) => setRenew((r) => ({ ...r, paymentMethod: e.target.value }))}
                                        className={inputClass}
                                    >
                                        {PAYMENT_METHODS.map((method) => (
                                            <option key={method} value={method}>{method.replace('_', ' ')}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className={labelClass}>Reference (optional)</label>
                                    <input
                                        type="text"
                                        value={renew.paymentRef}
                                        placeholder="Transaction / receipt no."
                                        onChange={(e) => setRenew((r) => ({ ...r, paymentRef: e.target.value }))}
                                        className={inputClass}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={renewSubscription}
                        disabled={saving !== ''}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
                    >
                        <CreditCard size={15} />
                        {saving === 'renew' ? 'Renewing...' : renew.recordPayment ? 'Record payment & renew' : 'Renew without payment'}
                    </button>
                </div>
            )}

            {/* Billing history */}
            {subscription && (
                <div className="mt-6">
                    <h3 className="mb-2 text-sm font-semibold text-ink">Billing history</h3>
                    {(subscription.billingHistory?.length ?? 0) === 0 ? (
                        <p className="text-xs text-muted">No payments recorded yet.</p>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-border">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-surface-subtle">
                                        <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">Date</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">Description</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">Period</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">Method</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-muted whitespace-nowrap">Amount</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subscription.billingHistory!.map((record) => (
                                        <tr key={record.id} className="border-b border-border last:border-0">
                                            <td className="px-3 py-2 text-xs text-muted">{formatDate(record.paidAt ?? record.createdAt)}</td>
                                            <td className="px-3 py-2 text-ink">{record.description}</td>
                                            <td className="px-3 py-2 text-xs text-muted">{formatDate(record.periodStart)} – {formatDate(record.periodEnd)}</td>
                                            <td className="px-3 py-2 text-xs text-muted">
                                                {record.paymentMethod?.replace('_', ' ') ?? '—'}
                                                {record.paymentRef ? ` · ${record.paymentRef}` : ''}
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium tabular-nums text-ink">PKR {record.amount.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-xs font-medium text-ink">{record.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
