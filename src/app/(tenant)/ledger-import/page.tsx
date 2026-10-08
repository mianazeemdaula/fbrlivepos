'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, FileSpreadsheet, Lock, Trash2, Upload, X } from 'lucide-react'
import StockStep from './StockStep'
import GenerateStep from './GenerateStep'
import DraftsStep from './DraftsStep'
import {
    formatAmount, formatDay, formatQty, primaryButton, readError,
    type LedgerImportDetail, type LedgerImportSummary,
} from './types'

type Step = 1 | 2 | 3

const STEPS: Array<{ step: Step; label: string }> = [
    { step: 1, label: 'Review stock' },
    { step: 2, label: 'Generate drafts' },
    { step: 3, label: 'Select & create invoices' },
]

export default function LedgerImportPage() {
    const [imports, setImports] = useState<LedgerImportSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [disabled, setDisabled] = useState<string | null>(null)
    const [ledger, setLedger] = useState<LedgerImportDetail | null>(null)
    const [step, setStep] = useState<Step>(1)
    const [warnings, setWarnings] = useState<string[]>([])
    const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
    const [uploading, setUploading] = useState(false)
    const [dragging, setDragging] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
    const fileInput = useRef<HTMLInputElement>(null)

    const loadImports = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/tenant/ledger-imports')
            if (res.status === 403) {
                setDisabled(await readError(res, 'Sales ledger import is not enabled for your account.'))
                return
            }
            if (res.ok) setImports((await res.json()).imports ?? [])
        } catch {
            // Ignore — list stays empty
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadImports()
    }, [loadImports])

    function openLedger(detail: LedgerImportDetail, nextStep?: Step) {
        setLedger(detail)
        setWarnings([])
        setStep(nextStep ?? (detail.drafts.length ? 3 : 1))
    }

    async function openImport(id: string) {
        setNotice(null)
        const res = await fetch(`/api/tenant/ledger-imports/${id}`)
        if (!res.ok) {
            setNotice({ type: 'error', text: await readError(res, 'Failed to open import.') })
            return
        }
        openLedger((await res.json()).import)
    }

    async function upload(file: File) {
        setNotice(null)
        setUploading(true)
        try {
            const form = new FormData()
            form.append('file', file)
            const res = await fetch('/api/tenant/ledger-imports', { method: 'POST', body: form })
            const data = await res.json().catch(() => null)
            if (!res.ok) {
                setNotice({ type: 'error', text: data?.error || `Upload failed (${res.status}).` })
                return
            }
            const notes: string[] = []
            if (data.duplicateRows?.length) notes.push(`${data.duplicateRows.length} row(s) were already imported earlier and were skipped`)
            if (data.skipped?.length) notes.push(`${data.skipped.length} row(s) were excluded (${data.skipped.slice(0, 3).map((s: { rowNumber: number; reason: string }) => `row ${s.rowNumber}: ${s.reason}`).join('; ')}${data.skipped.length > 3 ? '…' : ''})`)
            setNotice({
                type: notes.length ? 'info' : 'success',
                text: `Imported ${data.import.sourceRowCount} row(s) into ${data.import.items.length} product line(s).${notes.length ? ` ${notes.join('. ')}.` : ''}`,
            })
            openLedger(data.import, 1)
            loadImports()
        } catch {
            setNotice({ type: 'error', text: 'Network error during upload.' })
        } finally {
            setUploading(false)
            if (fileInput.current) fileInput.current.value = ''
        }
    }

    async function deleteImport(id: string) {
        setDeleteConfirm(null)
        const res = await fetch(`/api/tenant/ledger-imports/${id}`, { method: 'DELETE' })
        if (!res.ok) {
            setNotice({ type: 'error', text: await readError(res, 'Failed to delete import.') })
            return
        }
        setNotice({ type: 'success', text: 'Import deleted.' })
        loadImports()
    }

    function closeWizard() {
        setLedger(null)
        setWarnings([])
        loadImports()
    }

    function handleUpdated(detail: LedgerImportDetail, message?: string) {
        setLedger(detail)
        if (message) setNotice({ type: 'success', text: message })
    }

    if (disabled) {
        return (
            <div className="p-4 lg:p-6">
                <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-xs">
                    <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface">
                        <Lock size={18} className="text-muted" />
                    </span>
                    <h1 className="text-sm font-semibold text-ink">Sales Ledger Import</h1>
                    <p className="mt-1 text-xs text-muted">{disabled}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 lg:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    {ledger && (
                        <button onClick={closeWizard} className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
                            <ArrowLeft size={13} />
                            All imports
                        </button>
                    )}
                    <h1 className="text-page-title font-semibold tracking-tight text-ink">Sales Ledger Import</h1>
                    <p className="mt-0.5 text-ui-xs text-muted">
                        {ledger
                            ? <><FileSpreadsheet size={12} className="mr-1 inline" />{ledger.fileName}</>
                            : 'Upload the purchase ledger downloaded from FBR IRIS and turn the stock into sale invoices.'}
                    </p>
                </div>
            </div>

            {notice && (
                <div className={`mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs font-medium ${
                    notice.type === 'success' ? 'border-success-border bg-success-bg text-success'
                        : notice.type === 'error' ? 'border-error-border bg-error-bg text-error'
                            : 'border-amber-200 bg-warning-bg text-warning'
                }`}>
                    <span>{notice.text}</span>
                    <button onClick={() => setNotice(null)} aria-label="Dismiss" className="hover:opacity-75"><X size={14} /></button>
                </div>
            )}

            {ledger ? (
                <>
                    {/* Stepper */}
                    <ol className="mb-5 flex flex-wrap items-center gap-2">
                        {STEPS.map(({ step: s, label }, index) => {
                            const reachable = s === 1 || s === 2 || ledger.drafts.length > 0
                            return (
                                <li key={s} className="flex items-center gap-2">
                                    {index > 0 && <span className="h-px w-6 bg-border-strong" />}
                                    <button
                                        type="button"
                                        disabled={!reachable}
                                        onClick={() => setStep(s)}
                                        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                                            step === s ? 'border-primary bg-primary-light text-primary-dark' : 'border-border bg-white text-ink-secondary hover:bg-surface'
                                        }`}
                                    >
                                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${step === s ? 'bg-primary text-white' : step > s ? 'bg-success-bg text-success' : 'bg-surface text-muted'}`}>
                                            {step > s ? <Check size={11} /> : s}
                                        </span>
                                        {label}
                                    </button>
                                </li>
                            )
                        })}
                    </ol>

                    {step === 1 && <StockStep ledger={ledger} onUpdated={handleUpdated} onNext={() => setStep(2)} />}
                    {step === 2 && (
                        <GenerateStep
                            ledger={ledger}
                            onBack={() => setStep(1)}
                            onGenerated={(detail, nextWarnings, generated) => {
                                setLedger(detail)
                                setWarnings(nextWarnings)
                                setNotice({ type: 'success', text: `${generated} draft invoice(s) generated. Review and select the ones to create.` })
                                setStep(3)
                            }}
                        />
                    )}
                    {step === 3 && (
                        <DraftsStep ledger={ledger} warnings={warnings} onUpdated={handleUpdated} onRegenerate={() => setStep(2)} />
                    )}
                </>
            ) : (
                <div className="space-y-5">
                    {/* Upload */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault()
                            setDragging(false)
                            const file = e.dataTransfer.files?.[0]
                            if (file) upload(file)
                        }}
                        className={`rounded-2xl border-2 border-dashed bg-white p-10 text-center transition-colors ${dragging ? 'border-primary bg-primary-light/40' : 'border-border'}`}
                    >
                        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary-light text-primary">
                            <Upload size={20} />
                        </span>
                        <p className="text-sm font-semibold text-ink">Drop the IRIS ledger here</p>
                        <p className="mt-1 text-xs text-muted">.xls or .xlsx exactly as downloaded from IRIS (Domestic Invoices), up to 10 MB</p>
                        <input
                            ref={fileInput}
                            type="file"
                            accept=".xls,.xlsx,.csv"
                            className="hidden"
                            onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file) }}
                        />
                        <button type="button" className={`${primaryButton} mt-4`} disabled={uploading} onClick={() => fileInput.current?.click()}>
                            {uploading ? 'Reading ledger…' : 'Choose file'}
                        </button>
                    </div>

                    {/* Previous imports */}
                    <div className="rounded-2xl border border-border bg-white shadow-xs">
                        <div className="border-b border-border px-5 py-3.5">
                            <h2 className="text-sm font-semibold text-ink">Previous imports</h2>
                        </div>
                        {loading ? (
                            <div className="space-y-2 p-5">
                                {[0, 1].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-border" />)}
                            </div>
                        ) : imports.length === 0 ? (
                            <p className="p-8 text-center text-sm text-muted">No ledgers imported yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[760px] text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-surface-subtle text-left text-xs font-medium text-muted">
                                            <th className="px-5 py-2.5">File</th>
                                            <th className="px-4 py-2.5">Ledger period</th>
                                            <th className="px-4 py-2.5 text-right">Products</th>
                                            <th className="px-4 py-2.5 text-right">Quantity left</th>
                                            <th className="px-4 py-2.5 text-right">Value excl. tax</th>
                                            <th className="px-4 py-2.5 text-right">Invoices created</th>
                                            <th className="px-4 py-2.5" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {imports.map((item) => (
                                            <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-subtle">
                                                <td className="px-5 py-3">
                                                    <button onClick={() => openImport(item.id)} className="text-left font-medium text-ink hover:text-primary">
                                                        {item.fileName}
                                                    </button>
                                                    <p className="text-[11px] text-muted">Uploaded {formatDay(item.createdAt)} · {item.sourceRowCount} rows</p>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-ink">{formatDay(item.periodFrom)} – {formatDay(item.periodTo)}</td>
                                                <td className="px-4 py-3 text-right text-xs text-ink">{item.itemCount}</td>
                                                <td className="px-4 py-3 text-right text-xs">
                                                    <span className="font-semibold text-ink">{formatQty(item.remainingQuantity)}</span>
                                                    <span className="text-muted"> / {formatQty(item.totalQuantity)}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-xs text-ink">{formatAmount(item.totalValueExclST)}</td>
                                                <td className="px-4 py-3 text-right text-xs text-ink">{item.createdInvoiceCount}</td>
                                                <td className="px-4 py-3 text-right">
                                                    {deleteConfirm === item.id ? (
                                                        <span className="inline-flex gap-2 text-xs">
                                                            <button className="font-semibold text-error hover:underline" onClick={() => deleteImport(item.id)}>Delete</button>
                                                            <button className="text-muted hover:underline" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-3">
                                                            <button className="text-xs font-medium text-primary hover:underline" onClick={() => openImport(item.id)}>Open</button>
                                                            {item.createdInvoiceCount === 0 && (
                                                                <button aria-label="Delete import" className="text-muted hover:text-error" onClick={() => setDeleteConfirm(item.id)}>
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
