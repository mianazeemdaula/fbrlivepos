'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Lock, Save } from 'lucide-react'
import {
    formatAmount, formatDay, formatQty, inputClass, primaryButton, readError, secondaryButton,
    type LedgerImportDetail, type LedgerItem,
} from './types'

type Edits = Record<string, { productName?: string; saleUnitPrice?: string; retailUnitPrice?: string }>

export default function StockStep({
    ledger,
    onUpdated,
    onNext,
}: {
    ledger: LedgerImportDetail
    onUpdated: (ledger: LedgerImportDetail, message?: string) => void
    onNext: () => void
}) {
    const [edits, setEdits] = useState<Edits>({})
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const dirtyIds = Object.keys(edits)
    const hasPendingDrafts = ledger.drafts.some((draft) => draft.status === 'DRAFT')

    const totalAvailable = useMemo(() => ledger.items.reduce((sum, item) => sum + item.availableQuantity, 0), [ledger.items])

    function setField(item: LedgerItem, field: keyof Edits[string], value: string) {
        setEdits((current) => ({ ...current, [item.id]: { ...current[item.id], [field]: value } }))
    }

    function fieldValue(item: LedgerItem, field: 'productName' | 'saleUnitPrice' | 'retailUnitPrice') {
        const edited = edits[item.id]?.[field]
        if (edited !== undefined) return edited
        const value = item[field]
        return value == null ? '' : String(value)
    }

    async function save() {
        setError(null)
        const items = dirtyIds.map((id) => {
            const edit = edits[id]
            return {
                id,
                ...(edit.productName !== undefined ? { productName: edit.productName } : {}),
                ...(edit.saleUnitPrice !== undefined ? { saleUnitPrice: Number(edit.saleUnitPrice) } : {}),
                ...(edit.retailUnitPrice !== undefined ? { retailUnitPrice: edit.retailUnitPrice === '' ? null : Number(edit.retailUnitPrice) } : {}),
            }
        })
        if (items.some((item) => ('saleUnitPrice' in item && !(Number(item.saleUnitPrice) > 0)) || ('retailUnitPrice' in item && item.retailUnitPrice != null && Number.isNaN(item.retailUnitPrice)))) {
            setError('Prices must be valid numbers greater than zero.')
            return
        }

        setSaving(true)
        try {
            const res = await fetch(`/api/tenant/ledger-imports/${ledger.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items }),
            })
            if (!res.ok) {
                setError(await readError(res, 'Failed to save changes.'))
                return
            }
            const data = await res.json()
            setEdits({})
            onUpdated(
                data.import,
                data.discardedDrafts
                    ? `Saved. ${data.discardedDrafts} pending draft(s) used the old prices and were discarded — generate them again.`
                    : 'Changes saved.',
            )
        } catch {
            setError('Network error. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                <Stat label="Ledger rows" value={String(ledger.sourceRowCount)} />
                <Stat label="Purchase invoices" value={String(ledger.sourceInvoiceCount)} />
                <Stat label="Suppliers" value={String(ledger.sellerCount)} />
                <Stat label="Period" value={`${formatDay(ledger.periodFrom)} – ${formatDay(ledger.periodTo)}`} small />
                <Stat label="Total quantity" value={formatQty(ledger.totalQuantity)} />
                <Stat label="Value excl. tax" value={formatAmount(ledger.totalValueExclST)} />
                <Stat label="Sales tax paid" value={formatAmount(ledger.totalSalesTax)} />
            </div>

            <div className="rounded-2xl border border-border bg-white shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
                    <div>
                        <h2 className="text-sm font-semibold text-ink">Stock by HS code</h2>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                            <Lock size={12} />
                            HS code, sale type, rate, UoM, SRO and item no. are locked to the IRIS ledger. Description and prices are editable.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {dirtyIds.length > 0 && (
                            <button className={secondaryButton} onClick={() => setEdits({})} disabled={saving}>Reset</button>
                        )}
                        <button className={secondaryButton} onClick={save} disabled={saving || dirtyIds.length === 0}>
                            <Save size={14} />
                            {saving ? 'Saving…' : 'Save changes'}
                        </button>
                    </div>
                </div>

                {hasPendingDrafts && dirtyIds.length > 0 && (
                    <div className="border-b border-amber-200 bg-warning-bg px-5 py-2 text-xs font-medium text-warning">
                        Changing a price discards the pending drafts; you will need to generate them again.
                    </div>
                )}
                {error && <div className="border-b border-error-border bg-error-bg px-5 py-2 text-xs font-medium text-error">{error}</div>}

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px] text-sm">
                        <thead>
                            <tr className="border-b border-border bg-surface-subtle text-left text-xs font-medium text-muted">
                                <th className="px-4 py-2.5">HS Code</th>
                                <th className="px-4 py-2.5">Product description</th>
                                <th className="px-4 py-2.5">Sale type / Rate</th>
                                <th className="px-4 py-2.5">UoM</th>
                                <th className="px-4 py-2.5">SRO / Item No.</th>
                                <th className="px-4 py-2.5 text-right">Qty (available)</th>
                                <th className="px-4 py-2.5 text-right">Purchase value</th>
                                <th className="px-4 py-2.5 text-right">Sale price / unit</th>
                                <th className="px-4 py-2.5 text-right">Retail price / unit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ledger.items.map((item) => (
                                <tr key={item.id} className="border-b border-border align-top last:border-0">
                                    <td className="px-4 py-3">
                                        <p className="font-mono text-xs font-semibold text-ink">{item.hsCode}</p>
                                        <p className="mt-0.5 text-[11px] text-muted">{item.sourceRowCount} row(s)</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <input
                                            className={inputClass}
                                            value={fieldValue(item, 'productName')}
                                            onChange={(e) => setField(item, 'productName', e.target.value)}
                                            list={`desc-${item.id}`}
                                        />
                                        <datalist id={`desc-${item.id}`}>
                                            {item.sourceDescriptions.map((d) => <option key={d} value={d} />)}
                                        </datalist>
                                        {item.issues.length > 0 && (
                                            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-error">
                                                <AlertTriangle size={11} />
                                                {item.issues.join(' · ')}
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-ink">
                                        <p>{item.saleType}</p>
                                        <p className="mt-0.5 font-semibold">{item.rate}</p>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-ink">{item.uom}</td>
                                    <td className="px-4 py-3 text-xs text-ink">
                                        <p>{item.sroScheduleNo || '—'}</p>
                                        <p className="mt-0.5 text-muted">{item.sroItemSerialNo || '—'}</p>
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs">
                                        <p className="font-semibold text-ink">{formatQty(item.totalQuantity)}</p>
                                        <p className={`mt-0.5 ${item.availableQuantity > 0 ? 'text-success' : 'text-muted'}`}>
                                            {formatQty(item.availableQuantity)} left
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs">
                                        <p className="text-ink">{formatAmount(item.purchaseValueExclST)}</p>
                                        <p className="mt-0.5 text-muted">ST {formatAmount(item.purchaseSalesTax)}</p>
                                    </td>
                                    <td className="w-36 px-4 py-3">
                                        <input
                                            className={`${inputClass} text-right`}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={fieldValue(item, 'saleUnitPrice')}
                                            onChange={(e) => setField(item, 'saleUnitPrice', e.target.value)}
                                        />
                                        <p className="mt-0.5 text-right text-[11px] text-muted">
                                            cost {formatAmount(item.purchaseValueExclST / item.totalQuantity)}
                                        </p>
                                    </td>
                                    <td className="w-36 px-4 py-3">
                                        <input
                                            className={`${inputClass} text-right`}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="—"
                                            value={fieldValue(item, 'retailUnitPrice')}
                                            onChange={(e) => setField(item, 'retailUnitPrice', e.target.value)}
                                        />
                                        {item.purchaseRetailValue > 0 && (
                                            <p className="mt-0.5 text-right text-[11px] text-muted">
                                                ledger {formatAmount(item.purchaseRetailValue / item.totalQuantity)}
                                            </p>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted">
                    <span>
                        {ledger.items.length} product line(s) · {formatQty(totalAvailable)} units still available
                    </span>
                    <span>Sales tax on lines with a retail price is charged on the retail price (3rd Schedule).</span>
                </div>
            </div>

            <div className="flex justify-end">
                <button className={primaryButton} onClick={onNext} disabled={dirtyIds.length > 0}>
                    {dirtyIds.length > 0 ? 'Save changes to continue' : 'Next: generate drafts'}
                    <ArrowRight size={15} />
                </button>
            </div>
        </div>
    )
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
    return (
        <div className="rounded-xl border border-border bg-white p-3.5 shadow-xs">
            <p className="text-[11px] font-medium text-muted">{label}</p>
            <p className={`mt-1 font-semibold text-ink ${small ? 'text-xs' : 'text-base'}`}>{value}</p>
        </div>
    )
}
