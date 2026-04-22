'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import Image from 'next/image'


interface InvoiceItem {
    id: string
    hsCode: string
    name: string
    quantity: number
    unit: string
    unitPrice: number
    gstRate: number
    discount: number
    taxAmount: number
    totalPrice: number
}

interface Seller {
    name: string | null
    businessName: string | null
    ntn: string | null
    address: string | null
    province: string | null
}

export interface PrintableInvoice {
    invoiceNumber: string
    createdAt: string
    paymentMethod: string
    status: string
    diInvoiceNumber: string | null
    diInvoiceDate: string | null
    qrCodeData: string | null
    seller: Seller
    buyerName: string | null
    buyerNTN: string | null
    buyerPhone: string | null
    buyerProvince: string | null
    buyerAddress: string | null
    buyerRegistrationType: string | null
    items: InvoiceItem[]
    subtotal: number
    totalTax: number
    totalAmount: number
}

interface Props {
    invoice: PrintableInvoice
    onClose: () => void
    standalone?: boolean
}

export default function InvoicePrintModal({ invoice, onClose, standalone = false }: Props) {
    const qrCanvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        if (qrCanvasRef.current && invoice.qrCodeData) {
            QRCode.toCanvas(qrCanvasRef.current, invoice.qrCodeData, {
                width: 96,
                margin: 0,
                color: { dark: '#000000', light: '#ffffff' },
            }).catch(() => { /* fallback: no QR */ })
        }
    }, [invoice.qrCodeData])

    function handlePrint() {
        window.print()
    }

    const discountTotal = invoice.items.reduce((s, i) => s + i.discount, 0)

    return (
        <>
            <style>{standalone ? `
                @media print {
                    .no-print { display: none !important; }
                    @page { size: A4; margin: 12mm; }
                }
                @media screen {
                    #invoice-print-root { display: block; }
                }
            ` : `
                @media print {
                    body > *:not(#invoice-print-root) { display: none !important; }
                    #invoice-print-root { display: block !important; }
                    .no-print { display: none !important; }
                    @page { size: A4; margin: 12mm; }
                }
                @media screen {
                    #invoice-print-root { display: none; }
                }
            `}</style>

            {!standalone && (
                <div
                    className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
                >
                    <div className="app-panel flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl">
                        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Print Invoice</p>
                                <h2 className="mt-1 text-lg font-bold text-white">{invoice.invoiceNumber}</h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-[#8d897d] hover:bg-white/14 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                            <p className="mb-4 text-sm text-[#c1bcaf]">
                                Your browser print dialog will open. Recommended: A4 paper, no scaling.
                            </p>
                            <div className="space-y-2 rounded-xl border border-white/10 bg-white/4 p-4 text-sm">
                                <div className="flex justify-between text-[#c1bcaf]">
                                    <span>Invoice #</span>
                                    <span className="text-white font-medium">{invoice.invoiceNumber}</span>
                                </div>
                                {invoice.diInvoiceNumber && (
                                    <div className="flex justify-between text-[#c1bcaf]">
                                        <span>PRAL #</span>
                                        <span className="text-green-400 font-mono text-xs">{invoice.diInvoiceNumber}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-[#c1bcaf]">
                                    <span>Items</span>
                                    <span className="text-white">{invoice.items.length}</span>
                                </div>
                                <div className="flex justify-between text-[#c1bcaf]">
                                    <span>Total</span>
                                    <span className="text-white font-bold">PKR {invoice.totalAmount.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-white/10 p-4 flex gap-3">
                            <button
                                onClick={handlePrint}
                                className="flex-1 rounded-full bg-accent py-2.5 text-sm font-medium text-primary hover:bg-(--accent-soft)"
                            >
                                Print / Save as PDF
                            </button>
                            <button
                                onClick={onClose}
                                className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-[#8d897d] hover:bg-white/6"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {standalone && (
                <div className="no-print sticky top-0 z-10 border-b border-white/10 bg-[#0d140f] px-4 py-3">
                    <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
                        <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-[#f0d9a0]">Invoice Print View</p>
                            <h2 className="text-sm font-semibold text-white">{invoice.invoiceNumber}</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrint}
                                className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-primary hover:bg-(--accent-soft)"
                            >
                                Print / Save as PDF
                            </button>
                            <button
                                onClick={onClose}
                                className="rounded-full border border-white/15 px-4 py-2 text-sm text-[#d8d0bf] hover:bg-white/8"
                            >
                                Close Tab
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div id="invoice-print-root" style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11px', color: '#000', background: '#fff', padding: standalone ? '16px' : '0' }}>
                <PrintLayout invoice={invoice} qrCanvasRef={qrCanvasRef} discountTotal={discountTotal} />
            </div>
        </>
    )
}

function PrintLayout({
    invoice,
    qrCanvasRef,
    discountTotal,
}: {
    invoice: PrintableInvoice
    qrCanvasRef: React.RefObject<HTMLCanvasElement | null>
    discountTotal: number
}) {
    const sellerName = invoice.seller.businessName || invoice.seller.name || 'Seller'
    const buyerIdLabel = invoice.buyerNTN
        ? (invoice.buyerNTN.length === 13 ? 'CNIC' : 'NTN')
        : ''

    return (
        <div style={{ width: '100%', maxWidth: '780px', margin: '0 auto' }}>
            {/* ── Header ── */}
            <table style={{ width: '100%', borderBottom: '2px solid #000', marginBottom: '8px', paddingBottom: '8px' }}>
                <tbody>
                    <tr>
                        <td style={{ verticalAlign: 'top', width: '60%' }}>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '2px' }}>{sellerName}</div>
                            {invoice.seller.address && (
                                <div style={{ fontSize: '10px', color: '#444' }}>{invoice.seller.address}</div>
                            )}
                            {invoice.seller.province && (
                                <div style={{ fontSize: '10px', color: '#444' }}>{invoice.seller.province}, Pakistan</div>
                            )}
                            {invoice.seller.ntn && (
                                <div style={{ fontSize: '10px', marginTop: '2px' }}>
                                    <strong>NTN:</strong> {invoice.seller.ntn}
                                </div>
                            )}
                        </td>
                        <td style={{ textAlign: 'right', verticalAlign: 'top' }}>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1a5c2a' }}>TAX INVOICE</div>
                            <div style={{ fontSize: '10px', marginTop: '4px' }}>
                                <strong>Invoice No.:</strong> {invoice.invoiceNumber}
                            </div>
                            <div style={{ fontSize: '10px' }}>
                                <strong>Date:</strong> {new Date(invoice.createdAt).toLocaleString('en-PK')}
                            </div>
                            <div style={{ fontSize: '10px' }}>
                                <strong>Payment:</strong> {invoice.paymentMethod}
                            </div>
                            {invoice.diInvoiceNumber && (
                                <div style={{ fontSize: '9px', marginTop: '4px', color: '#1a5c2a' }}>
                                    <strong>PRAL Invoice No.:</strong> {invoice.diInvoiceNumber}
                                </div>
                            )}
                            {invoice.diInvoiceDate && (
                                <div style={{ fontSize: '9px', color: '#1a5c2a' }}>
                                    <strong>PRAL Date:</strong> {new Date(invoice.diInvoiceDate).toLocaleString('en-PK')}
                                </div>
                            )}
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* ── Buyer details ── */}
            {(invoice.buyerName || invoice.buyerNTN) && (
                <table style={{ width: '100%', borderBottom: '1px solid #ccc', marginBottom: '8px', paddingBottom: '6px' }}>
                    <tbody>
                        <tr>
                            <td style={{ width: '50%', verticalAlign: 'top' }}>
                                <div style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '3px' }}>Bill To</div>
                                {invoice.buyerName && <div style={{ fontWeight: '600' }}>{invoice.buyerName}</div>}
                                {invoice.buyerNTN && (
                                    <div style={{ fontSize: '10px' }}>
                                        <strong>{buyerIdLabel}:</strong> {invoice.buyerNTN}
                                    </div>
                                )}
                                {invoice.buyerRegistrationType && (
                                    <div style={{ fontSize: '10px' }}>
                                        <strong>Reg. Type:</strong> {invoice.buyerRegistrationType}
                                    </div>
                                )}
                            </td>
                            <td style={{ width: '50%', verticalAlign: 'top' }}>
                                {invoice.buyerPhone && (
                                    <div style={{ fontSize: '10px' }}>
                                        <strong>Phone:</strong> {invoice.buyerPhone}
                                    </div>
                                )}
                                {invoice.buyerProvince && (
                                    <div style={{ fontSize: '10px' }}>
                                        <strong>Province:</strong> {invoice.buyerProvince}
                                    </div>
                                )}
                                {invoice.buyerAddress && (
                                    <div style={{ fontSize: '10px' }}>
                                        <strong>Address:</strong> {invoice.buyerAddress}
                                    </div>
                                )}
                            </td>
                        </tr>
                    </tbody>
                </table>
            )}

            {/* ── Items table ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
                <thead>
                    <tr style={{ background: '#1a5c2a', color: '#fff' }}>
                        <th style={{ padding: '5px 4px', textAlign: 'left', fontSize: '9px', fontWeight: 'bold', border: '1px solid #1a5c2a' }}>#</th>
                        <th style={{ padding: '5px 4px', textAlign: 'left', fontSize: '9px', fontWeight: 'bold', border: '1px solid #1a5c2a' }}>Description</th>
                        <th style={{ padding: '5px 4px', textAlign: 'left', fontSize: '9px', fontWeight: 'bold', border: '1px solid #1a5c2a' }}>HS Code</th>
                        <th style={{ padding: '5px 4px', textAlign: 'center', fontSize: '9px', fontWeight: 'bold', border: '1px solid #1a5c2a' }}>Qty</th>
                        <th style={{ padding: '5px 4px', textAlign: 'center', fontSize: '9px', fontWeight: 'bold', border: '1px solid #1a5c2a' }}>Unit</th>
                        <th style={{ padding: '5px 4px', textAlign: 'right', fontSize: '9px', fontWeight: 'bold', border: '1px solid #1a5c2a' }}>Unit Price</th>
                        <th style={{ padding: '5px 4px', textAlign: 'right', fontSize: '9px', fontWeight: 'bold', border: '1px solid #1a5c2a' }}>Disc.</th>
                        <th style={{ padding: '5px 4px', textAlign: 'center', fontSize: '9px', fontWeight: 'bold', border: '1px solid #1a5c2a' }}>GST%</th>
                        <th style={{ padding: '5px 4px', textAlign: 'right', fontSize: '9px', fontWeight: 'bold', border: '1px solid #1a5c2a' }}>GST Amt</th>
                        <th style={{ padding: '5px 4px', textAlign: 'right', fontSize: '9px', fontWeight: 'bold', border: '1px solid #1a5c2a' }}>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {invoice.items.map((item, idx) => (
                        <tr key={item.id} style={{ background: idx % 2 === 0 ? '#f9f9f9' : '#fff' }}>
                            <td style={{ padding: '4px', border: '1px solid #ddd', fontSize: '10px' }}>{idx + 1}</td>
                            <td style={{ padding: '4px', border: '1px solid #ddd', fontSize: '10px' }}>{item.name}</td>
                            <td style={{ padding: '4px', border: '1px solid #ddd', fontSize: '9px', fontFamily: 'monospace' }}>{item.hsCode}</td>
                            <td style={{ padding: '4px', border: '1px solid #ddd', fontSize: '10px', textAlign: 'center' }}>{item.quantity}</td>
                            <td style={{ padding: '4px', border: '1px solid #ddd', fontSize: '9px', textAlign: 'center' }}>{item.unit}</td>
                            <td style={{ padding: '4px', border: '1px solid #ddd', fontSize: '10px', textAlign: 'right' }}>
                                {item.unitPrice.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '4px', border: '1px solid #ddd', fontSize: '10px', textAlign: 'right' }}>
                                {item.discount > 0 ? item.discount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                            </td>
                            <td style={{ padding: '4px', border: '1px solid #ddd', fontSize: '10px', textAlign: 'center' }}>{item.gstRate}%</td>
                            <td style={{ padding: '4px', border: '1px solid #ddd', fontSize: '10px', textAlign: 'right' }}>
                                {item.taxAmount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '4px', border: '1px solid #ddd', fontSize: '10px', textAlign: 'right', fontWeight: 'bold' }}>
                                {item.totalPrice.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* ── Totals + QR ── */}
            <table style={{ width: '100%', marginBottom: '10px' }}>
                <tbody>
                    <tr>
                        {/* QR code */}
                        <td style={{ verticalAlign: 'bottom', width: '30%' }}>
                            {invoice.qrCodeData ? (
                                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
                                    <div>
                                        <Image
                                            src="/fbr-digital-invoice-logo.png" // References public/me.png
                                            alt="Picture of the author"
                                            width={96}
                                            height={96}
                                        />
                                        <div style={{ fontSize: '8px', marginTop: '2px', color: '#555' }}>

                                        </div>
                                    </div>
                                    <div>
                                        <canvas
                                            ref={qrCanvasRef}
                                            style={{ display: 'block', width: '96px', height: '96px' }}
                                        />
                                        <div style={{ fontSize: '8px', marginTop: '2px', color: '#555' }}>
                                            Scan to verify (FBR QR v2.0)
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ width: '96px', height: '96px', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: '8px', color: '#aaa', textAlign: 'center' }}>QR pending</span>
                                </div>
                            )}
                        </td>

                        {/* Spacer */}
                        <td style={{ width: '35%' }} />

                        {/* Totals */}
                        <td style={{ verticalAlign: 'top', width: '35%' }}>
                            <table style={{ width: '100%', fontSize: '11px' }}>
                                <tbody>
                                    <tr>
                                        <td style={{ padding: '2px 4px', color: '#555' }}>Subtotal</td>
                                        <td style={{ padding: '2px 4px', textAlign: 'right' }}>
                                            PKR {invoice.subtotal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                    {discountTotal > 0 && (
                                        <tr>
                                            <td style={{ padding: '2px 4px', color: '#555' }}>Discount</td>
                                            <td style={{ padding: '2px 4px', textAlign: 'right', color: '#1a5c2a' }}>
                                                - PKR {discountTotal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    )}
                                    <tr>
                                        <td style={{ padding: '2px 4px', color: '#555' }}>GST</td>
                                        <td style={{ padding: '2px 4px', textAlign: 'right' }}>
                                            PKR {invoice.totalTax.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                    <tr style={{ borderTop: '2px solid #000' }}>
                                        <td style={{ padding: '4px', fontWeight: 'bold', fontSize: '13px' }}>Total</td>
                                        <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold', fontSize: '13px' }}>
                                            PKR {invoice.totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* ── Footer ── */}
            <div style={{ borderTop: '1px solid #ccc', paddingTop: '6px', fontSize: '9px', color: '#666', textAlign: 'center' }}>
                This is a computer-generated FBR-compliant tax invoice. No signature required.
                {invoice.diInvoiceNumber && (
                    <span> | PRAL Verified: {invoice.diInvoiceNumber}</span>
                )}
            </div>
            <div style={{ fontSize: '8px', color: '#aaa', textAlign: 'center', marginTop: '4px' }}>
                Powered by <a href="https://tax.aaz.dev" target="_blank" rel="noopener noreferrer" style={{ color: '#1a5c2a', textDecoration: 'underline' }}>AAZify</a>
            </div>
        </div>
    )
}
