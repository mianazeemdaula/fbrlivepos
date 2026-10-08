'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Wand2 } from 'lucide-react'
import {
    formatAmount, formatQty, inputClass, primaryButton, readError, secondaryButton,
    type LedgerImportDetail,
} from './types'

interface CustomerOption {
    id: string
    name: string
    ntnCnic: string | null
}

// PKT calendar day as YYYY-MM-DD
function todayPKT() {
    return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export default function GenerateStep({
    ledger,
    onGenerated,
    onBack,
}: {
    ledger: LedgerImportDetail
    onGenerated: (ledger: LedgerImportDetail, warnings: string[], generated: number) => void
    onBack: () => void
}) {
    const today = todayPKT()
    const usableItems = ledger.items.filter((item) => item.issues.length === 0 && item.availableQuantity > 0)
    const pendingDrafts = ledger.drafts.filter((draft) => draft.status === 'DRAFT').length

    const [from, setFrom] = useState(today.slice(0, 8) + '01')
    const [to, setTo] = useState(today)
    const [count, setCount] = useState('20')
    const [minAmount, setMinAmount] = useState('')
    const [maxAmount, setMaxAmount] = useState('')
    const [maxItems, setMaxItems] = useState('3')
    const [customerId, setCustomerId] = useState('')
    const [customers, setCustomers] = useState<CustomerOption[]>([])
    const [selectedItems, setSelectedItems] = useState<Set<string>>(() => new Set(usableItems.map((item) => item.id)))
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetch('/api/customers?limit=100')
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => setCustomers(data?.data ?? []))
            .catch(() => {})
    }, [])

    // Tax-inclusive value of the selected available stock (tax on retail price where one is set).
    const stockValue = useMemo(() => usableItems
        .filter((item) => selectedItems.has(item.id))
        .reduce((sum, item) => {
            const base = item.retailUnitPrice && item.retailUnitPrice > 0 ? item.retailUnitPrice : item.saleUnitPrice
            return sum + item.availableQuantity * (item.saleUnitPrice + (base * item.taxRate) / 100)
        }, 0), [usableItems, selectedItems])

    // Prefill a sensible amount band around the average invoice value once.
    useEffect(() => {
        const n = Number(count)
        if (minAmount || maxAmount || !(n > 0) || stockValue <= 0) return
        const average = stockValue / n
        setMinAmount(String(Math.max(1, Math.floor((average * 0.6) / 100) * 100)))
        setMaxAmount(String(Math.ceil((average * 1.4) / 100) * 100))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stockValue])

    const n = Number(count)
    const min = Number(minAmount)
    const max = Number(maxAmount)
    const average = n > 0 ? stockValue / n : 0
    const hint = !(n > 0 && min > 0 && max >= min)
        ? null
        : n * min > stockValue
            ? { tone: 'warning', text: `Stock covers only about ${Math.floor(stockValue / min)} invoice(s) at the minimum amount; fewer invoices will be generated.` }
            : n * max < stockValue
                ? { tone: 'warning', text: `${n} invoices at most Rs ${formatAmount(max)} sell about Rs ${formatAmount(n * max)}; the remaining stock stays available for a later batch.` }
                : { tone: 'ok', text: `All selected stock fits: about Rs ${formatAmount(average)} per invoice on average.` }

    function toggleItem(id: string) {
        setSelectedItems((current) => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    async function generate(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        if (!selectedItems.size) return setError('Select at least one product.')
        if (!(n >= 1)) return setError('Enter the number of invoices.')
        if (!(min > 0) || !(max >= min)) return setError('Enter a minimum amount and a maximum amount at least as large.')
        if (to < from) return setError('"To" date must be on or after the "From" date.')
        if (to > today) return setError('Invoice dates cannot be in the future.')

        setSubmitting(true)
        try {
            const res = await fetch(`/api/tenant/ledger-imports/${ledger.id}/drafts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from,
                    to,
                    count: Math.floor(n),
                    minAmount: min,
                    maxAmount: max,
                    maxItemsPerInvoice: Math.max(1, Math.floor(Number(maxItems) || 1)),
                    itemIds: [...selectedItems],
                    customerId: customerId || null,
                    replaceExisting: true,
                }),
            })
            if (!res.ok) {
                setError(await readError(res, 'Failed to generate drafts.'))
                return
            }
            const data = await res.json()
            onGenerated(data.import, data.warnings ?? [], data.generated ?? 0)
        } catch {
            setError('Network error. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <form onSubmit={generate} className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
                <div className="rounded-2xl border border-border bg-white p-5 shadow-xs">
                    <h2 className="text-sm font-semibold text-ink">Sales period and invoices</h2>
                    <p className="mt-0.5 text-xs text-muted">Invoices are dated randomly within the period, in ascending order.</p>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <Field label="From date">
                            <input type="date" className={inputClass} value={from} max={today} onChange={(e) => setFrom(e.target.value)} required />
                        </Field>
                        <Field label="To date">
                            <input type="date" className={inputClass} value={to} max={today} onChange={(e) => setTo(e.target.value)} required />
                        </Field>
                        <Field label="Number of invoices">
                            <input type="number" min="1" max="500" className={inputClass} value={count} onChange={(e) => setCount(e.target.value)} required />
                        </Field>
                        <Field label="Max products per invoice">
                            <input type="number" min="1" max="10" className={inputClass} value={maxItems} onChange={(e) => setMaxItems(e.target.value)} required />
                        </Field>
                        <Field label="Minimum invoice amount (incl. tax)">
                            <input type="number" min="1" step="0.01" className={inputClass} value={minAmount} onChange={(e) => setMinAmount(e.target.value)} required />
                        </Field>
                        <Field label="Maximum invoice amount (incl. tax)">
                            <input type="number" min="1" step="0.01" className={inputClass} value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} required />
                        </Field>
                        <Field label="Buyer" className="sm:col-span-2">
                            <select className={inputClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                                <option value="">Walk-in customer (unregistered)</option>
                                {customers.map((customer) => (
                                    <option key={customer.id} value={customer.id}>
                                        {customer.name}{customer.ntnCnic ? ` · ${customer.ntnCnic}` : ''}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>

                    {hint && (
                        <div className={`mt-4 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${hint.tone === 'ok' ? 'border-success-border bg-success-bg text-success' : 'border-amber-200 bg-warning-bg text-warning'}`}>
                            {hint.text}
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-border bg-white p-5 shadow-xs">
                    <h2 className="text-sm font-semibold text-ink">Products to sell</h2>
                    <p className="mt-0.5 text-xs text-muted">Estimated available value: <span className="font-semibold text-ink">Rs {formatAmount(stockValue)}</span></p>
                    <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                        {ledger.items.map((item) => {
                            const usable = item.issues.length === 0 && item.availableQuantity > 0
                            return (
                                <label key={item.id} className={`flex items-start gap-3 rounded-xl border border-border p-3 ${usable ? 'cursor-pointer hover:bg-surface-subtle' : 'opacity-60'}`}>
                                    <input
                                        type="checkbox"
                                        className="mt-0.5"
                                        disabled={!usable}
                                        checked={usable && selectedItems.has(item.id)}
                                        onChange={() => toggleItem(item.id)}
                                    />
                                    <span className="min-w-0 text-xs">
                                        <span className="block truncate font-semibold text-ink">{item.productName}</span>
                                        <span className="block text-muted">
                                            {item.hsCode} · {item.rate} · {formatQty(item.availableQuantity)} {item.uom} left
                                        </span>
                                        {!usable && (
                                            <span className="block text-error">{item.issues[0] ?? 'No stock left'}</span>
                                        )}
                                    </span>
                                </label>
                            )
                        })}
                    </div>
                </div>
            </div>

            {pendingDrafts > 0 && (
                <div className="rounded-xl border border-amber-200 bg-warning-bg px-4 py-2.5 text-xs font-medium text-warning">
                    Generating replaces the {pendingDrafts} pending draft(s) not yet turned into invoices.
                </div>
            )}
            {error && <div className="rounded-xl border border-error-border bg-error-bg px-4 py-2.5 text-xs font-medium text-error">{error}</div>}

            <div className="flex justify-between">
                <button type="button" className={secondaryButton} onClick={onBack}>
                    <ArrowLeft size={15} />
                    Back to stock
                </button>
                <button type="submit" className={primaryButton} disabled={submitting || usableItems.length === 0}>
                    <Wand2 size={15} />
                    {submitting ? 'Generating…' : 'Generate drafts'}
                </button>
            </div>
        </form>
    )
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <label className={`block ${className}`}>
            <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
            {children}
        </label>
    )
}
