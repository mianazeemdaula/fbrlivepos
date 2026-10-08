import { calculateDILineValues, round2 } from '@/lib/di/tax'

/**
 * Splits pooled ledger stock into draft sale invoices: `count` invoices dated
 * within [from, to], each totalling (tax-inclusive) between minAmount and
 * maxAmount, never allocating more than the available quantity of any pool.
 */

export interface LedgerLineSource {
    unitPrice: number // per unit, excl. sales tax
    retailUnitPrice: number | null // per unit fixed/notified/retail price
    taxRate: number
    saleType: string
}

export interface GeneratorItem extends LedgerLineSource {
    id: string
    label: string // e.g. "1518.0000 · Ghee 1x16 kg", used in warnings
    availableQty: number
    quantityStep: number // 1 for whole units, 0.001 otherwise
}

export interface GeneratorOptions {
    from: Date // UTC midnight
    to: Date // UTC midnight, inclusive
    count: number
    minAmount: number
    maxAmount: number
    maxItemsPerInvoice: number
    seed: number
}

export interface LedgerLineValues {
    quantity: number
    unitPrice: number
    retailValue: number | null
    valueExclST: number
    salesTax: number
    lineTotal: number
}

export interface GeneratedLine extends LedgerLineValues {
    itemId: string
}

export interface GeneratedDraft {
    sequence: number
    invoiceDate: Date
    lines: GeneratedLine[]
    subtotal: number
    taxAmount: number
    totalAmount: number
}

