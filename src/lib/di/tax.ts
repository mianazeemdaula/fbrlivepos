function normalizeSaleType(value: string | null | undefined): string {
    return value?.trim().toLowerCase() ?? ''
}

export function isThirdScheduleSaleType(saleType: string | null | undefined): boolean {
    return normalizeSaleType(saleType) === '3rd schedule goods'
}

export function calculateSalesTaxApplicable(params: {
    saleType?: string | null
    taxRate: number
    taxableValue: number
    retailPrice?: number | null
    quantity?: number
}): number {
    const taxRate = Math.max(0, Number(params.taxRate) || 0)

    if (isThirdScheduleSaleType(params.saleType)) {
        const retailPrice = Math.max(0, Number(params.retailPrice ?? params.taxableValue) || 0)
        const quantity = Math.max(0, Number(params.quantity ?? 1) || 0)

        if (retailPrice === 0 || quantity === 0 || taxRate === 0) {
            return 0
        }

        return Number(((retailPrice * taxRate) / 100).toFixed(2))
    }

    return Number((Math.max(0, Number(params.taxableValue) || 0) * taxRate / 100).toFixed(2))
}