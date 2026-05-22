import { SALE_TYPE_LIST } from './sale-type-config'

function normalizeText(value: string | null | undefined): string {
    return value?.trim() ?? ''
}

function normalizeKey(value: string | null | undefined): string {
    return normalizeText(value).toLowerCase()
}

function toRatePercent(value: string): string | null {
    const trimmed = normalizeText(value)
    if (!trimmed) return null

    const percentMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*%/)
    if (percentMatch) {
        return `${Number(percentMatch[1])}%`
    }

    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
        return `${Number(trimmed)}%`
    }

    return null
}

function sanitizeRawRate(rawRate: string | null | undefined): string {
    const trimmed = normalizeText(rawRate)
    if (!trimmed) return ''

    // Some UI surfaces send labels like "Tax 15%"; PRAL expects just ratE_DESC.
    const withoutTaxPrefix = trimmed.replace(/^tax\s*[:\-]?\s*/i, '')
    const normalizedPercent = toRatePercent(withoutTaxPrefix)
    return normalizedPercent ?? withoutTaxPrefix
}

export function resolveDIRateDescriptor(params: {
    diRate?: string | null
    taxRate?: number | null
    diSaleType?: string | null
}): string {
    const saleTypeKey = normalizeKey(params.diSaleType)
    const saleTypeConfig = SALE_TYPE_LIST.find((config) => normalizeKey(config.label) === saleTypeKey)
    const allowedRates = saleTypeConfig?.fallbackRates ?? []

    const rawCandidate = sanitizeRawRate(params.diRate)
    const taxRateCandidate = Number.isFinite(Number(params.taxRate)) ? `${Number(params.taxRate)}%` : ''
    const candidate = rawCandidate || taxRateCandidate

    if (!allowedRates.length) {
        return candidate
    }

    const directMatch = allowedRates.find((rate) => normalizeKey(rate.desc) === normalizeKey(candidate))
    if (directMatch) {
        return directMatch.desc
    }

    const candidatePercent = toRatePercent(candidate)
    if (candidatePercent) {
        const percentMatch = allowedRates.find((rate) => {
            const ratePercent = toRatePercent(rate.desc)
            return Boolean(ratePercent) && ratePercent === candidatePercent
        })
        if (percentMatch) {
            return percentMatch.desc
        }
    }

    return allowedRates[0]?.desc ?? candidate
}
