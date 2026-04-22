'use client'

import { useEffect, useState } from 'react'

interface SubmissionLog {
    attempt: number
    responseCode: number | null
    responseBody: unknown
    error: string | null
    durationMs: number | null
    createdAt: string
}

interface InvoiceDetail {
    id: string
    invoiceNumber: string
    status: string
    diStatus: string | null
    diStatusCode: string | null
    diInvoiceNumber: string | null
    diInvoiceDate: string | null
    diErrorCode: string | null
    diErrorMessage: string | null
    submissionError: string | null
    diItemStatuses: unknown
    latestSubmissionLog: SubmissionLog | null
}

interface Props {
    invoiceId: string
    onClose: () => void
}

const formatJson = (value: unknown) => {
    if (value == null) return '—'
    try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}

const cleanError = (msg: string | null | undefined) =>
    msg?.replace(/^(DIAuthError|DIConfigError|DIServerError|Error):\s*/i, '') ?? null

export default function InvoiceDIModal({ invoiceId, onClose }: Props) {
    const [data, setData] = useState<InvoiceDetail | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/invoices/${invoiceId}`)
                if (res.ok) {
                    const json = await res.json()
                    setData(json.invoice)
                }
            } catch { /* ignore */ } finally {
                setLoading(false)
            }
        }
        load()
    }, [invoiceId])

    const displayError = cleanError(
        data?.diErrorMessage || data?.submissionError || data?.latestSubmissionLog?.error,
    )

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className="app-panel relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">PRAL DI Response</p>
                        {data && <h2 className="mt-1 text-lg font-bold text-white">{data.invoiceNumber}</h2>}
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-[#8d897d] hover:bg-white/14 hover:text-white"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto p-6 space-y-4">
                    {loading ? (
                        <div className="animate-pulse space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-8 rounded bg-white/10" />
                            ))}
                        </div>
                    ) : !data ? (
                        <p className="text-center text-[#8d897d]">Invoice not found.</p>
                    ) : (
                        <>
                            {/* Status summary */}
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <InfoCell label="DI Status" value={data.diStatus || data.status} />
                                <InfoCell label="Status Code" mono value={data.diStatusCode || '—'} />
                                <InfoCell
                                    label="PRAL Invoice No."
                                    mono
                                    highlight
                                    value={data.diInvoiceNumber || '—'}
                                />
                                <InfoCell
                                    label="Confirmed At"
                                    value={data.diInvoiceDate
                                        ? new Date(data.diInvoiceDate).toLocaleString()
                                        : '—'}
                                />
                            </div>

                            {/* Error */}
                            {displayError && (
                                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 space-y-1">
                                    <p className="text-xs font-medium text-red-300">Error Details</p>
                                    <p className="text-sm text-red-200 whitespace-pre-wrap">{displayError}</p>
                                    {data.diErrorCode && (
                                        <p className="font-mono text-xs text-red-300/60">Code: {data.diErrorCode}</p>
                                    )}
                                </div>
                            )}

                            {/* Per-item statuses */}
                            <div>
                                <p className="mb-2 text-xs text-[#8d897d]">Per-item DI Statuses</p>
                                <pre className="max-h-52 overflow-auto rounded-lg border border-white/10 bg-[#0b1510] p-3 text-xs text-[#d8d0bf] whitespace-pre-wrap wrap-break-word">
                                    {formatJson(data.diItemStatuses)}
                                </pre>
                            </div>

                            {/* Latest PRAL response */}
                            {data.latestSubmissionLog?.responseBody != null && (
                                <div>
                                    <p className="mb-2 text-xs text-[#8d897d]">
                                        Latest PRAL Response
                                        {data.latestSubmissionLog.responseCode
                                            ? ` (${data.latestSubmissionLog.responseCode})`
                                            : ''}
                                        {data.latestSubmissionLog.durationMs != null
                                            ? ` · ${data.latestSubmissionLog.durationMs} ms`
                                            : ''}
                                        {` · Attempt #${data.latestSubmissionLog.attempt}`}
                                    </p>
                                    <pre className="max-h-72 overflow-auto rounded-lg border border-white/10 bg-[#0b1510] p-3 text-xs text-[#d8d0bf] whitespace-pre-wrap wrap-break-word">
                                        {formatJson(data.latestSubmissionLog.responseBody)}
                                    </pre>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

function InfoCell({
    label,
    value,
    mono = false,
    highlight = false,
}: {
    label: string
    value: string
    mono?: boolean
    highlight?: boolean
}) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/4 p-3">
            <p className="mb-1 text-xs text-[#8d897d]">{label}</p>
            <p
                className={`break-all text-sm font-medium ${highlight ? 'text-green-400' : 'text-white'} ${mono ? 'font-mono' : ''}`}
            >
                {value}
            </p>
        </div>
    )
}
