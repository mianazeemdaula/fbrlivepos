export function digitsOnly(value: string) {
    return value.replace(/\D/g, '')
}

export function normalizeNtnCnic(value: string | null | undefined) {
    return digitsOnly(value ?? '').slice(0, 13)
}

export function isValidNtnCnic(value: string | null | undefined) {
    const normalized = normalizeNtnCnic(value)
    return normalized.length === 7 || normalized.length === 13
}

export function normalizeSellerNtn(value: string | null | undefined) {
    return digitsOnly(value ?? '').slice(0, 9)
}

export function isValidSellerNtn(value: string | null | undefined) {
    const normalized = normalizeSellerNtn(value)
    return normalized.length === 7 || normalized.length === 8 || normalized.length === 9
}

export function normalizeMobile(value: string | null | undefined) {
    const digits = digitsOnly(value ?? '')

    if (digits.length === 10 && digits.startsWith('3')) {
        return `0${digits}`
    }

    if (digits.length === 12 && digits.startsWith('92')) {
        return `0${digits.slice(2)}`
    }

    return digits.slice(0, 11)
}

export function isValidMobile(value: string | null | undefined) {
    return /^03\d{9}$/.test(normalizeMobile(value))
}