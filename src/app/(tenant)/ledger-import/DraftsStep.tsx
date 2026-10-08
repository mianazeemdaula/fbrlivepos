'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, FilePlus2, RefreshCw, Send, Trash2 } from 'lucide-react'
import {
    formatAmount, formatDay, formatQty, primaryButton, readError, secondaryButton,
    type LedgerDraft, type LedgerImportDetail,
} from './types'

const SUBMITTABLE_STATUSES = new Set(['DRAFT', 'VALIDATED', 'FAILED'])
const CREATE_BATCH = 50

type Filter = 'all' | 'pending' | 'created'

interface Progress {
    label: string
    done: number
    total: number
}

function isSelectable(draft: LedgerDraft) {
    return draft.status === 'DRAFT' || (draft.invoice != null && SUBMITTABLE_STATUSES.has(draft.invoice.status))
}

export default function DraftsStep({
    ledger,
    warnings,
    onUpdated,
    onRegenerate,
}: {
    ledger: LedgerImportDetail
    warnings: string[]
    onUpdated: (ledger: LedgerImportDetail, message?: string) => void
    onRegenerate: () => void
}) {
    const [filter, setFilter] = useState<Filter>('all')
    const [selected, setSelected] = useState<Set<string>>(() => new Set(ledger.drafts.filter((d) => d.status === 'DRAFT').map((d) => d.id)))
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [progress, setProgress] = useState<Progress | null>(null)
    const [confirmSubmit, setConfirmSubmit] = useState(false)
    const [errors, setErrors] = useState<string[]>([])
    const [environment, setEnvironment] = useState<'SANDBOX' | 'PRODUCTION' | null>(null)

    useEffect(() => {
        fetch('/api/tenant/fbr-credentials')
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => { if (data?.environment) setEnvironment(data.environment) })
            .catch(() => {})
    }, [])

    // Drop selections that no longer apply after a reload.
    useEffect(() => {
        setSelected((current) => new Set(ledger.drafts.filter((d) => current.has(d.id) && isSelectable(d)).map((d) => d.id)))
    }, [ledger.drafts])

    const visible = ledger.drafts.filter((draft) =>
        filter === 'all' ? true : filter === 'pending' ? draft.status === 'DRAFT' : draft.status === 'CREATED')
    const selectableVisible = visible.filter(isSelectable)

    const selection = useMemo(() => {
        const rows = ledger.drafts.filter((draft) => selected.has(draft.id))
        return {
            pending: rows.filter((d) => d.status === 'DRAFT'),
            unsubmitted: rows.filter((d) => d.status === 'CREATED'),
            subtotal: rows.reduce((sum, d) => sum + d.subtotal, 0),
            tax: rows.reduce((sum, d) => sum + d.taxAmount, 0),
            total: rows.reduce((sum, d) => sum + d.totalAmount, 0),
            count: rows.length,
        }
    }, [ledger.drafts, selected])

    const counts = {
        pending: ledger.drafts.filter((d) => d.status === 'DRAFT').length,
        created: ledger.drafts.filter((d) => d.status === 'CREATED').length,
    }

    function toggle(id: string) {
        setSelected((current) => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function toggleAll() {
        const allSelected = selectableVisible.every((d) => selected.has(d.id))
        setSelected((current) => {
            const next = new Set(current)
            for (const d of selectableVisible) {
                if (allSelected) next.delete(d.id)
                else next.add(d.id)
            }
            return next
        })
    }

    async function reload(message?: string) {
        const res = await fetch(`/api/tenant/ledger-imports/${ledger.id}`)
        if (res.ok) onUpdated((await res.json()).import, message)
    }

    async function createInvoices(draftIds: string[], issues: string[]) {
        const created: string[] = []
        for (let i = 0; i < draftIds.length; i += CREATE_BATCH) {
            const batch = draftIds.slice(i, i + CREATE_BATCH)
            setProgress({ label: 'Creating invoices', done: i, total: draftIds.length })
            const res = await fetch(`/api/tenant/ledger-imports/${ledger.id}/drafts/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ draftIds: batch }),
            })
            const data = await res.json().catch(() => null)
            if (!res.ok && !data?.created?.length) {
                issues.push(data?.error || `Failed to create invoices (${res.status}).`)
                break
            }
            created.push(...(data.created ?? []).map((c: { invoiceId: string }) => c.invoiceId))
            for (const failure of data.failed ?? []) issues.push(`Draft ${failure.draftId}: ${failure.error}`)
        }
        return created
    }

    async function submitInvoices(invoiceIds: string[], issues: string[]) {
        let submitted = 0
        for (const [index, invoiceId] of invoiceIds.entries()) {
            setProgress({ label: 'Submitting to FBR', done: index, total: invoiceIds.length })
            try {
                const res = await fetch(`/api/invoices/${invoiceId}/action`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'confirm' }),
                })
                if (res.ok) submitted++
                else issues.push(await readError(res, `Submission failed (${res.status}).`))
            } catch {
                issues.push('Network error during submission.')
            }
        }
        return submitted
    }

    async function run(submit: boolean) {
        setConfirmSubmit(false)
        setErrors([])
        const issues: string[] = []
        try {
            const created = selection.pending.length
                ? await createInvoices(selection.pending.map((d) => d.id), issues)
                : []
            let message = created.length ? `${created.length} invoice(s) created.` : ''

            if (submit) {
                const toSubmit = [...selection.unsubmitted.map((d) => d.invoice!.id), ...created]
                const submitted = await submitInvoices(toSubmit, issues)
                message = `${message} ${submitted} of ${toSubmit.length} submitted to FBR.`.trim()
            }
            await reload(message || undefined)
        } finally {
            setProgress(null)
            setErrors(issues)
        }
    }

    async function discard() {
        setErrors([])
        setProgress({ label: 'Discarding drafts', done: 0, total: selection.pending.length })
        try {
            const res = await fetch(`/api/tenant/ledger-imports/${ledger.id}/drafts`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ draftIds: selection.pending.map((d) => d.id) }),
            })
            if (!res.ok) {
                setErrors([await readError(res, 'Failed to discard drafts.')])
                return
            }
            const data = await res.json()
            onUpdated(data.import, `${data.discarded} draft(s) discarded; their stock is available again.`)
        } finally {
            setProgress(null)
        }
    }

    const busy = progress !== null
    const submitCount = selection.pending.length + selection.unsubmitted.length

    return (
        <div className="space-y-4">
            {warnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-warning-bg px-4 py-3 text-xs font-medium text-warning">
                    <ul className="list-disc space-y-0.5 pl-4">
                        {warnings.map((w) => <li key={w}>{w}</li>)}
                    </ul>
                </div>
            )}

            <div className="rounded-2xl border border-border bg-white shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
                    <div className="flex items-center gap-1 rounded-lg bg-surface p-1 text-xs font-medium">
                        {([['all', `All (${ledger.drafts.length})`], ['pending', `Drafts (${counts.pending})`], ['created', `Created (${counts.created})`]] as const).map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setFilter(key)}
                                className={`rounded-md px-3 py-1.5 transition-colors ${filter === key ? 'bg-white text-ink shadow-xs' : 'text-muted hover:text-ink'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <button type="button" className={secondaryButton} onClick={onRegenerate} disabled={busy}>
                        <RefreshCw size={14} />
                        Generate again
                    </button>
                </div>

                {ledger.drafts.length === 0 ? (
                    <div className="p-12 text-center text-sm text-muted">
                        No drafts yet. <button className="font-medium text-primary hover:underline" onClick={onRegenerate}>Generate drafts</button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-sm">
                            <thead>
                                <tr className="border-b border-border bg-surface-subtle text-left text-xs font-medium text-muted">
                                    <th className="w-10 px-4 py-2.5">
                                        <input
                                            type="checkbox"
                                            aria-label="Select all"
                                            checked={selectableVisible.length > 0 && selectableVisible.every((d) => selected.has(d.id))}
                                            onChange={toggleAll}
                                            disabled={busy || selectableVisible.length === 0}
                                        />
                                    </th>
                                    <th className="px-2 py-2.5">#</th>
                                    <th className="px-4 py-2.5">Date</th>
                                    <th className="px-4 py-2.5">Buyer</th>
                                    <th className="px-4 py-2.5">Products</th>
                                    <th className="px-4 py-2.5 text-right">Value excl. tax</th>
                                    <th className="px-4 py-2.5 text-right">Sales tax</th>
                                    <th className="px-4 py-2.5 text-right">Total</th>
                                    <th className="px-4 py-2.5">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((draft) => {
                                    const open = expanded.has(draft.id)
                                    return (
                                        <Fragment key={draft.id}>
                                            <tr className={`border-b border-border ${selected.has(draft.id) ? 'bg-primary-light/40' : ''}`}>
                                                <td className="px-4 py-2.5">
                                                    <input
                                                        type="checkbox"
                                                        aria-label={`Select draft ${draft.sequence}`}
                                                        checked={selected.has(draft.id)}
                                                        disabled={busy || !isSelectable(draft)}
                                                        onChange={() => toggle(draft.id)}
                                                    />
                                                </td>
                                                <td className="px-2 py-2.5 text-xs text-muted">{draft.sequence}</td>
                                                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink">{formatDay(draft.invoiceDate)}</td>
                                                <td className="px-4 py-2.5 text-xs text-ink">
                                                    {draft.buyerName || 'Walk-in Customer'}
                                                    {draft.buyerNTN && <span className="block text-muted">{draft.buyerNTN}</span>}
                                                </td>
                                                <td className="px-4 py-2.5 text-xs">
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center gap-1 text-ink hover:text-primary"
                                                        onClick={() => setExpanded((cur) => {
                                                            const next = new Set(cur)
                                                            if (next.has(draft.id)) next.delete(draft.id)
                                                            else next.add(draft.id)
                                                            return next
                                                        })}
                                                    >
                                                        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                                        {draft.lines.length} line(s) · {formatQty(draft.lines.reduce((s, l) => s + l.quantity, 0))} qty
                                                    </button>
                                                </td>
                                                <td className="px-4 py-2.5 text-right text-xs text-ink">{formatAmount(draft.subtotal)}</td>
                                                <td className="px-4 py-2.5 text-right text-xs text-ink">{formatAmount(draft.taxAmount)}</td>
                                                <td className="px-4 py-2.5 text-right text-xs font-semibold text-ink">{formatAmount(draft.totalAmount)}</td>
                                                <td className="px-4 py-2.5 text-xs">
                                                    {draft.invoice ? (
                                                        <Link href={`/invoices/${draft.invoice.id}`} className="font-medium text-primary hover:underline">
                                                            {draft.invoice.invoiceNumber}
                                                            <span className="ml-1.5 rounded bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted">{draft.invoice.status}</span>
                                                        </Link>
                                                    ) : (
                                                        <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-semibold text-warning">Draft</span>
                                                    )}
                                                </td>
                                            </tr>
                                            {open && (
                                                <tr className="border-b border-border bg-surface-subtle">
                                                    <td colSpan={9} className="px-12 py-2.5">
                                                        <table className="w-full text-xs">
                                                            <thead>
                                                                <tr className="text-left text-muted">
                                                                    <th className="py-1">HS Code</th>
                                                                    <th className="py-1">Description</th>
                                                                    <th className="py-1 text-right">Qty</th>
                                                                    <th className="py-1 text-right">Rate</th>
                                                                    <th className="py-1 text-right">Retail value</th>
                                                                    <th className="py-1 text-right">Value excl.</th>
                                                                    <th className="py-1 text-right">Sales tax</th>
                                                                    <th className="py-1 text-right">Total</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {draft.lines.map((line) => (
                                                                    <tr key={line.itemId} className="text-ink">
                                                                        <td className="py-1 font-mono">{line.hsCode}</td>
                                                                        <td className="py-1">{line.productName}</td>
                                                                        <td className="py-1 text-right">{formatQty(line.quantity)} {line.uom}</td>
                                                                        <td className="py-1 text-right">{formatAmount(line.unitPrice)}</td>
                                                                        <td className="py-1 text-right">{line.retailValue != null ? formatAmount(line.retailValue) : '—'}</td>
                                                                        <td className="py-1 text-right">{formatAmount(line.valueExclST)}</td>
                                                                        <td className="py-1 text-right">{formatAmount(line.salesTax)}</td>
                                                                        <td className="py-1 text-right font-semibold">{formatAmount(line.lineTotal)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {errors.length > 0 && (
                <div className="rounded-xl border border-error-border bg-error-bg px-4 py-3 text-xs font-medium text-error">
                    <ul className="list-disc space-y-0.5 pl-4">
                        {errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                        {errors.length > 10 && <li>…and {errors.length - 10} more</li>}
                    </ul>
                </div>
            )}

            {/* Sticky action bar */}
            <div className="sticky bottom-0 z-10 rounded-2xl border border-border bg-white/95 px-5 py-3.5 shadow-card backdrop-blur">
                {progress ? (
                    <div>
                        <div className="mb-1.5 flex justify-between text-xs font-medium text-ink">
                            <span>{progress.label}…</span>
                            <span>{progress.done} / {progress.total}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                            <div className="h-full bg-primary transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
                        </div>
                    </div>
                ) : confirmSubmit ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-ink">
                            Submit <span className="font-semibold">{submitCount}</span> invoice(s) to FBR
                            {environment === 'PRODUCTION' ? <span className="font-semibold text-error"> in Live mode</span> : ' (sandbox)'}? Confirmed invoices are locked.
                        </p>
                        <div className="flex gap-2">
                            <button type="button" className={secondaryButton} onClick={() => setConfirmSubmit(false)}>Cancel</button>
                            <button type="button" className={primaryButton} onClick={() => run(true)}>
                                <Send size={14} />
                                Yes, submit
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-muted">
                            <span className="font-semibold text-ink">{selection.count}</span> selected · Value {formatAmount(selection.subtotal)} · Tax {formatAmount(selection.tax)} ·{' '}
                            <span className="font-semibold text-ink">Total Rs {formatAmount(selection.total)}</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" className={secondaryButton} onClick={discard} disabled={selection.pending.length === 0}>
                                <Trash2 size={14} />
                                Discard ({selection.pending.length})
                            </button>
                            <button type="button" className={secondaryButton} onClick={() => run(false)} disabled={selection.pending.length === 0}>
                                <FilePlus2 size={14} />
                                Create invoices ({selection.pending.length})
                            </button>
                            <button type="button" className={primaryButton} onClick={() => setConfirmSubmit(true)} disabled={submitCount === 0}>
                                <Send size={14} />
                                Create &amp; submit to FBR ({submitCount})
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
