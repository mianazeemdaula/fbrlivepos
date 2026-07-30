/**
 * Utility functions for Pakistan Standard Time (PKT - UTC+5 / Asia/Karachi)
 */

export function formatPKTDateTime(dateInput: string | Date | number | null | undefined): string {
    if (!dateInput) return '—'
    const d = new Date(dateInput)
    if (isNaN(d.getTime())) return '—'

    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Karachi',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).formatToParts(d)

        const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
        return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}`
    } catch {
        return d.toLocaleString()
    }
}

export function formatPKTDate(dateInput: string | Date | number | null | undefined): string {
    if (!dateInput) return '—'
    const d = new Date(dateInput)
    if (isNaN(d.getTime())) return '—'

    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Karachi',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        }).formatToParts(d)

        const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
        return `${get('day')} ${get('month')} ${get('year')}`
    } catch {
        return d.toLocaleDateString()
    }
}

export function formatPKTTime(dateInput: string | Date | number | null | undefined): string {
    if (!dateInput) return '—'
    const d = new Date(dateInput)
    if (isNaN(d.getTime())) return '—'

    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Karachi',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).formatToParts(d)

        const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
        return `${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}`
    } catch {
        return d.toLocaleTimeString()
    }
}
