'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import InvoicePrintModal, { type PrintableInvoice } from '@/app/(tenant)/invoices/InvoicePrintModal'

export default function InvoicePrintPage() {
    const params = useParams<{ id: string }>()
    const [invoice, setInvoice] = useState<PrintableInvoice | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function loadInvoice() {
            setLoading(true)
            setError(null)
            try {
                const res = await fetch(`/api/invoices/${params.id}`)
                const data = await res.json()
                if (!res.ok) {
                    setError(data.error ?? 'Unable to load invoice.')
                    return
                }
                setInvoice(data.invoice as PrintableInvoice)
            } catch {
                setError('Network error while loading invoice.')
            } finally {
                setLoading(false)
            }
        }

        if (params.id) {
            void loadInvoice()
        }
    }, [params.id])

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0d140f] p-6 text-sm text-[#c1bcaf]">
                Loading invoice print view...
            </div>
        )
    }

    if (error || !invoice) {
        return (
            <div className="min-h-screen bg-[#0d140f] p-6">
                <div className="mx-auto max-w-2xl rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">
                    {error ?? 'Invoice not found.'}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0d140f]">
            <InvoicePrintModal
                invoice={invoice}
                standalone
                onClose={() => {
                    window.close()
                }}
            />
        </div>
    )
}