export interface GenerationResult {
    drafts: GeneratedDraft[]
    warnings: string[]
    stockValue: number
    allocatedValue: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Line arithmetic shared with invoice creation, so drafts and invoices always agree. */
export function computeLedgerLine(source: LedgerLineSource, quantity: number): LedgerLineValues {
    const valueExclST = round2(source.unitPrice * quantity)
    const retailValue = source.retailUnitPrice != null && source.retailUnitPrice > 0
        ? round2(source.retailUnitPrice * quantity)
        : null
    const { salesTaxApplicable } = calculateDILineValues({
        saleType: source.saleType,
        taxRate: source.taxRate,
        valueSalesExcludingST: valueExclST,
        fixedNotifiedValueOrRetailPrice: retailValue,
    })
    return {
        quantity,
        unitPrice: source.unitPrice,
        retailValue,
        valueExclST,
        salesTax: salesTaxApplicable,
        lineTotal: round2(valueExclST + salesTaxApplicable),
    }
}

export function quantityStepFor(totalQuantity: number): number {
    return Number.isInteger(totalQuantity) ? 1 : 0.001
}

function roundQty(value: number) {
    return Math.round(value * 1000) / 1000
}

function floorToStep(value: number, step: number) {
    if (value <= 0) return 0
    return roundQty(Math.floor(value / step + 1e-9) * step)
}

function ceilToStep(value: number, step: number) {
    if (value <= 0) return 0
    return roundQty(Math.ceil(value / step - 1e-9) * step)
}

// Small, fast, seedable PRNG so "regenerate" gives a new but reproducible plan.
function mulberry32(seed: number) {
    let state = seed >>> 0
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function formatPKR(value: number) {
    return `Rs ${value.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

class DraftBuilder {
    readonly qty = new Map<string, number>()
    constructor(private readonly items: Map<string, GeneratorItem>) {}

    get lineCount() {
        return this.qty.size
    }

    lines(): GeneratedLine[] {
        return [...this.qty.entries()].map(([itemId, quantity]) => ({
            itemId,
            ...computeLedgerLine(this.items.get(itemId)!, quantity),
        }))
    }

    total() {
        return round2(this.lines().reduce((sum, line) => sum + line.lineTotal, 0))
    }

    totalWith(itemId: string, extraQty: number) {
        const current = this.qty.get(itemId) ?? 0
        const without = this.lines().filter((line) => line.itemId !== itemId).reduce((sum, line) => sum + line.lineTotal, 0)
        return round2(without + computeLedgerLine(this.items.get(itemId)!, roundQty(current + extraQty)).lineTotal)
    }

    add(itemId: string, quantity: number) {
        this.qty.set(itemId, roundQty((this.qty.get(itemId) ?? 0) + quantity))
    }
}

export function generateLedgerDrafts(sourceItems: GeneratorItem[], options: GeneratorOptions): GenerationResult {
    const rng = mulberry32(options.seed)
    const warnings: string[] = []
    const { minAmount, maxAmount } = options
    const maxItems = Math.max(1, Math.floor(options.maxItemsPerInvoice))

    const items = new Map(sourceItems.filter((item) => item.availableQty > 0).map((item) => [item.id, item]))
    const available = new Map([...items.values()].map((item) => [item.id, item.availableQty]))
    const unitGross = new Map([...items.values()].map((item) => [item.id, computeLedgerLine(item, item.quantityStep).lineTotal / item.quantityStep]))

    for (const item of items.values()) {
        const stepTotal = computeLedgerLine(item, item.quantityStep).lineTotal
        if (stepTotal > maxAmount) {
            warnings.push(`One unit of ${item.label} costs ${formatPKR(stepTotal)}, above the maximum invoice amount, so it was left out.`)
            items.delete(item.id)
        }
    }

    const stockValue = round2([...items.values()].reduce((sum, item) => sum + item.availableQty * unitGross.get(item.id)!, 0))
    if (stockValue <= 0) {
        return { drafts: [], warnings: [...warnings, 'No stock is left to invoice in the selected products.'], stockValue: 0, allocatedValue: 0 }
    }

    let count = Math.max(1, Math.floor(options.count))
    if (stockValue < count * minAmount) {
        const affordable = Math.floor(stockValue / minAmount)
        if (affordable < 1) {
            return {
                drafts: [],
                warnings: [`Available stock is worth ${formatPKR(stockValue)}, below the minimum invoice amount of ${formatPKR(minAmount)}.`],
                stockValue,
                allocatedValue: 0,
            }
        }
        warnings.push(`Stock worth ${formatPKR(stockValue)} only covers ${affordable} invoice(s) at the ${formatPKR(minAmount)} minimum, so ${affordable} were generated instead of ${count}.`)
        count = affordable
    }

    // Each target = minimum + a randomly weighted share of the surplus, capped at the maximum,
    // so the targets add up to the value we can actually sell and spread naturally across the range.
    const targetSum = Math.min(stockValue, count * maxAmount)
    const headroom = maxAmount - minAmount
    const weights = Array.from({ length: count }, () => 0.15 + rng())
    const extras = new Array<number>(count).fill(0)
    let surplus = Math.max(0, targetSum - count * minAmount)
    for (let pass = 0; pass < 25 && surplus > 0.01; pass++) {
        const open = extras.map((extra, i) => (extra < headroom ? i : -1)).filter((i) => i >= 0)
        const weightSum = open.reduce((sum, i) => sum + weights[i], 0)
        if (!open.length || weightSum <= 0) break
        let overflow = 0
        for (const i of open) {
            const next = extras[i] + (surplus * weights[i]) / weightSum
            extras[i] = Math.min(headroom, next)
            overflow += next - extras[i]
        }
        surplus = overflow
    }
    const targets = extras.map((extra) => minAmount + extra)

    const builders: DraftBuilder[] = []
    const shuffledIds = () => {
        const ids = [...items.keys()].filter((id) => (available.get(id) ?? 0) >= items.get(id)!.quantityStep)
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1))
            ;[ids[i], ids[j]] = [ids[j], ids[i]]
        }
        return ids
    }
    const take = (builder: DraftBuilder, itemId: string, qty: number) => {
        builder.add(itemId, qty)
        available.set(itemId, roundQty(available.get(itemId)! - qty))
    }

    for (const target of targets) {
        const builder = new DraftBuilder(items)
        const candidates = shuffledIds()
        const slots = Math.min(candidates.length, 1 + Math.floor(rng() * maxItems))

        for (const itemId of candidates) {
            if (builder.lineCount >= slots) break
            const item = items.get(itemId)!
            const remaining = target - builder.total()
            if (remaining < unitGross.get(itemId)! * item.quantityStep) continue

            const slotsLeft = slots - builder.lineCount
            const share = slotsLeft === 1 ? remaining : (remaining / slotsLeft) * (0.6 + rng() * 0.8)
            let qty = floorToStep(Math.min(available.get(itemId)!, share / unitGross.get(itemId)!), item.quantityStep)
            if (qty < item.quantityStep) qty = floorToStep(Math.min(available.get(itemId)!, remaining / unitGross.get(itemId)!), item.quantityStep)
            // Line-level tax rounding can nudge the total a paisa past the target.
            while (qty >= item.quantityStep && builder.totalWith(itemId, qty) > maxAmount) qty = roundQty(qty - item.quantityStep)
            if (qty >= item.quantityStep) take(builder, itemId, qty)
        }

        // Top up towards the target (never below the minimum) from items already on the
        // invoice first, then any other stock.
        const goal = Math.max(minAmount, target)
        for (let guard = 0; guard < 50 && builder.total() < goal; guard++) {
            const candidates = [...builder.qty.keys(), ...shuffledIds().filter((id) => !builder.qty.has(id))]
            const itemId = candidates.find((id) =>
                (available.get(id) ?? 0) >= items.get(id)!.quantityStep &&
                (builder.qty.has(id) || builder.lineCount < maxItems) &&
                builder.totalWith(id, items.get(id)!.quantityStep) <= maxAmount,
            )
            if (!itemId) break
            const item = items.get(itemId)!
            // Round up only as far as the minimum needs; past that, round down so earlier
            // invoices don't overshoot their targets and starve the last ones.
            const gross = unitGross.get(itemId)!
            let qty = Math.max(
                ceilToStep((minAmount - builder.total()) / gross, item.quantityStep),
                floorToStep((goal - builder.total()) / gross, item.quantityStep),
            )
            if (qty < item.quantityStep) break
            qty = Math.min(qty, floorToStep(available.get(itemId)!, item.quantityStep))
            while (qty > item.quantityStep && builder.totalWith(itemId, qty) > maxAmount) qty = roundQty(qty - item.quantityStep)
            take(builder, itemId, qty)
        }

        if (builder.lineCount === 0) break
        builders.push(builder)
    }

    // Spread leftover stock over invoices that still have headroom below the maximum.
    for (const itemId of [...items.keys()]) {
        const item = items.get(itemId)!
        for (const builder of [...builders].sort((a, b) => a.total() - b.total())) {
            if ((available.get(itemId) ?? 0) < item.quantityStep) break
            if (!builder.qty.has(itemId) && builder.lineCount >= maxItems) continue
            let qty = floorToStep(Math.min(available.get(itemId)!, (maxAmount - builder.total()) / unitGross.get(itemId)!), item.quantityStep)
            while (qty >= item.quantityStep && builder.totalWith(itemId, qty) > maxAmount) qty = roundQty(qty - item.quantityStep)
            if (qty >= item.quantityStep) take(builder, itemId, qty)
        }
    }

    if (builders.length < count) {
        warnings.push(`Stock ran out after ${builders.length} of ${count} invoices.`)
    }
    const belowMin = builders.filter((builder) => builder.total() < minAmount).length
    if (belowMin) {
        warnings.push(`${belowMin} invoice(s) are below the minimum amount because the remaining stock could not fill them.`)
    }

    // Invoice dates: random days within the range, ascending so numbering follows the calendar.
    const days = Math.max(1, Math.round((options.to.getTime() - options.from.getTime()) / DAY_MS) + 1)
    const dates = builders
        .map(() => Math.floor(rng() * days))
        .sort((a, b) => a - b)
        .map((offset) => new Date(options.from.getTime() + offset * DAY_MS))

    const drafts = builders.map((builder, index) => {
        const lines = builder.lines()
        const subtotal = round2(lines.reduce((sum, line) => sum + line.valueExclST, 0))
        const taxAmount = round2(lines.reduce((sum, line) => sum + line.salesTax, 0))
        return {
            sequence: index + 1,
            invoiceDate: dates[index],
            lines,
            subtotal,
            taxAmount,
            totalAmount: round2(subtotal + taxAmount),
        }
    })

    const allocatedValue = round2(drafts.reduce((sum, draft) => sum + draft.totalAmount, 0))
    // Measured in whole units left, not value: line-level tax rounding makes the value differ by paisas.
    const leftoverValue = round2([...items.values()].reduce((sum, item) => {
        const left = available.get(item.id) ?? 0
        return left >= item.quantityStep ? sum + computeLedgerLine(item, left).lineTotal : sum
    }, 0))
    if (leftoverValue > 0) {
        warnings.push(`${formatPKR(leftoverValue)} of stock is left unallocated (raise the invoice count or maximum amount to include it).`)
    }

    return { drafts, warnings, stockValue, allocatedValue }
}
