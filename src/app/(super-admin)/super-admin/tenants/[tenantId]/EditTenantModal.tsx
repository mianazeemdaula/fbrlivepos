'use client'

import { useState, useEffect } from 'react'
import { X, AlertCircle, Building2, Shield, Loader2, Check } from 'lucide-react'

export interface TenantDetail {
    id: string
    businessName: string
    name?: string
    slug?: string
    email: string
    phone: string | null
    ntn: string | null
    address: string | null
    preferredIdType?: 'NTN' | 'CNIC' | string | null
    isActive: boolean
    diConfigured: boolean
    diCredentials?: {
        sellerNTN?: string
        sellerCNIC?: string | null
        sellerBusinessName?: string
        sellerProvince?: string
        sellerAddress?: string
        businessActivity?: string
        sector?: string
        environment?: 'SANDBOX' | 'PRODUCTION'
        isProductionReady?: boolean
        irisRegistrationStatus?: string
        lastVerifiedAt?: string | null
    } | null
    createdAt: string
    subscription?: {
        plan?: { id: string; name: string }
        status: string
        currentPeriodEnd: string | null
    }
    users?: Array<{
        id: string
        name: string
        email: string
        role: string
        isActive: boolean
        createdAt: string
    }>
    _count?: { invoices: number; users: number; products: number }
}

const PROVINCES = [
    'PUNJAB',
    'SINDH',
    'KPK',
    'BALOCHISTAN',
    'ISLAMABAD',
    'AJK',
    'GILGIT-BALTISTAN',
]

const BUSINESS_ACTIVITIES = [
    'Manufacturer',
    'Importer',
    'Distributor',
    'Wholesaler',
    'Exporter',
    'Retailer',
    'Service Provider',
    'Other',
]

const SECTORS = [
    'All Other Sectors',
    'Steel',
    'FMCG',
    'Textile',
    'Telecom',
    'Petroleum',
    'Electricity Distribution',
    'Gas Distribution',
    'Services',
    'Automobile',
    'CNG Stations',
    'Pharmaceuticals',
    'Wholesale / Retail',
]

interface EditTenantModalProps {
    isOpen: boolean
    onClose: () => void
    tenant: TenantDetail
    initialTab?: 'general' | 'tax'
    onSaveSuccess: (updatedTenant: TenantDetail) => void
}

