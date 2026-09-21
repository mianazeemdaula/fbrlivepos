import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { assertSuperAdmin, writeAuditLog, prisma } = vi.hoisted(() => {
    const prismaObj = {
        tenant: {
            findUnique: vi.fn(),
            findUniqueOrThrow: vi.fn(),
            findFirst: vi.fn(),
            update: vi.fn(),
        },
        tenantSubscription: {
            updateMany: vi.fn(),
        },
        dICredentials: {
            update: vi.fn(),
            create: vi.fn(),
        },
        $transaction: vi.fn(async (cb: any) => cb(prismaObj)),
    }
    return {
        assertSuperAdmin: vi.fn(),
        writeAuditLog: vi.fn(),
        prisma: prismaObj,
    }
})

vi.mock('@/lib/admin/guard', () => ({
    assertSuperAdmin,
}))

vi.mock('@/lib/admin/audit', () => ({
    writeAuditLog,
}))

vi.mock('@/lib/db/prisma', () => ({
    prisma,
}))

// Import route handlers
import { GET, PATCH } from './route'

describe('Admin Tenant Routes: /api/admin/tenants/[tenantId]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        assertSuperAdmin.mockResolvedValue({
            actor: { id: 'admin-1', email: 'superadmin@platform.com', role: 'SUPER_ADMIN' },
        })
    })

    describe('GET', () => {
        it('returns 404 if tenant not found', async () => {
            prisma.tenant.findUnique.mockResolvedValue(null)

            const req = new NextRequest('http://localhost/api/admin/tenants/t-1')
            const res = await GET(req, { params: Promise.resolve({ tenantId: 't-1' }) })

            expect(res.status).toBe(404)
            const body = await res.json()
            expect(body.error).toBe('Tenant not found')
        })

        it('returns formatted tenant data on success', async () => {
            const mockDate = new Date('2026-01-01T00:00:00.000Z')
            prisma.tenant.findUnique.mockResolvedValue({
                id: 't-1',
                name: 'Alpha Traders',
                slug: 'alpha-traders',
                email: 'contact@alpha.com',
                phone: '03001234567',
                address: '123 Mall Road, Lahore',
                logoUrl: null,
                preferredIdType: 'NTN',
                isActive: true,
                createdAt: mockDate,
                updatedAt: mockDate,
                diCredentials: {
                    sellerNTN: '1234567',
                    sellerCNIC: '3520112345671',
                    sellerBusinessName: 'Alpha Traders Private Limited',
                    sellerProvince: 'PUNJAB',
                    sellerAddress: '123 Mall Road, Lahore',
                    businessActivity: 'Retailer',
                    sector: 'FMCG',
                    environment: 'SANDBOX',
                    isProductionReady: false,
                    irisRegistrationStatus: 'PENDING',
                    lastVerifiedAt: null,
                },
                subscription: {
                    status: 'ACTIVE',
                    plan: { id: 'p-1', name: 'Starter' },
                    currentPeriodEnd: mockDate,
                },
                users: [
                    { id: 'u-1', name: 'Ali', email: 'ali@alpha.com', role: 'TENANT_ADMIN', isActive: true, createdAt: mockDate },
                ],
                _count: { invoices: 10, users: 1, products: 5, posTerminals: 1 },
            })

            const req = new NextRequest('http://localhost/api/admin/tenants/t-1')
            const res = await GET(req, { params: Promise.resolve({ tenantId: 't-1' }) })

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.tenant.id).toBe('t-1')
            expect(body.tenant.businessName).toBe('Alpha Traders')
            expect(body.tenant.slug).toBe('alpha-traders')
            expect(body.tenant.diCredentials.sellerNTN).toBe('1234567')
            expect(body.tenant.diConfigured).toBe(true)
        })
    })

    describe('PATCH', () => {
        const existingTenant = {
            id: 't-1',
            name: 'Alpha Traders',
            slug: 'alpha-traders',
            email: 'contact@alpha.com',
            phone: '03001234567',
            address: '123 Mall Road',
            preferredIdType: 'NTN',
            isActive: true,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            diCredentials: {
                sellerNTN: '1234567',
                sellerCNIC: null,
                sellerBusinessName: 'Alpha Traders',
                sellerProvince: 'PUNJAB',
                sellerAddress: '123 Mall Road',
                businessActivity: 'Retailer',
                sector: 'FMCG',
                environment: 'SANDBOX',
                isProductionReady: false,
            },
        }

        it('returns 400 for invalid body or validation errors', async () => {
            const req = new NextRequest('http://localhost/api/admin/tenants/t-1', {
                method: 'PATCH',
                body: JSON.stringify({ email: 'not-an-email' }),
            })

            const res = await PATCH(req, { params: Promise.resolve({ tenantId: 't-1' }) })
            expect(res.status).toBe(400)
            const body = await res.json()
            expect(body.error).toBe('Invalid email address')
        })

        it('returns 409 if new slug is already taken', async () => {
            prisma.tenant.findUnique.mockResolvedValue(existingTenant)
            prisma.tenant.findFirst.mockResolvedValue({ id: 't-2', slug: 'beta-traders' })

            const req = new NextRequest('http://localhost/api/admin/tenants/t-1', {
                method: 'PATCH',
                body: JSON.stringify({ slug: 'beta-traders' }),
            })

            const res = await PATCH(req, { params: Promise.resolve({ tenantId: 't-1' }) })
            expect(res.status).toBe(409)
            const body = await res.json()
            expect(body.error).toContain('slug already exists')
        })

        it('returns 409 if new email is already taken', async () => {
            prisma.tenant.findUnique.mockResolvedValue(existingTenant)
            prisma.tenant.findFirst.mockResolvedValue({ id: 't-2', email: 'taken@domain.com' })

            const req = new NextRequest('http://localhost/api/admin/tenants/t-1', {
                method: 'PATCH',
                body: JSON.stringify({ email: 'taken@domain.com' }),
            })

            const res = await PATCH(req, { params: Promise.resolve({ tenantId: 't-1' }) })
            expect(res.status).toBe(409)
            const body = await res.json()
            expect(body.error).toContain('email already exists')
        })

        it('returns 400 for invalid seller NTN format', async () => {
            prisma.tenant.findUnique.mockResolvedValue(existingTenant)

            const req = new NextRequest('http://localhost/api/admin/tenants/t-1', {
                method: 'PATCH',
                body: JSON.stringify({ sellerNTN: '123' }),
            })

            const res = await PATCH(req, { params: Promise.resolve({ tenantId: 't-1' }) })
            expect(res.status).toBe(400)
            const body = await res.json()
            expect(body.error).toContain('Seller NTN must be 7, 8, or 9 digits')
        })

        it('updates tenant details and records audit log', async () => {
            prisma.tenant.findUnique.mockResolvedValue(existingTenant)
            prisma.tenant.findFirst.mockResolvedValue(null) // no slug/email collision

            const updatedTenant = {
                ...existingTenant,
                name: 'Alpha Traders New',
                phone: '03009999999',
                address: 'New Address, Islamabad',
                users: [],
                subscription: null,
                _count: { invoices: 0, users: 0, products: 0, posTerminals: 0 },
            }
            prisma.tenant.findUniqueOrThrow.mockResolvedValue(updatedTenant)

            const req = new NextRequest('http://localhost/api/admin/tenants/t-1', {
                method: 'PATCH',
                body: JSON.stringify({
                    name: 'Alpha Traders New',
                    phone: '03009999999',
                    address: 'New Address, Islamabad',
                }),
            })

            const res = await PATCH(req, { params: Promise.resolve({ tenantId: 't-1' }) })
            expect(res.status).toBe(200)

            expect(prisma.tenant.update).toHaveBeenCalledWith({
                where: { id: 't-1' },
                data: expect.objectContaining({
                    name: 'Alpha Traders New',
                    phone: '03009999999',
                    address: 'New Address, Islamabad',
                }),
            })

            expect(writeAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorRole: 'SUPER_ADMIN',
                    action: 'TENANT_UPDATED',
                    tenantId: 't-1',
                }),
            )
        })

        it('updates DI credentials and manages subscription sync when tenant isActive changes', async () => {
            prisma.tenant.findUnique.mockResolvedValue(existingTenant)
            prisma.tenant.findFirst.mockResolvedValue(null)

            const updatedTenant = {
                ...existingTenant,
                isActive: false,
                users: [],
                subscription: null,
                _count: { invoices: 0, users: 0, products: 0, posTerminals: 0 },
            }
            prisma.tenant.findUniqueOrThrow.mockResolvedValue(updatedTenant)

            const req = new NextRequest('http://localhost/api/admin/tenants/t-1', {
                method: 'PATCH',
                body: JSON.stringify({
                    isActive: false,
                    sellerNTN: '7654321',
                    environment: 'PRODUCTION',
                    isProductionReady: true,
                }),
            })

            const res = await PATCH(req, { params: Promise.resolve({ tenantId: 't-1' }) })
            expect(res.status).toBe(200)

            // Subscription should be suspended
            expect(prisma.tenantSubscription.updateMany).toHaveBeenCalledWith({
                where: { tenantId: 't-1', status: { in: ['ACTIVE', 'TRIALING'] } },
                data: { status: 'SUSPENDED' },
            })

            // DI credentials should be updated
            expect(prisma.dICredentials.update).toHaveBeenCalledWith({
                where: { tenantId: 't-1' },
                data: expect.objectContaining({
                    sellerNTN: '7654321',
                    environment: 'PRODUCTION',
                    isProductionReady: true,
                }),
            })
        })
    })
})
