'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Download, FileSpreadsheet, Play, Square, Upload } from 'lucide-react'
import {
    formatAmount, formatCnic, formatDay, primaryButton, readError, secondaryButton,
} from '../ledger-import/types'

// Pause between FBR calls so PRAL is not hit in a burst.
const SUBMIT_GAP_MS = 2000

interface PlannedInvoice {
    key: string
    sheetInvoiceNo: string | null
    invoiceDate: string
    buyerName: string
    buyerCnic: string | null
    lines: Array<{ rowNumber: number; productName: string; hsCode: string; quantity: number; uom: string; lineTotal: number }>
    totalAmount: number
    issues: string[]
}

interface Preview {
    file: File
    invoices: PlannedInvoice[]
    errors: string[]
    existingBatchId: string | null
}

interface BatchInvoice {
    id: string
    invoiceNumber: string
    invoiceDate: string
    buyerName: string | null
    buyerNTN: string | null
    lineCount: number
    totalAmount: number
    status: string
    diInvoiceNumber: string | null
    error: string | null
}

interface Batch {
    id: string
    fileName: string
    createdAt: string
    totalAmount: number
    invoices: BatchInvoice[]
}

interface BatchSummary {
    id: string
    fileName: string
    createdAt: string
    invoiceCount: number
    confirmedCount: number
    totalAmount: number
}

type Mode = 'confirm' | 'validate'
type RowState = { phase: 'waiting' | 'working' | 'done' | 'failed'; message?: string }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Pulls a readable message out of /api/invoices/[id]/action responses. */
function actionError(data: unknown, fallback: string): string {
    const d = data as { errors?: Array<{ code?: string; message?: string; item?: string }>; eligibility?: { issues?: Array<{ message: string }> }; error?: string } | null
    if (d?.errors?.length) return d.errors.map((e) => `${e.item ? `Item ${e.item}: ` : ''}${e.message ?? e.code}`).join('; ')
    if (d?.eligibility?.issues?.length) return d.eligibility.issues.map((issue) => issue.message).join('; ')
    return d?.error || fallback
}

const STATUS_STYLE: Record<string, string> = {
    CONFIRMED: 'bg-success-bg text-success',
    VALIDATED: 'bg-blue-50 text-blue-700',
    FAILED: 'bg-error-bg text-error',
}

