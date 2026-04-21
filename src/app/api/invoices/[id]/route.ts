import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { prisma } from '@/lib/db/prisma'

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
                tenant: { select: { name: true, address: true, logoUrl: true } },
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
            items: invoice.items.map((item) => ({
                id: item.id,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                gstRate: Number(item.taxRate),
                totalPrice: Number(item.lineTotal),
                product: {
                    name: item.product.name,
                    sku: item.product.sku ?? '',
                },
            })),
        },
    })
}
