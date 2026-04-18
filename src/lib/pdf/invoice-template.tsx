import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
    page: { padding: 30, fontSize: 10, fontFamily: 'Helvetica' },
    header: { marginBottom: 20, borderBottom: '1 solid #333', paddingBottom: 10 },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
    subtitle: { fontSize: 10, color: '#666' },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
    tableHeader: {
        flexDirection: 'row',
        borderBottom: '1 solid #333',
        paddingBottom: 4,
        marginBottom: 4,
        fontWeight: 'bold',
    },
    tableRow: { flexDirection: 'row', paddingVertical: 2, borderBottom: '0.5 solid #eee' },
    col1: { width: '5%' },
    col2: { width: '35%' },
    col3: { width: '10%', textAlign: 'right' },
    col4: { width: '15%', textAlign: 'right' },
    col5: { width: '15%', textAlign: 'right' },
    col6: { width: '20%', textAlign: 'right' },
    totals: { marginTop: 15, borderTop: '1 solid #333', paddingTop: 10 },
    totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 3 },
    totalLabel: { width: 120, textAlign: 'right', marginRight: 10 },
    totalValue: { width: 100, textAlign: 'right', fontWeight: 'bold' },
    footer: { marginTop: 20, borderTop: '0.5 solid #ccc', paddingTop: 10, fontSize: 8, color: '#666' },
    fbrInfo: { marginTop: 10, padding: 8, backgroundColor: '#f5f5f5', borderRadius: 4 },
})

interface InvoicePDFProps {
    invoice: {
        invoiceNumber: string
        invoiceDate: string
        buyerName?: string | null
        buyerNTN?: string | null
        buyerPhone?: string | null
        subtotal: number
        taxAmount: number
        totalAmount: number
        paymentMethod: string
        diInvoiceNumber?: string | null
        qrCodeData?: string | null
        items: {
            name: string
            hsCode: string
            quantity: number
            unit: string
            unitPrice: number
            taxRate: number
            taxAmount: number
            lineTotal: number
        }[]
    }
    business: {
        name: string
        address?: string | null
        ntn?: string
    }
}

export function InvoicePDF({ invoice, business }: InvoicePDFProps) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>{business.name}</Text>
                    {business.address && <Text style={styles.subtitle}>{business.address}</Text>}
                    {business.ntn && <Text style={styles.subtitle}>NTN: {business.ntn}</Text>}
                </View>

                {/* Invoice Info */}
                <View style={{ marginBottom: 15 }}>
                    <View style={styles.row}>
                        <Text>Invoice #: {invoice.invoiceNumber}</Text>
                        <Text>Date: {new Date(invoice.invoiceDate).toLocaleDateString()}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text>Payment: {invoice.paymentMethod}</Text>
                    </View>
                    {invoice.buyerName && (
                        <View style={styles.row}>
                            <Text>Customer: {invoice.buyerName}</Text>
                            {invoice.buyerNTN && <Text>Buyer NTN: {invoice.buyerNTN}</Text>}
                        </View>
                    )}
                </View>

                {/* Items Table */}
                <View style={styles.tableHeader}>
                    <Text style={styles.col1}>#</Text>
                    <Text style={styles.col2}>Item</Text>
                    <Text style={styles.col3}>Qty</Text>
                    <Text style={styles.col4}>Price</Text>
                    <Text style={styles.col5}>Tax</Text>
                    <Text style={styles.col6}>Total</Text>
                </View>

                {invoice.items.map((item, i) => (
                    <View key={i} style={styles.tableRow}>
                        <Text style={styles.col1}>{i + 1}</Text>
                        <Text style={styles.col2}>
                            {item.name} ({item.hsCode})
                        </Text>
                        <Text style={styles.col3}>
                            {item.quantity} {item.unit}
                        </Text>
                        <Text style={styles.col4}>PKR {item.unitPrice.toFixed(2)}</Text>
                        <Text style={styles.col5}>PKR {item.taxAmount.toFixed(2)}</Text>
                        <Text style={styles.col6}>PKR {item.lineTotal.toFixed(2)}</Text>
                    </View>
                ))}

                {/* Totals */}
                <View style={styles.totals}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Subtotal:</Text>
                        <Text style={styles.totalValue}>PKR {invoice.subtotal.toFixed(2)}</Text>
                    </View>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Tax:</Text>
                        <Text style={styles.totalValue}>PKR {invoice.taxAmount.toFixed(2)}</Text>
                    </View>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total:</Text>
                        <Text style={{ ...styles.totalValue, fontSize: 14 }}>
                            PKR {invoice.totalAmount.toFixed(2)}
                        </Text>
                    </View>
                </View>

                {/* DI Info */}
                {invoice.diInvoiceNumber && (
                    <View style={styles.fbrInfo}>
                        <Text>PRAL DI Invoice Number: {invoice.diInvoiceNumber}</Text>
                        <Text>This invoice has been reported to PRAL Digital Invoicing</Text>
                    </View>
                )}

                {/* Footer */}
                <View style={styles.footer}>
                    <Text>Generated by PRAL DI POS Platform</Text>
                    <Text>Pakistan GST Compliant Invoice</Text>
                </View>
            </Page>
        </Document>
    )
}
