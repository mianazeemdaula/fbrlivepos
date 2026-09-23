import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prisma } = vi.hoisted(() => ({
    prisma: {
        $transaction: vi.fn(),
        tenantSubscription: {
            updateMany: vi.fn(),
            findUnique: vi.fn(),
        },
    },
}))

vi.mock('@/lib/db/prisma', () => ({ prisma }))

import { accessEndsAt, addBillingCycle, applyPaidPeriod, getSubscriptionAccess } from './subscription'

describe('addBillingCycle', () => {
    it('adds months and years', () => {
        const start = new Date('2026-01-15T00:00:00Z')
        expect(addBillingCycle(start, 'MONTHLY').toISOString()).toBe('2026-02-15T00:00:00.000Z')
        expect(addBillingCycle(start, 'MONTHLY', 3).toISOString()).toBe('2026-04-15T00:00:00.000Z')
        expect(addBillingCycle(start, 'YEARLY').toISOString()).toBe('2027-01-15T00:00:00.000Z')
    })
})

describe('accessEndsAt', () => {
    it('uses trial end for trialing subscriptions', () => {
        const trialEndsAt = new Date('2026-03-01')
        const currentPeriodEnd = new Date('2026-04-01')
        expect(accessEndsAt({ status: 'TRIALING', trialEndsAt, currentPeriodEnd })).toBe(trialEndsAt)
        expect(accessEndsAt({ status: 'ACTIVE', trialEndsAt, currentPeriodEnd })).toBe(currentPeriodEnd)
    })
})

describe('applyPaidPeriod', () => {
    const tx = {
        tenantSubscription: {
            update: vi.fn(async (args: unknown) => args),
            findUniqueOrThrow: vi.fn(async () => ({ id: 'sub-1' })),
        },
    }

    beforeEach(() => vi.clearAllMocks())

    it('extends an expired subscription and reactivates it', async () => {
        const sub = {
            id: 'sub-1',
            status: 'PAST_DUE' as const,
            currentPeriodStart: new Date('2020-01-01'),
            currentPeriodEnd: new Date('2020-02-01'),
        }
        const periodStart = new Date('2026-09-01')
        const periodEnd = new Date('2026-10-01')

        await applyPaidPeriod(tx as never, sub, periodStart, periodEnd)

        expect(tx.tenantSubscription.update).toHaveBeenCalledWith({
            where: { id: 'sub-1' },
            data: {
                currentPeriodEnd: periodEnd,
                currentPeriodStart: periodStart,
                status: 'ACTIVE',
                trialEndsAt: null,
            },
        })
    })

    it('does not reactivate a suspended subscription', async () => {
        const sub = {
            id: 'sub-1',
            status: 'SUSPENDED' as const,
            currentPeriodStart: new Date('2020-01-01'),
            currentPeriodEnd: new Date('2020-02-01'),
        }
        await applyPaidPeriod(tx as never, sub, new Date('2026-09-01'), new Date('2026-10-01'))

        const call = tx.tenantSubscription.update.mock.calls[0][0] as { data: Record<string, unknown> }
        expect(call.data.status).toBeUndefined()
        expect(call.data.currentPeriodEnd).toEqual(new Date('2026-10-01'))
    })

    it('leaves the subscription untouched when the paid period is already covered', async () => {
        const sub = {
            id: 'sub-1',
            status: 'ACTIVE' as const,
            currentPeriodStart: new Date('2026-01-01'),
            currentPeriodEnd: new Date('2099-01-01'),
        }
        await applyPaidPeriod(tx as never, sub, new Date('2026-09-01'), new Date('2026-10-01'))
        expect(tx.tenantSubscription.update).not.toHaveBeenCalled()
    })
})

describe('getSubscriptionAccess', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        prisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 0 }])
    })

    it('allows tenants without a subscription (free tier)', async () => {
        prisma.tenantSubscription.findUnique.mockResolvedValue(null)
        const access = await getSubscriptionAccess('t-1')
        expect(access.allowed).toBe(true)
        expect(access.hasSubscription).toBe(false)
    })

    it('blocks expired (PAST_DUE) subscriptions with a renewal message', async () => {
        prisma.tenantSubscription.findUnique.mockResolvedValue({
            status: 'PAST_DUE',
            currentPeriodEnd: new Date('2026-01-01'),
            trialEndsAt: null,
            plan: { name: 'Growth' },
        })
        const access = await getSubscriptionAccess('t-1')
        expect(access.allowed).toBe(false)
        expect(access.reason).toContain('Growth subscription expired')
    })

    it('flags active subscriptions expiring within 7 days', async () => {
        prisma.tenantSubscription.findUnique.mockResolvedValue({
            status: 'ACTIVE',
            currentPeriodEnd: new Date(Date.now() + 3 * 86_400_000),
            trialEndsAt: null,
            plan: { name: 'Basic' },
        })
        const access = await getSubscriptionAccess('t-1')
        expect(access.allowed).toBe(true)
        expect(access.expiringSoon).toBe(true)
        expect(access.daysLeft).toBe(3)
    })
})
