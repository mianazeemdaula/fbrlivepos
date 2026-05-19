import { NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
    const { tenant } = await getTenantFromSession()

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // Build 6-month buckets
    const months: { label: string; start: Date; end: Date }[] = []
    for (let i = 5; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
        const label = start.toLocaleString('default', { month: 'short', year: '2-digit' })
        months.push({ label, start, end })
    }

    // Parallel queries
    const [
        todaySandbox,
        todayProduction,
        monthSandbox,
        monthProduction,
        sandboxStatusBreakdown,
        productionStatusBreakdown,
        monthlySandboxRaw,
        monthlyProductionRaw,
        productCount,
        customerCount,
    ] = await Promise.all([
        // Today aggregates per environment
        prisma.invoice.aggregate({
            where: { tenantId: tenant.id, diEnvironment: 'SANDBOX', createdAt: { gte: todayStart } },
            _count: true,
            _sum: { totalAmount: true, taxAmount: true },
        }),
        prisma.invoice.aggregate({
            where: { tenantId: tenant.id, diEnvironment: 'PRODUCTION', createdAt: { gte: todayStart } },
            _count: true,
            _sum: { totalAmount: true, taxAmount: true },
        }),
        // This month per environment
        prisma.invoice.aggregate({
            where: { tenantId: tenant.id, diEnvironment: 'SANDBOX', createdAt: { gte: monthStart } },
            _count: true,
            _sum: { totalAmount: true, taxAmount: true },
        }),
        prisma.invoice.aggregate({
            where: { tenantId: tenant.id, diEnvironment: 'PRODUCTION', createdAt: { gte: monthStart } },
            _count: true,
            _sum: { totalAmount: true, taxAmount: true },
        }),
        // Status breakdown for sandbox
        prisma.invoice.groupBy({
            by: ['status'],
            where: { tenantId: tenant.id, diEnvironment: 'SANDBOX' },
            _count: true,
        }),
        // Status breakdown for production
        prisma.invoice.groupBy({
            by: ['status'],
            where: { tenantId: tenant.id, diEnvironment: 'PRODUCTION' },
            _count: true,
        }),
        // Monthly sandbox data (raw invoices for bucketing)
        prisma.invoice.findMany({
            where: {
                tenantId: tenant.id,
                diEnvironment: 'SANDBOX',
                createdAt: { gte: months[0].start },
            },
            select: { createdAt: true, totalAmount: true, taxAmount: true, status: true },
        }),
        // Monthly production data
        prisma.invoice.findMany({
            where: {
                tenantId: tenant.id,
                diEnvironment: 'PRODUCTION',
                createdAt: { gte: months[0].start },
            },
            select: { createdAt: true, totalAmount: true, taxAmount: true, status: true },
        }),
        // Catalogue counts
        prisma.product.count({ where: { tenantId: tenant.id, isActive: true } }),
        prisma.customer.count({ where: { tenantId: tenant.id } }),
    ])

    // Bucket monthly data
    const sandboxMonthly = months.map(({ label, start, end }) => {
        const invoices = monthlySandboxRaw.filter(
            (inv) => inv.createdAt >= start && inv.createdAt < end,
        )
        return {
            month: label,
            invoices: invoices.length,
            sales: invoices.reduce((s, inv) => s + Number(inv.totalAmount), 0),
            tax: invoices.reduce((s, inv) => s + Number(inv.taxAmount), 0),
            submitted: invoices.filter((inv) => inv.status === 'SUBMITTED').length,
            failed: invoices.filter((inv) => inv.status === 'FAILED').length,
        }
    })

    const productionMonthly = months.map(({ label, start, end }) => {
        const invoices = monthlyProductionRaw.filter(
            (inv) => inv.createdAt >= start && inv.createdAt < end,
        )
        return {
            month: label,
            invoices: invoices.length,
            sales: invoices.reduce((s, inv) => s + Number(inv.totalAmount), 0),
            tax: invoices.reduce((s, inv) => s + Number(inv.taxAmount), 0),
            submitted: invoices.filter((inv) => inv.status === 'SUBMITTED').length,
            failed: invoices.filter((inv) => inv.status === 'FAILED').length,
        }
    })

    // Helper to sum status breakdowns
    const toStatusMap = (rows: { status: string; _count: number }[]) =>
        Object.fromEntries(rows.map((r) => [r.status, r._count]))

    const sandboxStatus = toStatusMap(sandboxStatusBreakdown as { status: string; _count: number }[])
    const productionStatus = toStatusMap(productionStatusBreakdown as { status: string; _count: number }[])

    return NextResponse.json({
        today: {
            sandbox: {
                invoices: todaySandbox._count,
                sales: Number(todaySandbox._sum.totalAmount ?? 0),
                tax: Number(todaySandbox._sum.taxAmount ?? 0),
            },
            production: {
                invoices: todayProduction._count,
                sales: Number(todayProduction._sum.totalAmount ?? 0),
                tax: Number(todayProduction._sum.taxAmount ?? 0),
            },
        },
        month: {
            sandbox: {
                invoices: monthSandbox._count,
                sales: Number(monthSandbox._sum.totalAmount ?? 0),
                tax: Number(monthSandbox._sum.taxAmount ?? 0),
            },
            production: {
                invoices: monthProduction._count,
                sales: Number(monthProduction._sum.totalAmount ?? 0),
                tax: Number(monthProduction._sum.taxAmount ?? 0),
            },
        },
        statusBreakdown: {
            sandbox: sandboxStatus,
            production: productionStatus,
        },
        monthly: {
            sandbox: sandboxMonthly,
            production: productionMonthly,
        },
        catalogue: {
            products: productCount,
            customers: customerCount,
        },
    })
}
