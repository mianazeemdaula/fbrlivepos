import type { DICredentials, Invoice, InvoiceItem } from '@/generated/prisma/client'

type InvoiceWithItems = Invoice & { items: InvoiceItem[] }

export type DISubmissionIssue = {
    code:
    | 'DI_CREDENTIALS_MISSING'
    | 'DI_TOKEN_MISSING'
    | 'DI_PRODUCTION_NOT_READY'
    | 'DI_SANDBOX_SCENARIO_REQUIRED'
    | 'DI_ITEMS_MISSING'
    | 'DI_SALE_TYPE_MISSING'
    | 'DI_RATE_MISSING'
    | 'DI_UOM_MISSING'
    | 'DI_FIXED_VALUE_MISSING'
    | 'DI_SRO_DETAILS_MISSING'
    message: string
    itemId?: string
    itemName?: string
}

export type DISubmissionEligibility = {
    eligible: boolean
    environment: 'SANDBOX' | 'PRODUCTION' | null
    issues: DISubmissionIssue[]
}

export type DIItemReadiness = {
    ready: boolean
    issues: string[]
}

function normalize(value: string | null | undefined) {
    return value?.trim().toLowerCase() ?? ''
}

function hasToken(creds: DICredentials) {
    return creds.environment === 'SANDBOX'
        ? Boolean(creds.encryptedSandboxToken)
        : Boolean(creds.encryptedProductionToken)
}

function requiresFixedValue(rate: string | null | undefined) {
    const normalized = normalize(rate)
    return normalized.includes('rupees') || normalized.includes('rs.') || normalized.includes('/unit') || normalized.includes('/kg')
}

function requiresSroDetails(saleType: string | null | undefined, sroScheduleNo: string | null | undefined, sroItemSerialNo: string | null | undefined) {
    const normalizedSaleType = normalize(saleType)
    return normalizedSaleType.includes('sro') || Boolean(sroScheduleNo?.trim()) || Boolean(sroItemSerialNo?.trim())
}

export function evaluateDIItemReadiness(item: {
    name?: string | null
    hsCode?: string | null
    diSaleType?: string | null
    diRate?: string | null
    diUOM?: string | null
    unit?: string | null
    diFixedNotifiedValueOrRetailPrice?: number | string | null
    sroScheduleNo?: string | null
    sroItemSerialNo?: string | null
}): DIItemReadiness {
    const issues: string[] = []
    const label = item.name?.trim() || item.hsCode?.trim() || 'Item'

    if (!item.diSaleType?.trim()) {
        issues.push(`${label}: missing PRAL sale type.`)
    }

    if (!item.diRate?.trim()) {
        issues.push(`${label}: missing PRAL rate descriptor.`)
    }

    if (!(item.diUOM?.trim() || item.unit?.trim())) {
        issues.push(`${label}: missing PRAL unit of measure.`)
    }

    if (requiresFixedValue(item.diRate) && Number(item.diFixedNotifiedValueOrRetailPrice ?? 0) <= 0) {
        issues.push(`${label}: fixed notified value or retail price is required for the selected PRAL rate.`)
    }

    if (
        requiresSroDetails(item.diSaleType, item.sroScheduleNo, item.sroItemSerialNo)
        && (!item.sroScheduleNo?.trim() || !item.sroItemSerialNo?.trim())
    ) {
        issues.push(`${label}: both SRO schedule and SRO serial are required for the selected PRAL sale type.`)
    }

    return {
        ready: issues.length === 0,
        issues,
    }
}

export function evaluateDISubmissionEligibility(params: {
    creds: DICredentials | null
    invoice?: InvoiceWithItems | null
    scenarioId?: string | null
}): DISubmissionEligibility {
    const { creds, invoice, scenarioId } = params
    const issues: DISubmissionIssue[] = []

    if (!creds) {
        issues.push({
            code: 'DI_CREDENTIALS_MISSING',
            message: 'PRAL DI credentials are not configured for this tenant.',
        })
        return { eligible: false, environment: null, issues }
    }

    if (!hasToken(creds)) {
        issues.push({
            code: 'DI_TOKEN_MISSING',
            message: creds.environment === 'SANDBOX'
                ? 'Sandbox token is missing from PRAL DI settings.'
                : 'Production token is missing from PRAL DI settings.',
        })
    }

    if (creds.environment === 'PRODUCTION' && !creds.isProductionReady) {
        issues.push({
            code: 'DI_PRODUCTION_NOT_READY',
            message: 'Tenant is not yet eligible for production DI submission. Complete sandbox requirements first.',
        })
    }

    if (creds.environment === 'SANDBOX' && !scenarioId) {
        issues.push({
            code: 'DI_SANDBOX_SCENARIO_REQUIRED',
            message: 'Sandbox DI submission requires a scenario ID.',
        })
    }

    if (invoice) {
        if (invoice.items.length === 0) {
            issues.push({
                code: 'DI_ITEMS_MISSING',
                message: 'Invoice has no items to submit to PRAL.',
            })
        }

        for (const item of invoice.items) {
            const itemName = item.name || item.hsCode
            const readiness = evaluateDIItemReadiness({
                name: itemName,
                hsCode: item.hsCode,
                diSaleType: item.diSaleType,
                diRate: item.diRate,
                diUOM: item.diUOM,
                unit: item.unit,
                diFixedNotifiedValueOrRetailPrice: item.diFixedNotifiedValueOrRetailPrice != null
                    ? Number(item.diFixedNotifiedValueOrRetailPrice)
                    : null,
                sroScheduleNo: item.sroScheduleNo,
                sroItemSerialNo: item.sroItemSerialNo,
            })

            if (!item.diSaleType?.trim()) {
                issues.push({
                    code: 'DI_SALE_TYPE_MISSING',
                    message: `Item "${itemName}" is missing a PRAL sale type.`,
                    itemId: item.id,
                    itemName,
                })
            }

            if (!item.diRate?.trim()) {
                issues.push({
                    code: 'DI_RATE_MISSING',
                    message: `Item "${itemName}" is missing a PRAL rate descriptor.`,
                    itemId: item.id,
                    itemName,
                })
            }

            if (!(item.diUOM?.trim() || item.unit?.trim())) {
                issues.push({
                    code: 'DI_UOM_MISSING',
                    message: `Item "${itemName}" is missing a PRAL unit of measure.`,
                    itemId: item.id,
                    itemName,
                })
            }

            if (requiresFixedValue(item.diRate) && Number(item.diFixedNotifiedValueOrRetailPrice ?? 0) <= 0) {
                issues.push({
                    code: 'DI_FIXED_VALUE_MISSING',
                    message: `Item "${itemName}" needs a fixed notified value or retail price for its selected PRAL rate.`,
                    itemId: item.id,
                    itemName,
                })
            }

            if (
                requiresSroDetails(item.diSaleType, item.sroScheduleNo, item.sroItemSerialNo)
                && (!item.sroScheduleNo?.trim() || !item.sroItemSerialNo?.trim())
            ) {
                issues.push({
                    code: 'DI_SRO_DETAILS_MISSING',
                    message: `Item "${itemName}" needs both SRO schedule and SRO serial values for its selected PRAL sale type.`,
                    itemId: item.id,
                    itemName,
                })
            }

            if (!readiness.ready && issues.length === 0) {
                issues.push({
                    code: 'DI_ITEMS_MISSING',
                    message: readiness.issues.join(' '),
                    itemId: item.id,
                    itemName,
                })
            }
        }
    }

    return {
        eligible: issues.length === 0,
        environment: creds.environment,
        issues,
    }
}