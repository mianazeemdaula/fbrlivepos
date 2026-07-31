function normalizeSaleType(value: string | null | undefined): string {
    return value?.trim().toLowerCase() ?? ''
}

export function isThirdScheduleSaleType(saleType: string | null | undefined): boolean {
    return normalizeSaleType(saleType) === '3rd schedule goods'
}

export function round2(value: number | null | undefined): number {
    return Number((Math.max(0, Number(value) || 0)).toFixed(2))
}

/**
 * PRAL taxes the notified/retail price — not the sale value — on lines that carry one
 * (3rd Schedule Goods and any other sale type configured with taxBase 'retailPrice').
 * `fixedNotifiedValueOrRetailPrice` is always the LINE-level base (per-unit price × qty),
 * because it must equal the value we send in the payload field of the same name.
 */
export function usesFixedNotifiedTaxBase(params: {
    saleType?: string | null
    fixedNotifiedValueOrRetailPrice?: number | null
}): boolean {
    return round2(params.fixedNotifiedValueOrRetailPrice) > 0 || isThirdScheduleSaleType(params.saleType)
}

export interface DILineValues {
    /** The base the sales tax is charged on — equals fixedNotifiedValueOrRetailPrice on fixed-price lines. */
    taxableValue: number
    salesTaxApplicable: number
    /** Tax-inclusive line total; PRAL expects 0 on lines without a notified/retail base. */
    totalValues: number
}

/**
 * Single source of truth for the DI line arithmetic:
 *   taxable            = fixedNotifiedValueOrRetailPrice (when present), else valueSalesExcludingST
 *   salesTaxApplicable = round(taxable × rate, 2)
 *   totalValues        = round(taxable + salesTaxApplicable, 2)  [fixed-price lines only]
 */
export function calculateDILineValues(params: {
    saleType?: string | null
    taxRate: number
    valueSalesExcludingST: number
    fixedNotifiedValueOrRetailPrice?: number | null
}): DILineValues {
    const taxRate = Math.max(0, Number(params.taxRate) || 0)
    const fixedBase = round2(params.fixedNotifiedValueOrRetailPrice)
    const usesFixedBase = usesFixedNotifiedTaxBase(params)

    const taxableValue = usesFixedBase && fixedBase > 0 ? fixedBase : round2(params.valueSalesExcludingST)
    const salesTaxApplicable = round2((taxableValue * taxRate) / 100)

    return {
        taxableValue,
        salesTaxApplicable,
        totalValues: usesFixedBase ? round2(taxableValue + salesTaxApplicable) : 0,
    }
}

export function calculateSalesTaxApplicable(params: {
    saleType?: string | null
    taxRate: number
    taxableValue: number
    /** Line-level notified/retail price (already multiplied by quantity). */
    retailPrice?: number | null
}): number {
    return calculateDILineValues({
        saleType: params.saleType,
        taxRate: params.taxRate,
        valueSalesExcludingST: params.taxableValue,
        fixedNotifiedValueOrRetailPrice: params.retailPrice,
    }).salesTaxApplicable
}