export function EditTenantModal({
    isOpen,
    onClose,
    tenant,
    initialTab = 'general',
    onSaveSuccess,
}: EditTenantModalProps) {
    const [activeTab, setActiveTab] = useState<'general' | 'tax'>(initialTab)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Form fields
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        email: '',
        phone: '',
        address: '',
        preferredIdType: 'NTN' as 'NTN' | 'CNIC',
        isActive: true,
        // Tax / DI fields
        sellerNTN: '',
        sellerCNIC: '',
        sellerBusinessName: '',
        sellerProvince: 'PUNJAB',
        sellerAddress: '',
        businessActivity: 'Manufacturer',
        sector: 'All Other Sectors',
        environment: 'SANDBOX' as 'SANDBOX' | 'PRODUCTION',
        isProductionReady: false,
    })

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab)
            setError(null)
            setFormData({
                name: tenant.businessName || tenant.name || '',
                slug: tenant.slug || '',
                email: tenant.email || '',
                phone: tenant.phone || '',
                address: tenant.address || '',
                preferredIdType: (tenant.preferredIdType as 'NTN' | 'CNIC') || 'NTN',
                isActive: tenant.isActive,
                sellerNTN: tenant.diCredentials?.sellerNTN || tenant.ntn || '',
                sellerCNIC: tenant.diCredentials?.sellerCNIC || '',
                sellerBusinessName: tenant.diCredentials?.sellerBusinessName || tenant.businessName || '',
                sellerProvince: tenant.diCredentials?.sellerProvince || 'PUNJAB',
                sellerAddress: tenant.diCredentials?.sellerAddress || tenant.address || '',
                businessActivity: tenant.diCredentials?.businessActivity || 'Manufacturer',
                sector: tenant.diCredentials?.sector || 'All Other Sectors',
                environment: tenant.diCredentials?.environment || 'SANDBOX',
                isProductionReady: tenant.diCredentials?.isProductionReady || false,
            })
        }
    }, [isOpen, initialTab, tenant])

    if (!isOpen) return null

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSaving(true)

        try {
            const payload: Record<string, any> = {
                name: formData.name.trim(),
                slug: formData.slug.trim().toLowerCase(),
                email: formData.email.trim(),
                phone: formData.phone.trim() || null,
                address: formData.address.trim() || null,
                preferredIdType: formData.preferredIdType,
                isActive: formData.isActive,
            }

            // Include DI fields if any are filled out
            if (
                formData.sellerNTN ||
                formData.sellerCNIC ||
                formData.sellerBusinessName ||
                tenant.diConfigured
            ) {
                payload.sellerNTN = formData.sellerNTN.trim() || null
                payload.sellerCNIC = formData.sellerCNIC.trim() || null
                payload.sellerBusinessName = formData.sellerBusinessName.trim() || formData.name.trim()
                payload.sellerProvince = formData.sellerProvince
                payload.sellerAddress = formData.sellerAddress.trim() || formData.address.trim() || null
                payload.businessActivity = formData.businessActivity
                payload.sector = formData.sector
                payload.environment = formData.environment
                payload.isProductionReady = formData.isProductionReady
            }

            const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Failed to update tenant details')
                setSaving(false)
                return
            }

            const updated = data.tenant || data
            onSaveSuccess(updated)
            onClose()
        } catch {
            setError('Network error occurred while updating tenant details.')
        } finally {
            setSaving(false)
        }
    }

    const inputClasses =
        'w-full rounded-xl border border-border bg-white px-3.5 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl border border-border w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-subtle">
                    <div>
                        <h2 className="text-base font-semibold text-ink">Edit Tenant Details</h2>
                        <p className="text-xs text-muted">Update business profile and tax credentials for {tenant.businessName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-muted hover:text-ink hover:bg-surface transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-border px-6 bg-white gap-4">
                    <button
                        type="button"
                        onClick={() => setActiveTab('general')}
                        className={`flex items-center gap-2 py-3 text-xs font-semibold border-b-2 transition-colors ${
                            activeTab === 'general'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted hover:text-ink'
                        }`}
                    >
                        <Building2 size={15} />
                        General Business
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('tax')}
                        className={`flex items-center gap-2 py-3 text-xs font-semibold border-b-2 transition-colors ${
                            activeTab === 'tax'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted hover:text-ink'
                        }`}
                    >
                        <Shield size={15} />
                        Tax & FBR Profile
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                            <AlertCircle size={16} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form id="edit-tenant-form" onSubmit={handleSubmit} className="space-y-4">
                        {activeTab === 'general' ? (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-ink mb-1">
                                            Business Name <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g. Acme Corporation"
                                            className={inputClasses}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-ink mb-1">
                                            Tenant Slug <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.slug}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                                                })
                                            }
                                            placeholder="e.g. acme-corp"
                                            className={`${inputClasses} font-mono`}
                                        />
                                        <p className="mt-1 text-[11px] text-muted">Unique identifier used for tenant URLs and routes</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-ink mb-1">
                                            Primary Email <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="admin@business.com"
                                            className={inputClasses}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-ink mb-1">Phone Number</label>
                                        <input
                                            type="text"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="e.g. 03001234567"
                                            className={inputClasses}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-ink mb-1">Business Address</label>
                                    <textarea
                                        rows={2}
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        placeholder="Street, City, Province"
                                        className={`${inputClasses} resize-none`}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                    <div>
                                        <label className="block text-xs font-medium text-ink mb-1">Default Buyer ID Type</label>
                                        <select
                                            value={formData.preferredIdType}
                                            onChange={(e) => setFormData({ ...formData, preferredIdType: e.target.value as 'NTN' | 'CNIC' })}
                                            className={inputClasses}
                                        >
                                            <option value="NTN">NTN (National Tax Number)</option>
                                            <option value="CNIC">CNIC (Computerized National ID)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-ink mb-1">Account Status</label>
                                        <select
                                            value={formData.isActive ? 'active' : 'suspended'}
                                            onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                                            className={inputClasses}
                                        >
                                            <option value="active">Active</option>
                                            <option value="suspended">Suspended</option>
                                        </select>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-ink mb-1">
                                            Seller NTN (7 to 9 digits)
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.sellerNTN}
                                            onChange={(e) => setFormData({ ...formData, sellerNTN: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                                            placeholder="e.g. 1234567"
                                            className={`${inputClasses} font-mono`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-ink mb-1">
                                            Seller CNIC (13 digits)
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.sellerCNIC}
                                            onChange={(e) => setFormData({ ...formData, sellerCNIC: e.target.value.replace(/\D/g, '').slice(0, 13) })}
                                            placeholder="e.g. 3520112345671"
                                            className={`${inputClasses} font-mono`}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-ink mb-1">
                                        Registered Business Name (IRIS)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.sellerBusinessName}
                                        onChange={(e) => setFormData({ ...formData, sellerBusinessName: e.target.value })}
                                        placeholder="Business name exactly as in FBR IRIS records"
                                        className={inputClasses}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-ink mb-1">Registered Province</label>
                                        <select
                                            value={formData.sellerProvince}
                                            onChange={(e) => setFormData({ ...formData, sellerProvince: e.target.value })}
                                            className={inputClasses}
                                        >
                                            {PROVINCES.map((prov) => (
                                                <option key={prov} value={prov}>
                                                    {prov}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-ink mb-1">DI Environment</label>
                                        <select
                                            value={formData.environment}
                                            onChange={(e) =>
                                                setFormData({ ...formData, environment: e.target.value as 'SANDBOX' | 'PRODUCTION' })
                                            }
                                            className={inputClasses}
                                        >
                                            <option value="SANDBOX">Sandbox (Test)</option>
                                            <option value="PRODUCTION">Production (Live)</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-ink mb-1">Registered Tax Address</label>
                                    <textarea
                                        rows={2}
                                        value={formData.sellerAddress}
                                        onChange={(e) => setFormData({ ...formData, sellerAddress: e.target.value })}
                                        placeholder="Registered address for FBR PRAL submissions"
                                        className={`${inputClasses} resize-none`}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-ink mb-1">Business Activity</label>
                                        <select
                                            value={formData.businessActivity}
                                            onChange={(e) => setFormData({ ...formData, businessActivity: e.target.value })}
                                            className={inputClasses}
                                        >
                                            {BUSINESS_ACTIVITIES.map((act) => (
                                                <option key={act} value={act}>
                                                    {act}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-ink mb-1">Sector</label>
                                        <select
                                            value={formData.sector}
                                            onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                                            className={inputClasses}
                                        >
                                            {SECTORS.map((sec) => (
                                                <option key={sec} value={sec}>
                                                    {sec}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <label className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-subtle cursor-pointer hover:bg-surface transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={formData.isProductionReady}
                                            onChange={(e) => setFormData({ ...formData, isProductionReady: e.target.checked })}
                                            className="h-4 w-4 rounded border-border accent-primary"
                                        />
                                        <div>
                                            <span className="text-xs font-semibold text-ink">Production Ready</span>
                                            <p className="text-[11px] text-muted">
                                                Tenant has completed required sandbox scenarios and is cleared for production submissions.
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            </>
                        )}
                    </form>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface-subtle">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-full border border-border px-4 py-2 text-xs font-medium text-ink hover:bg-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="edit-tenant-form"
                        disabled={saving}
                        className="rounded-full bg-primary hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed text-white px-5 py-2 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                    >
                        {saving ? (
                            <>
                                <Loader2 size={13} className="animate-spin" />
                                Saving Changes...
                            </>
                        ) : (
                            <>
                                <Check size={13} />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
