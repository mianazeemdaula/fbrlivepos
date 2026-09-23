'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Edit2, Shield, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import { EditTenantModal, type TenantDetail } from './EditTenantModal'
import { SubscriptionManager, type PlanOption } from './SubscriptionManager'

function TenantDetailContent() {
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()

    const [tenant, setTenant] = useState<TenantDetail | null>(null)
    const [plans, setPlans] = useState<PlanOption[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState('')
    const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({})
    const [passwordLoadingFor, setPasswordLoadingFor] = useState<string | null>(null)
    const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Edit modal states
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editModalTab, setEditModalTab] = useState<'general' | 'tax'>('general')
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

    useEffect(() => {
        async function load() {
            try {
                const [tenantRes, plansRes] = await Promise.all([
                    fetch(`/api/admin/tenants/${params.tenantId}`),
                    fetch('/api/admin/subscriptions'),
                ])
                if (tenantRes.ok) {
                    const data = await tenantRes.json()
                    setTenant(data.tenant)
                }
                if (plansRes.ok) {
                    const data = await plansRes.json()
                    setPlans(data.plans || [])
                }
            } catch {
                // Ignore
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [params.tenantId])

    // Check query params to auto-open edit modal if requested
    useEffect(() => {
        if (!loading && tenant) {
            const edit = searchParams.get('edit')
            const tab = searchParams.get('tab')
            if (edit === 'true' || tab === 'tax') {
                setEditModalTab(tab === 'tax' ? 'tax' : 'general')
                setIsEditModalOpen(true)
            }
        }
    }, [loading, tenant, searchParams])

    function openEditModal(tab: 'general' | 'tax' = 'general') {
        setEditModalTab(tab)
        setIsEditModalOpen(true)
    }

    function handleSaveSuccess(updatedTenant: TenantDetail) {
        setTenant(updatedTenant)
        setNotification({
            type: 'success',
            message: `Tenant "${updatedTenant.businessName}" details updated successfully.`,
        })
        setTimeout(() => setNotification(null), 5000)
    }

    async function handleSuspend() {
        setActionLoading('suspend')
        try {
            const res = await fetch(`/api/admin/tenants/${params.tenantId}/suspend`, { method: 'POST' })
            if (res.ok) {
                await reloadTenant('Tenant suspended successfully.')
            }
        } catch {
            setNotification({ type: 'error', message: 'Failed to suspend tenant.' })
        } finally {
            setActionLoading('')
        }
    }

    async function handleActivate() {
        setActionLoading('activate')
        try {
            const res = await fetch(`/api/admin/tenants/${params.tenantId}/activate`, { method: 'POST' })
            if (res.ok) {
                await reloadTenant('Tenant activated successfully.')
            }
        } catch {
            setNotification({ type: 'error', message: 'Failed to activate tenant.' })
        } finally {
            setActionLoading('')
        }
    }

    async function reloadTenant(message: string) {
        const res = await fetch(`/api/admin/tenants/${params.tenantId}`)
        if (res.ok) {
            const data = await res.json()
            setTenant(data.tenant)
        }
        setNotification({ type: 'success', message })
    }

    async function handleImpersonate() {
        setActionLoading('impersonate')
        try {
            const res = await fetch(`/api/admin/tenants/${params.tenantId}/impersonate`, { method: 'POST' })
            if (res.ok) {
                const data = await res.json()
                window.open(`/dashboard?impersonate=${data.token}`, '_blank')
            }
        } catch {
            setNotification({ type: 'error', message: 'Failed to impersonate tenant.' })
        } finally {
            setActionLoading('')
        }
    }

    async function handleChangeUserPassword(userId: string, userName: string) {
        const nextPassword = passwordDrafts[userId]?.trim() ?? ''
        if (nextPassword.length < 8) {
            setPasswordMessage({ type: 'error', text: `Password for ${userName} must be at least 8 characters.` })
            return
        }

        setPasswordMessage(null)
        setPasswordLoadingFor(userId)
        try {
            const res = await fetch(`/api/admin/tenants/${params.tenantId}/users/${userId}/password`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: nextPassword }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({ error: 'Failed to change password.' }))
                setPasswordMessage({ type: 'error', text: data.error || 'Failed to change password.' })
                return
            }

            setPasswordDrafts((current) => ({ ...current, [userId]: '' }))
            setPasswordMessage({ type: 'success', text: `Password updated for ${userName}.` })
        } catch {
            setPasswordMessage({ type: 'error', text: 'Network error while changing password.' })
        } finally {
            setPasswordLoadingFor(null)
        }
    }

    if (loading) {
        return (
            <div className="p-8 max-w-5xl mx-auto">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-48 rounded bg-border" />
                    <div className="h-20 rounded-2xl bg-border" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="h-20 rounded-xl bg-border" />
                        <div className="h-20 rounded-xl bg-border" />
                        <div className="h-20 rounded-xl bg-border" />
                        <div className="h-20 rounded-xl bg-border" />
                    </div>
                    <div className="h-64 rounded-2xl bg-border" />
                </div>
            </div>
        )
    }

    if (!tenant) {
        return (
            <div className="p-8 max-w-5xl mx-auto text-center">
                <p className="text-muted text-sm mb-4">Tenant not found.</p>
                <button
                    onClick={() => router.push('/super-admin/tenants')}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-surface transition-colors"
                >
                    <ArrowLeft size={14} />
                    Back to Tenants
                </button>
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto p-6 md:p-8">
            {/* Back Button */}
            <button
                onClick={() => router.push('/super-admin/tenants')}
                className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
            >
                <ArrowLeft size={14} />
                Back to Tenants
            </button>

            {/* Notification Banner */}
            {notification && (
                <div
                    className={`mb-6 p-4 rounded-2xl border text-sm font-medium flex items-center justify-between animate-in fade-in duration-200 ${
                        notification.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-700'
                    }`}
                >
                    <div className="flex items-center gap-2.5">
                        {notification.type === 'success' ? (
                            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                        ) : (
                            <AlertCircle size={18} className="shrink-0 text-rose-600" />
                        )}
                        <span>{notification.message}</span>
                    </div>
                    <button
                        onClick={() => setNotification(null)}
                        className="text-xs hover:underline opacity-80 hover:opacity-100"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8 bg-white rounded-2xl border border-border p-6 shadow-xs">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Tenant</span>
                        {tenant.slug && (
                            <span className="font-mono text-xs text-muted bg-surface px-2 py-0.5 rounded-md border border-border">
                                {tenant.slug}
                            </span>
                        )}
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold text-ink">{tenant.businessName}</h1>
                    <p className="mt-1 text-sm text-muted">{tenant.email}</p>
                </div>

                <div className="flex items-center gap-3 self-start">
                    <span
                        className={`text-xs px-3 py-1 rounded-full font-semibold border ${
                            tenant.isActive
                                ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-700 border-rose-500/20'
                        }`}
                    >
                        {tenant.isActive ? 'Active' : 'Suspended'}
                    </span>
                    <button
                        onClick={() => openEditModal('general')}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary hover:bg-primary-dark text-white px-4 py-1.5 text-xs font-semibold transition-colors shadow-xs"
                    >
                        <Edit2 size={13} />
                        Edit Details
                    </button>
                </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <InfoCard label="Invoices" value={String(tenant._count?.invoices ?? 0)} />
                <InfoCard label="Users" value={String(tenant._count?.users ?? 0)} />
                <InfoCard label="Products" value={String(tenant._count?.products ?? 0)} />
                <InfoCard
                    label="PRAL DI"
                    value={tenant.diConfigured ? 'Configured' : 'Not Set'}
                    accent={tenant.diConfigured ? 'emerald' : 'amber'}
                />
            </div>

            {/* Business Details Card */}
            <div className="bg-white rounded-2xl border border-border mb-6 p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                    <h2 className="text-sm font-semibold text-ink">Business Details</h2>
                    <button
                        onClick={() => openEditModal('general')}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary transition-colors"
                    >
                        <Edit2 size={13} />
                        Edit
                    </button>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
                    <div>
                        <dt className="text-xs text-muted">Business Name</dt>
                        <dd className="mt-0.5 text-sm font-medium text-ink">{tenant.businessName}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted">Tenant Slug</dt>
                        <dd className="mt-0.5 font-mono text-sm text-ink">{tenant.slug || '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted">Primary Email</dt>
                        <dd className="mt-0.5 text-sm text-ink">{tenant.email}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted">Phone Number</dt>
                        <dd className="mt-0.5 text-sm text-ink">{tenant.phone || '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted">Default Buyer ID Type</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-ink">{tenant.preferredIdType || 'NTN'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted">Joined Date</dt>
                        <dd className="mt-0.5 text-sm text-ink">{new Date(tenant.createdAt).toLocaleDateString()}</dd>
                    </div>
                    <div className="sm:col-span-2 md:col-span-3">
                        <dt className="text-xs text-muted">Physical Address</dt>
                        <dd className="mt-0.5 text-sm text-ink">{tenant.address || '—'}</dd>
                    </div>
                </dl>
            </div>

            {/* Tax & FBR DI Profile Card */}
            <div className="bg-white rounded-2xl border border-border mb-6 p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Shield size={16} className="text-primary" />
                        <h2 className="text-sm font-semibold text-ink">Tax & FBR Profile</h2>
                    </div>
                    <button
                        onClick={() => openEditModal('tax')}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary transition-colors"
                    >
                        <Edit2 size={13} />
                        Edit Tax Profile
                    </button>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
                    <div>
                        <dt className="text-xs text-muted">Seller NTN</dt>
                        <dd className="mt-0.5 font-mono text-sm font-medium text-ink">
                            {tenant.diCredentials?.sellerNTN || tenant.ntn || '—'}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted">Seller CNIC</dt>
                        <dd className="mt-0.5 font-mono text-sm text-ink">{tenant.diCredentials?.sellerCNIC || '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted">Registered Name (IRIS)</dt>
                        <dd className="mt-0.5 text-sm text-ink">{tenant.diCredentials?.sellerBusinessName || '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted">Registered Province</dt>
                        <dd className="mt-0.5 text-sm text-ink">{tenant.diCredentials?.sellerProvince || '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted">Business Activity</dt>
                        <dd className="mt-0.5 text-sm text-ink">{tenant.diCredentials?.businessActivity || '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted">Sector</dt>
                        <dd className="mt-0.5 text-sm text-ink">{tenant.diCredentials?.sector || '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted">Environment</dt>
                        <dd className="mt-0.5 text-sm font-medium text-ink">
                            <span
                                className={`text-xs px-2 py-0.5 rounded-md font-semibold ${
                                    tenant.diCredentials?.environment === 'PRODUCTION'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                            >
                                {tenant.diCredentials?.environment || 'SANDBOX'}
                            </span>
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted">Production Ready</dt>
                        <dd className="mt-0.5 text-sm text-ink">
                            {tenant.diCredentials?.isProductionReady ? (
                                <span className="text-xs font-semibold text-emerald-600">Yes</span>
                            ) : (
                                <span className="text-xs text-muted">No</span>
                            )}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted">IRIS Status</dt>
                        <dd className="mt-0.5 text-sm text-ink">{tenant.diCredentials?.irisRegistrationStatus || 'PENDING'}</dd>
                    </div>
                    <div className="sm:col-span-2 md:col-span-3">
                        <dt className="text-xs text-muted">Registered Tax Address</dt>
                        <dd className="mt-0.5 text-sm text-ink">{tenant.diCredentials?.sellerAddress || '—'}</dd>
                    </div>
                </dl>
            </div>

            {/* Subscription Card */}
            <SubscriptionManager
                tenantId={String(params.tenantId)}
                subscription={tenant.subscription}
                plans={plans}
                onChanged={reloadTenant}
                onError={(message) => setNotification({ type: 'error', message })}
            />

            {/* Actions Card */}
            <div className="bg-white rounded-2xl border border-border mb-6 p-6 shadow-xs">
                <h2 className="text-sm font-semibold text-ink mb-4">Actions</h2>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => openEditModal('general')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-surface transition-colors"
                    >
                        <Edit2 size={14} />
                        Edit Tenant Details
                    </button>
                    <button
                        onClick={handleImpersonate}
                        disabled={!!actionLoading}
                        className="bg-primary hover:bg-primary-dark disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    >
                        {actionLoading === 'impersonate' ? 'Loading...' : 'Impersonate'}
                    </button>
                    {tenant.isActive ? (
                        <button
                            onClick={handleSuspend}
                            disabled={!!actionLoading}
                            className="bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                        >
                            {actionLoading === 'suspend' ? 'Suspending...' : 'Suspend Tenant'}
                        </button>
                    ) : (
                        <button
                            onClick={handleActivate}
                            disabled={!!actionLoading}
                            className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                        >
                            {actionLoading === 'activate' ? 'Activating...' : 'Activate Tenant'}
                        </button>
                    )}
                </div>
            </div>

            {/* User Password Management */}
            <div className="bg-white rounded-2xl border border-border p-6 shadow-xs">
                <h2 className="text-sm font-semibold text-ink mb-1">User Password Management</h2>
                <p className="mb-4 text-xs text-muted">Set a new password for any user under this tenant.</p>

                {passwordMessage && (
                    <div
                        className={`mb-4 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
                            passwordMessage.type === 'success'
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                                : 'border-rose-500/30 bg-rose-500/10 text-rose-700'
                        }`}
                    >
                        {passwordMessage.text}
                    </div>
                )}

                <div className="space-y-3">
                    {(tenant.users ?? []).map((user) => (
                        <div key={user.id} className="rounded-xl border border-border bg-surface-subtle p-3.5">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold text-ink">{user.name}</p>
                                    <p className="text-xs text-muted">
                                        {user.email} · <span className="font-medium text-ink">{user.role}</span>
                                    </p>
                                </div>
                                <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                        user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                    }`}
                                >
                                    {user.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    type="password"
                                    value={passwordDrafts[user.id] ?? ''}
                                    onChange={(e) =>
                                        setPasswordDrafts((current) => ({ ...current, [user.id]: e.target.value }))
                                    }
                                    placeholder="New password (min 8 chars)"
                                    className="w-full min-w-55 flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-primary"
                                />
                                <button
                                    onClick={() => handleChangeUserPassword(user.id, user.name)}
                                    disabled={passwordLoadingFor !== null}
                                    className="rounded-lg bg-ink hover:bg-black text-white px-3.5 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {passwordLoadingFor === user.id ? 'Updating...' : 'Set Password'}
                                </button>
                            </div>
                        </div>
                    ))}
                    {(tenant.users?.length ?? 0) === 0 && (
                        <p className="text-xs text-muted">No users found for this tenant.</p>
                    )}
                </div>
            </div>

            {/* Edit Tenant Modal */}
            <EditTenantModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                tenant={tenant}
                initialTab={editModalTab}
                onSaveSuccess={handleSaveSuccess}
            />
        </div>
    )
}

export default function TenantDetailPage() {
    return (
        <Suspense
            fallback={
                <div className="p-8 max-w-5xl mx-auto">
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 w-48 rounded bg-border" />
                        <div className="h-64 rounded-2xl bg-border" />
                    </div>
                </div>
            }
        >
            <TenantDetailContent />
        </Suspense>
    )
}

function InfoCard({
    label,
    value,
    accent,
}: {
    label: string
    value: string
    accent?: 'emerald' | 'amber'
}) {
    return (
        <div className="bg-white border border-border rounded-2xl p-4 shadow-xs">
            <p className="text-xs text-muted mb-1 font-medium">{label}</p>
            <p
                className={`text-xl font-bold ${
                    accent === 'emerald'
                        ? 'text-emerald-600'
                        : accent === 'amber'
                        ? 'text-amber-600'
                        : 'text-ink'
                }`}
            >
                {value}
            </p>
        </div>
    )
}
