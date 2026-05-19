import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { tenant } = await getTenantFromSession()
    const { id } = await params

    const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId: tenant.id },
        select: { id: true, status: true, invoiceNumber: true },
    })

    if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const deletableStatuses = ['DRAFT', 'FAILED']
    if (!deletableStatuses.includes(invoice.status)) {
        return NextResponse.json(
            { error: `Only DRAFT or FAILED invoices can be deleted. This invoice is ${invoice.status}.` },
            { status: 409 },
        )
    }

    // Delete submission logs then invoice (items are cascade-deleted via schema)
    await prisma.$transaction([
        prisma.fBRSubmissionLog.deleteMany({ where: { invoiceId: id, tenantId: tenant.id } }),
        prisma.invoiceItem.deleteMany({ where: { invoiceId: id } }),
        prisma.invoice.delete({ where: { id } }),
    ])

    return NextResponse.json({ success: true, deleted: invoice.invoiceNumber })
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { tenant } = await getTenantFromSession()
    const { id } = await params

    const [invoice, latestSubmissionLog] = await Promise.all([
        prisma.invoice.findFirst({
            where: { id, tenantId: tenant.id },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                name: true,
                                sku: true,
                            },
                        },
                    },
                },
                user: { select: { name: true, email: true } },
                terminal: { select: { name: true } },
                tenant: {
                    select: {
                        name: true,
                        address: true,
                        logoUrl: true,
                        diCredentials: {
                            select: {
                                sellerNTN: true,
                                sellerBusinessName: true,
                                sellerProvince: true,
                            },
                        },
                    },
                },
                customer: {
                    select: {
                        id: true,
                        name: true,
                        ntnCnic: true,
                        phone: true,
                        email: true,
                        province: true,
                        address: true,
                        registrationType: true,
                    },
                },
            },
        }),
        prisma.fBRSubmissionLog.findFirst({
            where: {
                tenantId: tenant.id,
                invoiceId: id,
            },
            orderBy: { createdAt: 'desc' },
            select: {
                attempt: true,
                responseCode: true,
                responseBody: true,
                requestBody:true,
                error: true,
                durationMs: true,
                createdAt: true,
            },
        }),
    ])

    if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json({
        invoice: {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            buyerName: invoice.buyerName,
            buyerNTN: invoice.buyerNTN,
            buyerCNIC: null,
            buyerPhone: invoice.buyerPhone,
            buyerProvince: invoice.buyerProvince,
            buyerAddress: invoice.buyerAddress,
            buyerRegistrationType: invoice.buyerRegistrationType,
            customer: invoice.customer,
            subtotal: Number(invoice.subtotal),
            totalTax: Number(invoice.taxAmount),
            totalAmount: Number(invoice.totalAmount),
            paymentMethod: invoice.paymentMethod,
            status: invoice.status,
            submissionError: invoice.submissionError,
            diInvoiceNumber: invoice.diInvoiceNumber,
            diInvoiceDate: invoice.diInvoiceDate,
            diStatusCode: invoice.diStatusCode,
            diStatus: invoice.diStatus,
            diItemStatuses: invoice.diItemStatuses,
            diErrorCode: invoice.diErrorCode,
            diErrorMessage: invoice.diErrorMessage,
            qrCodeData: invoice.qrCodeData,
            createdAt: invoice.createdAt,
            latestSubmissionLog,
            seller: {
                name: invoice.tenant.name,
                address: invoice.tenant.address,
                ntn: invoice.tenant.diCredentials?.sellerNTN ?? null,
                businessName: invoice.tenant.diCredentials?.sellerBusinessName ?? null,
                province: invoice.tenant.diCredentials?.sellerProvince ?? null,
            },
            items: invoice.items.map((item) => ({
                id: item.id,
                hsCode: item.hsCode,
                name: item.name,
                quantity: Number(item.quantity),
                unit: item.unit,
                unitPrice: Number(item.unitPrice),
                gstRate: Number(item.taxRate),
                discount: item.discount != null ? Number(item.discount) : 0,
                taxAmount: Number(item.taxAmount),
                totalPrice: Number(item.lineTotal),
                product: {
                    name: item.product.name,
                    sku: item.product.sku ?? '',
                },
            })),
        },
    })
}