export default function DirectInvoicesPage() {
    const [batches, setBatches] = useState<BatchSummary[]>([])
    const [disabled, setDisabled] = useState<string | null>(null)
    const [preview, setPreview] = useState<Preview | null>(null)
    const [batch, setBatch] = useState<Batch | null>(null)
    const [busy, setBusy] = useState(false)
    const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
    const [mode, setMode] = useState<Mode>('confirm')
    const [running, setRunning] = useState(false)
    const [rowState, setRowState] = useState<Record<string, RowState>>({})
    const stopRef = useRef(false)
    const fileInput = useRef<HTMLInputElement>(null)

    const loadBatches = useCallback(async () => {
        const res = await fetch('/api/tenant/direct-invoices').catch(() => null)
        if (!res) return
        if (res.status === 403) return setDisabled(await readError(res, 'Direct invoices are not enabled for your account.'))
        if (res.ok) setBatches((await res.json()).batches ?? [])
    }, [])

    useEffect(() => { loadBatches() }, [loadBatches])

    async function openBatch(id: string) {
        setNotice(null)
        const res = await fetch(`/api/tenant/direct-invoices/${id}`)
        if (!res.ok) return setNotice({ type: 'error', text: await readError(res, 'Failed to open the upload.') })
        setBatch((await res.json()).batch)
        setPreview(null)
        setRowState({})
    }

    async function choose(file: File) {
        setNotice(null)
        setBusy(true)
        try {
            const form = new FormData()
            form.append('file', file)
            const res = await fetch('/api/tenant/direct-invoices/preview', { method: 'POST', body: form })
            if (!res.ok) return setNotice({ type: 'error', text: await readError(res, 'Could not read the file.') })
            const data = await res.json()
            setPreview({ file, invoices: data.invoices, errors: data.errors, existingBatchId: data.existingBatchId })
        } catch {
            setNotice({ type: 'error', text: 'Network error. Please try again.' })
        } finally {
            setBusy(false)
            if (fileInput.current) fileInput.current.value = ''
        }
    }

    async function createInvoices() {
        if (!preview) return
        setNotice(null)
        setBusy(true)
        try {
            const form = new FormData()
            form.append('file', preview.file)
            const res = await fetch('/api/tenant/direct-invoices', { method: 'POST', body: form })
            const data = await res.json().catch(() => null)
            if (!res.ok) {
                setNotice({ type: 'error', text: data?.error || `Failed to create invoices (${res.status}).` })
                return
            }
            setBatch(data.batch)
            setPreview(null)
            setRowState({})
            setNotice(data.resumed
                ? { type: 'info', text: 'This file was uploaded before; its invoices are shown instead of creating them again.' }
                : { type: 'success', text: `${data.batch.invoices.length} draft invoice(s) created. Start submission below.` })
            loadBatches()
        } catch {
            setNotice({ type: 'error', text: 'Network error. Please try again.' })
        } finally {
            setBusy(false)
        }
    }

    const pending = batch?.invoices.filter((invoice) => invoice.status !== 'CONFIRMED' && !(mode === 'validate' && invoice.status === 'VALIDATED')) ?? []

    async function run() {
        if (!batch || !pending.length) return
        setNotice(null)
        setRunning(true)
        stopRef.current = false
        setRowState(Object.fromEntries(pending.map((invoice) => [invoice.id, { phase: 'waiting' } as RowState])))

        let ok = 0
        let failed = 0
        for (const [index, invoice] of pending.entries()) {
            if (stopRef.current) break
            if (index > 0) await sleep(SUBMIT_GAP_MS)
            if (stopRef.current) break

            setRowState((current) => ({ ...current, [invoice.id]: { phase: 'working' } }))
            try {
                const res = await fetch(`/api/invoices/${invoice.id}/action`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: mode }),
                })
                const data = await res.json().catch(() => null)
                const success = res.ok && data?.valid !== false
                if (success) {
                    ok++
                    setRowState((current) => ({ ...current, [invoice.id]: { phase: 'done', message: data?.diInvoiceNumber ?? undefined } }))
                } else {
                    failed++
                    const message = actionError(data, `FBR returned ${res.status}`)
                    setRowState((current) => ({ ...current, [invoice.id]: { phase: 'failed', message } }))
                    // Token / IP problems fail every invoice the same way — stop instead of hammering FBR.
                    if (res.status === 401) {
                        stopRef.current = true
                        setNotice({ type: 'error', text: message })
                    }
                }
            } catch {
                failed++
                setRowState((current) => ({ ...current, [invoice.id]: { phase: 'failed', message: 'Network error' } }))
            }
        }

        setRunning(false)
        const res = await fetch(`/api/tenant/direct-invoices/${batch.id}`).catch(() => null)
        if (res?.ok) setBatch((await res.json()).batch)
        loadBatches()
        setNotice((current) => current ?? {
            type: failed ? 'error' : 'success',
            text: `${mode === 'confirm' ? 'Submitted' : 'Validated'} ${ok} invoice(s)${failed ? `, ${failed} failed — fix them on the Invoices page and run again` : ''}${stopRef.current ? ' (stopped)' : ''}.`,
        })
    }

    if (disabled) {
        return <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-white p-8 text-center text-sm text-muted">{disabled}</div>
    }

    return (
        <div className="mx-auto max-w-6xl space-y-4">
            <div>
                <h1 className="text-xl font-semibold text-ink">Direct Invoices</h1>
                <p className="mt-0.5 text-sm text-muted">
                    Upload the filled template: every row becomes a sale line exactly as written. Invoices are validated and submitted to FBR one by one, {SUBMIT_GAP_MS / 1000} seconds apart.
                </p>
            </div>

            {notice && (
                <div className={`rounded-xl border px-4 py-2.5 text-xs font-medium ${notice.type === 'error' ? 'border-error-border bg-error-bg text-error' : notice.type === 'success' ? 'border-success-border bg-success-bg text-success' : 'border-border bg-surface-subtle text-ink'}`}>
                    {notice.text}
                </div>
            )}

            {!preview && !batch && (
                <>
                    <div className="rounded-2xl border-2 border-dashed border-border bg-white p-8 text-center">
                        <FileSpreadsheet className="mx-auto text-primary" size={28} />
                        <p className="mt-2 text-sm font-semibold text-ink">Upload the filled template</p>
                        <p className="mt-1 text-xs text-muted">Rows with the same Invoice No. become one invoice; customer by Name + CNIC, walk-in when blank.</p>
                        <input ref={fileInput} type="file" accept=".xls,.xlsx,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) choose(f) }} />
                        <button type="button" className={`${primaryButton} mt-4`} disabled={busy} onClick={() => fileInput.current?.click()}>
                            <Upload size={15} />
                            {busy ? 'Reading…' : 'Choose file'}
                        </button>
                        <p className="mt-3 text-xs">
                            <a href="/api/tenant/ledger-imports/template" download className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                                <Download size={12} />
                                Download template
                            </a>
                        </p>
                    </div>

                    <div className="rounded-2xl border border-border bg-white shadow-xs">
                        <div className="border-b border-border px-5 py-3.5"><h2 className="text-sm font-semibold text-ink">Previous uploads</h2></div>
                        {batches.length === 0 ? (
                            <p className="p-8 text-center text-sm text-muted">No uploads yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[600px] text-sm">
                                    <thead className="bg-surface-subtle text-left text-xs text-muted">
                                        <tr><th className="px-5 py-2">File</th><th className="px-3 py-2">Uploaded</th><th className="px-3 py-2 text-right">Invoices</th><th className="px-3 py-2 text-right">Submitted</th><th className="px-5 py-2 text-right">Total</th></tr>
                                    </thead>
                                    <tbody>
                                        {batches.map((b) => (
                                            <tr key={b.id} className="cursor-pointer border-t border-border hover:bg-surface-subtle" onClick={() => openBatch(b.id)}>
                                                <td className="px-5 py-2.5 font-medium text-ink">{b.fileName}</td>
                                                <td className="px-3 py-2.5 text-muted">{formatDay(b.createdAt)}</td>
                                                <td className="px-3 py-2.5 text-right">{b.invoiceCount}</td>
                                                <td className="px-3 py-2.5 text-right">{b.confirmedCount} / {b.invoiceCount}</td>
                                                <td className="px-5 py-2.5 text-right">Rs {formatAmount(b.totalAmount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {preview && (
                <div className="space-y-4">
                    {preview.errors.length > 0 && (
                        <div className="rounded-xl border border-error-border bg-error-bg px-4 py-3 text-xs text-error">
                            <p className="font-semibold">Fix these in the sheet and upload it again — nothing has been created.</p>
                            <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                                {preview.errors.slice(0, 30).map((error) => <li key={error}>{error}</li>)}
                                {preview.errors.length > 30 && <li>…and {preview.errors.length - 30} more</li>}
                            </ul>
                        </div>
                    )}
                    {preview.existingBatchId && (
                        <div className="rounded-xl border border-border bg-surface-subtle px-4 py-2.5 text-xs text-ink">
                            This exact file was uploaded before.{' '}
                            <button type="button" className="font-medium text-primary hover:underline" onClick={() => openBatch(preview.existingBatchId!)}>Open that upload</button>
                            {' '}to continue submitting its invoices.
                        </div>
                    )}

                    <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-xs">
                        <table className="w-full min-w-[720px] text-sm">
                            <thead className="bg-surface-subtle text-left text-xs text-muted">
                                <tr><th className="px-5 py-2">Sheet invoice</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Buyer</th><th className="px-3 py-2">Items</th><th className="px-5 py-2 text-right">Total (incl. tax)</th></tr>
                            </thead>
                            <tbody>
                                {preview.invoices.map((invoice) => (
                                    <tr key={invoice.key} className={`border-t border-border align-top ${invoice.issues.length ? 'bg-error-bg/40' : ''}`}>
                                        <td className="px-5 py-2.5 font-medium text-ink">{invoice.sheetInvoiceNo ?? `Row ${invoice.lines[0]?.rowNumber}`}</td>
                                        <td className="px-3 py-2.5 text-muted">{formatDay(invoice.invoiceDate)}</td>
                                        <td className="px-3 py-2.5">
                                            {invoice.buyerName}
                                            {invoice.buyerCnic && <span className="block text-xs text-muted">{formatCnic(invoice.buyerCnic)}</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-muted">
                                            {invoice.lines.map((line) => <span key={line.rowNumber} className="block">{line.productName} · {line.hsCode} · {line.quantity} {line.uom}</span>)}
                                        </td>
                                        <td className="px-5 py-2.5 text-right font-medium">Rs {formatAmount(invoice.totalAmount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between">
                        <button type="button" className={secondaryButton} onClick={() => setPreview(null)}><ArrowLeft size={15} />Back</button>
                        <button type="button" className={primaryButton} disabled={busy || preview.errors.length > 0 || Boolean(preview.existingBatchId)} onClick={createInvoices}>
                            {busy ? 'Creating…' : `Create ${preview.invoices.length} invoice(s)`}
                        </button>
                    </div>
                </div>
            )}

            {batch && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-4 shadow-xs">
                        <div className="text-sm">
                            <p className="font-semibold text-ink">{batch.fileName}</p>
                            <p className="text-xs text-muted">
                                {batch.invoices.filter((i) => i.status === 'CONFIRMED').length} of {batch.invoices.length} submitted · Rs {formatAmount(batch.totalAmount)}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <select className="rounded-lg border border-border bg-white px-3 py-2 text-sm" value={mode} disabled={running} onChange={(e) => setMode(e.target.value as Mode)}>
                                <option value="confirm">Validate &amp; submit to FBR</option>
                                <option value="validate">Validate only</option>
                            </select>
                            {running ? (
                                <button type="button" className={secondaryButton} onClick={() => { stopRef.current = true }}><Square size={15} />Stop</button>
                            ) : (
                                <button type="button" className={primaryButton} disabled={!pending.length} onClick={run}>
                                    <Play size={15} />
                                    {pending.length ? `${mode === 'confirm' ? 'Submit' : 'Validate'} ${pending.length} invoice(s)` : 'Nothing left to do'}
                                </button>
                            )}
                        </div>
                    </div>
                    {mode === 'confirm' && pending.length > 0 && !running && (
                        <p className="text-xs text-muted">Submitting reports each invoice to FBR and locks it; it cannot be undone. Each invoice is validated by FBR first and only posted if valid.</p>
                    )}

                    <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-xs">
                        <table className="w-full min-w-[760px] text-sm">
                            <thead className="bg-surface-subtle text-left text-xs text-muted">
                                <tr><th className="px-5 py-2">Invoice</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Buyer</th><th className="px-3 py-2 text-right">Lines</th><th className="px-3 py-2 text-right">Total</th><th className="px-5 py-2">FBR</th></tr>
                            </thead>
                            <tbody>
                                {batch.invoices.map((invoice) => {
                                    const state = rowState[invoice.id]
                                    return (
                                        <tr key={invoice.id} className="border-t border-border align-top">
                                            <td className="px-5 py-2.5 font-medium"><a href={`/invoices/${invoice.id}`} className="text-primary hover:underline">{invoice.invoiceNumber}</a></td>
                                            <td className="px-3 py-2.5 text-muted">{formatDay(invoice.invoiceDate)}</td>
                                            <td className="px-3 py-2.5">
                                                {invoice.buyerName}
                                                {invoice.buyerNTN && <span className="block text-xs text-muted">{formatCnic(invoice.buyerNTN)}</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-right">{invoice.lineCount}</td>
                                            <td className="px-3 py-2.5 text-right">Rs {formatAmount(invoice.totalAmount)}</td>
                                            <td className="px-5 py-2.5 text-xs">
                                                {state?.phase === 'working' ? <span className="font-medium text-primary">{mode === 'confirm' ? 'Submitting…' : 'Validating…'}</span>
                                                    : state?.phase === 'waiting' ? <span className="text-muted">Queued</span>
                                                        : state?.phase === 'done' ? <span className="font-medium text-success">{mode === 'confirm' ? `Submitted${state.message ? ` · ${state.message}` : ''}` : 'Valid'}</span>
                                                            : state?.phase === 'failed' ? <span className="text-error">{state.message}</span>
                                                                : (
                                                                    <>
                                                                        <span className={`inline-block rounded-md px-1.5 py-0.5 font-medium ${STATUS_STYLE[invoice.status] ?? 'bg-surface-subtle text-muted'}`}>{invoice.status}</span>
                                                                        {invoice.diInvoiceNumber && <span className="block text-muted">{invoice.diInvoiceNumber}</span>}
                                                                        {invoice.status !== 'CONFIRMED' && invoice.error && <span className="block text-error">{invoice.error}</span>}
                                                                    </>
                                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    <button type="button" className={secondaryButton} disabled={running} onClick={() => { setBatch(null); setRowState({}); setNotice(null) }}>
                        <ArrowLeft size={15} />All uploads
                    </button>
                </div>
            )}
        </div>
    )
}
