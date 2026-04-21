import type { DIInvoiceItem, DIInvoicePayload } from './types'
import { getRequiredScenarios } from './scenarios'

export interface ScenarioTemplateBuyer {
    ntcnic?: string
    businessName: string
    province: string
    address: string
    registrationType: 'Registered' | 'Unregistered'
}

export interface ScenarioTemplate {
    invoiceType: 'Sale Invoice' | 'Debit Note'
    invoiceRefNo?: string
    buyer: ScenarioTemplateBuyer
    items: DIInvoiceItem[]
}

export interface SandboxScenarioPreview {
    scenarioId: string
    buyer: ScenarioTemplateBuyer
    items: DIInvoiceItem[]
}

export interface ProductDIAutofillPreset {
    hsCode: string
    diRate: string
    diUOM: string
    diSaleType: string
    diFixedNotifiedValueOrRetailPrice: string
    diSalesTaxWithheldAtSource: string
    extraTax: string
    furtherTax: string
    fedPayable: string
    sroScheduleNo: string
    sroItemSerialNo: string
}

export interface SandboxScenarioMatchItem {
    hsCode?: string | null
    diRate?: string | null
    diUOM?: string | null
    unit?: string | null
    diSaleType?: string | null
    diFixedNotifiedValueOrRetailPrice?: number | string | { toString(): string } | null
    diSalesTaxWithheldAtSource?: number | string | { toString(): string } | null
    extraTax?: number | string | { toString(): string } | '' | null
    furtherTax?: number | string | { toString(): string } | null
    fedPayable?: number | string | { toString(): string } | null
    sroScheduleNo?: string | null
    sroItemSerialNo?: string | null
}

export interface SandboxScenarioInferenceResult {
    scenarioId: string | null
    candidates: string[]
    reason: 'matched' | 'no-match' | 'ambiguous' | 'mixed-items' | 'no-items'
}

interface SellerIdentity {
    sellerNTNCNIC: string
    sellerBusinessName: string
    sellerProvince: string
    sellerAddress: string
}

function createItem(item: DIInvoiceItem): DIInvoiceItem {
    return {
        ...item,
        quantity: Number(item.quantity.toFixed(4)),
        totalValues: Number(item.totalValues.toFixed(2)),
        valueSalesExcludingST: Number(item.valueSalesExcludingST.toFixed(2)),
        fixedNotifiedValueOrRetailPrice: Number(item.fixedNotifiedValueOrRetailPrice.toFixed(2)),
        salesTaxApplicable: Number(item.salesTaxApplicable.toFixed(2)),
        salesTaxWithheldAtSource: Number(item.salesTaxWithheldAtSource.toFixed(2)),
        extraTax: item.extraTax === '' ? '' : Number(item.extraTax.toFixed(2)),
        furtherTax: Number(item.furtherTax.toFixed(2)),
        fedPayable: Number(item.fedPayable.toFixed(2)),
        discount: Number(item.discount.toFixed(2)),
    }
}

const SCENARIO_TEMPLATES: Record<string, ScenarioTemplate> = {
    SN001: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: '',
        buyer: {
            ntcnic: '2046004',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Registered',
        },
        items: [
            createItem({
                hsCode: '0101.2100',
                productDescription: 'test',
                rate: '18%',
                uoM: 'Numbers, pieces, units',
                quantity: 400,
                totalValues: 0,
                valueSalesExcludingST: 1000,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 180,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '',
                fedPayable: 0,
                discount: 0,
                saleType: 'Goods at standard rate (default)',
                sroItemSerialNo: '',
            }),
        ],
    },
    SN002: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: '',
        buyer: {
            ntcnic: '1234567',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '0101.2100',
                productDescription: 'test',
                rate: '18%',
                uoM: 'Numbers, pieces, units',
                quantity: 400,
                totalValues: 0,
                valueSalesExcludingST: 1000,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 180,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '',
                fedPayable: 0,
                discount: 0,
                saleType: 'Goods at standard rate (default)',
                sroItemSerialNo: '',
            }),
        ],
    },
    SN003: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: '0',
        buyer: {
            ntcnic: '3710505701479',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '7214.1010',
                productDescription: '',
                rate: '18%',
                uoM: 'MT',
                quantity: 1,
                totalValues: 0,
                valueSalesExcludingST: 205000,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 36900,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '',
                fedPayable: 0,
                discount: 0,
                saleType: 'Steel melting and re-rolling',
                sroItemSerialNo: '',
            }),
        ],
    },
    SN004: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: 'SI-20250421-001',
        buyer: {
            ntcnic: '3710505701479',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '7204.4910',
                productDescription: '',
                rate: '18%',
                uoM: 'MT',
                quantity: 1,
                totalValues: 0,
                valueSalesExcludingST: 175000,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 31500,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '',
                fedPayable: 0,
                discount: 0,
                saleType: 'Ship breaking',
                sroItemSerialNo: '',
            }),
        ],
    },
    SN005: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: '',
        buyer: {
            ntcnic: '1000000000000',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '0102.2930',
                productDescription: 'product Description41',
                rate: '1%',
                uoM: 'Numbers, pieces, units',
                quantity: 1,
                totalValues: 0,
                valueSalesExcludingST: 1000,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 10,
                salesTaxWithheldAtSource: 50.23,
                extraTax: '',
                furtherTax: 120,
                sroScheduleNo: 'EIGHTH SCHEDULE Table 1',
                fedPayable: 50.36,
                discount: 56.36,
                saleType: 'Goods at Reduced Rate',
                sroItemSerialNo: '82',
            }),
        ],
    },
    SN006: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: 'SI-20250515-001',
        buyer: {
            ntcnic: '2046004',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Registered',
        },
        items: [
            createItem({
                hsCode: '0102.2930',
                productDescription: 'product Description41',
                rate: 'Exempt',
                uoM: 'Numbers, pieces, units',
                quantity: 1,
                totalValues: 0,
                valueSalesExcludingST: 10,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 0,
                salesTaxWithheldAtSource: 50.23,
                extraTax: 0,
                furtherTax: 120,
                sroScheduleNo: '6th Schd Table I',
                fedPayable: 50.36,
                discount: 56.36,
                saleType: 'Exempt goods',
                sroItemSerialNo: '100',
            }),
        ],
    },
    SN007: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: '0',
        buyer: {
            ntcnic: '3710505701479',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '0101.2100',
                productDescription: 'test',
                rate: '0%',
                uoM: 'Numbers, pieces, units',
                quantity: 100,
                totalValues: 0,
                valueSalesExcludingST: 100,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 0,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '327(I)/2008',
                fedPayable: 0,
                discount: 0,
                saleType: 'Goods at zero-rate',
                sroItemSerialNo: '1',
            }),
        ],
    },
    SN008: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: '0',
        buyer: {
            ntcnic: '3710505701479',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '0101.2100',
                productDescription: 'test',
                rate: '18%',
                uoM: 'Numbers, pieces, units',
                quantity: 100,
                totalValues: 1180,
                valueSalesExcludingST: 1000,
                fixedNotifiedValueOrRetailPrice: 1000,
                salesTaxApplicable: 180,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '',
                fedPayable: 0,
                discount: 0,
                saleType: '3rd Schedule Goods',
                sroItemSerialNo: '',
            }),
        ],
    },
    SN009: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: '',
        buyer: {
            ntcnic: '2046004',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Registered',
        },
        items: [
            createItem({
                hsCode: '0101.2100',
                productDescription: 'test',
                rate: '18%',
                uoM: 'Numbers, pieces, units',
                quantity: 0,
                totalValues: 2500,
                valueSalesExcludingST: 2500,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 450,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '',
                fedPayable: 0,
                discount: 0,
                saleType: 'Cotton ginners',
                sroItemSerialNo: '',
            }),
        ],
    },
    SN010: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: 'SI-20250515-001',
        buyer: {
            ntcnic: '1000000000000',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '0101.2100',
                productDescription: 'test',
                rate: '17%',
                uoM: 'Numbers, pieces, units',
                quantity: 1000,
                totalValues: 0,
                valueSalesExcludingST: 100,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 17,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '',
                fedPayable: 0,
                discount: 0,
                saleType: 'Telecommunication services',
                sroItemSerialNo: '',
            }),
        ],
    },
    SN011: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: '',
        buyer: {
            ntcnic: '3710505701479',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                // HS code for Other bars/rods of iron (steel products used in toll mfg)
                // UOM from PRAL /pdi/v2/HS_UOM?hs_code=7214.9990 → KG
                hsCode: '7214.9990',
                productDescription: '',
                rate: '18%',
                uoM: 'KG',
                quantity: 1000,
                totalValues: 0,
                valueSalesExcludingST: 205000,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 36900,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '',
                fedPayable: 0,
                discount: 0,
                saleType: 'Toll Manufacturing',
                sroItemSerialNo: '',
            }),
        ],
    },
    SN012: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: 'SI-20250515-001',
        buyer: {
            ntcnic: '1000000000000',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '0101.2100',
                productDescription: 'TEST',
                rate: '1.43%',
                uoM: 'Numbers, pieces, units',
                quantity: 123,
                totalValues: 132,
                valueSalesExcludingST: 100,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 1.43,
                salesTaxWithheldAtSource: 2,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '1450(I)/2021',
                fedPayable: 0,
                discount: 0,
                saleType: 'Petroleum Products',
                sroItemSerialNo: '4',
            }),
        ],
    },
    SN013: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: 'SI-20250515-001',
        buyer: {
            ntcnic: '1000000000000',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '0101.2100',
                productDescription: 'TEST',
                rate: '5%',
                uoM: 'Numbers, pieces, units',
                quantity: 123,
                totalValues: 212,
                valueSalesExcludingST: 1000,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 50,
                salesTaxWithheldAtSource: 11,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '1450(I)/2021',
                fedPayable: 0,
                discount: 0,
                saleType: 'Electricity Supply to Retailers',
                sroItemSerialNo: '4',
            }),
        ],
    },
    SN014: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: 'SI-20250515-001',
        buyer: {
            ntcnic: '1000000000000',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '0101.2100',
                productDescription: 'TEST',
                rate: '18%',
                uoM: 'Numbers, pieces, units',
                quantity: 123,
                totalValues: 0,
                valueSalesExcludingST: 1000,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 180,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '',
                fedPayable: 0,
                discount: 0,
                saleType: 'Gas to CNG stations',
                sroItemSerialNo: '',
            }),
        ],
    },
    SN015: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: 'SI-20250515-001',
        buyer: {
            ntcnic: '1000000000000',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '0101.2100',
                productDescription: 'TEST',
                rate: '18%',
                uoM: 'Numbers, pieces, units',
                quantity: 123,
                totalValues: 0,
                valueSalesExcludingST: 1234,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 222.12,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: 'NINTH SCHEDULE',
                fedPayable: 0,
                discount: 0,
                saleType: 'Mobile Phones',
                sroItemSerialNo: '1(A)',
            }),
        ],
    },
    SN016: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: '',
        buyer: {
            ntcnic: '1000000000078',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '0101.2100',
                productDescription: 'test',
                rate: '5%',
                uoM: 'Numbers, pieces, units',
                quantity: 1,
                totalValues: 0,
                valueSalesExcludingST: 100,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 5,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '',
                fedPayable: 0,
                discount: 0,
                saleType: 'Processing/Conversion of Goods',
                sroItemSerialNo: '',
            }),
        ],
    },
    SN017: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: '',
        buyer: {
            ntcnic: '7000009',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '0101.2100',
                productDescription: 'TEST',
                rate: '8%',
                uoM: 'Numbers, pieces, units',
                quantity: 1,
                totalValues: 0,
                valueSalesExcludingST: 100,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 8,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '',
                fedPayable: 0,
                discount: 0,
                saleType: 'Goods (FED in ST Mode)',
                sroItemSerialNo: '',
            }),
        ],
    },
    SN018: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: 'SI-20250421-001',
        buyer: {
            ntcnic: '1000000000056',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '0101.2100',
                productDescription: 'TEST',
                rate: '8%',
                uoM: 'Numbers, pieces, units',
                quantity: 20,
                totalValues: 0,
                valueSalesExcludingST: 1000,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 80,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '',
                fedPayable: 0,
                discount: 0,
                saleType: 'Services (FED in ST Mode)',
                sroItemSerialNo: '',
            }),
        ],
    },
    SN019: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: 'SI-20250421-001',
        buyer: {
            ntcnic: '1000000000000',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '0101.2900',
                productDescription: 'TEST',
                rate: '5%',
                uoM: 'Numbers, pieces, units',
                quantity: 1,
                totalValues: 0,
                valueSalesExcludingST: 100,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 5,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: 'ICTO TABLE I',
                fedPayable: 0,
                discount: 0,
                saleType: 'Services',
                sroItemSerialNo: '1(ii)(ii)(a)',
            }),
        ],
    },
    SN020: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: 'SI-20250421-001',
        buyer: {
            ntcnic: '1000000000000',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '0101.2900',
                productDescription: 'TEST',
                rate: '1%',
                uoM: 'Numbers, pieces, units',
                quantity: 122,
                totalValues: 0,
                valueSalesExcludingST: 1000,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 10,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '6th Schd Table III',
                fedPayable: 0,
                discount: 0,
                saleType: 'Electric Vehicle',
                sroItemSerialNo: '20',
            }),
        ],
    },
    SN021: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: 'SI-20250421-001',
        buyer: {
            ntcnic: '1000000000000',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                // HS code for Portland cement (grey) — actual cement HS code
                // UOM from PRAL /pdi/v2/HS_UOM?hs_code=2523.2900 → KG
                // Rate format follows PRAL ratE_DESC convention (lowercase "rupees")
                hsCode: '2523.2900',
                productDescription: 'TEST',
                rate: 'rupees 3 per Kg',
                uoM: 'KG',
                quantity: 1000,
                totalValues: 0,
                valueSalesExcludingST: 100000,
                fixedNotifiedValueOrRetailPrice: 3,
                salesTaxApplicable: 3000,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '',
                fedPayable: 0,
                discount: 0,
                saleType: 'Cement /Concrete Block',
                sroItemSerialNo: '',
            }),
        ],
    },
    SN022: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: 'SI-20250421-001',
        buyer: {
            ntcnic: '1000000000000',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '3104.2000',
                productDescription: 'TEST',
                rate: '18% along with rupees 60 per kilogram',
                uoM: 'KG',
                quantity: 1,
                totalValues: 0,
                valueSalesExcludingST: 100,
                fixedNotifiedValueOrRetailPrice: 60,
                salesTaxApplicable: 78,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: 'EIGHTH SCHEDULE Table 1',
                fedPayable: 0,
                discount: 0,
                saleType: 'Potassium Chlorate',
                sroItemSerialNo: '56',
            }),
        ],
    },
    SN023: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: 'SI-20250421-001',
        buyer: {
            ntcnic: '1000000000000',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                // HS code for natural gas in gaseous state (CNG)
                // UOM from PRAL /pdi/v2/HS_UOM?hs_code=2711.2100 → KG or MMBTU; use MMBTU for CNG billing
                // Rate format follows PRAL ratE_DESC convention (lowercase "rupees")
                // SRO 581(1)/2024 — Region-I rate: Rs.200 per MMBTU
                hsCode: '2711.2100',
                productDescription: 'TEST',
                rate: 'rupees 200 per MMBTU',
                uoM: 'MMBTU',
                quantity: 123,
                totalValues: 0,
                valueSalesExcludingST: 234,
                fixedNotifiedValueOrRetailPrice: 200,
                salesTaxApplicable: 24600,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '581(1)/2024',
                fedPayable: 0,
                discount: 0,
                saleType: 'CNG Sales',
                sroItemSerialNo: 'Region-I',
            }),
        ],
    },
    SN024: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: 'SI-20250421-001',
        buyer: {
            ntcnic: '1000000000000',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '0101.2100',
                productDescription: 'TEST',
                rate: '25%',
                uoM: 'Numbers, pieces, units',
                quantity: 123,
                totalValues: 0,
                valueSalesExcludingST: 1000,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 250,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '297(I)/2023-Table-I',
                fedPayable: 0,
                discount: 0,
                saleType: 'Goods as per SRO.297(|)/2023',
                sroItemSerialNo: '12',
            }),
        ],
    },
    SN025: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: '',
        buyer: {
            ntcnic: '1000000000078',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '0101.2100',
                productDescription: 'TEST',
                rate: '0%',
                uoM: 'Numbers, pieces, units',
                quantity: 1,
                totalValues: 0,
                valueSalesExcludingST: 100,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 0,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: 'EIGHTH SCHEDULE Table 1',
                fedPayable: 0,
                discount: 0,
                saleType: 'Non-Adjustable Supplies',
                sroItemSerialNo: '81',
            }),
        ],
    },
    SN026: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: 'SI-20250421-001',
        buyer: {
            ntcnic: '1000000000078',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '0101.2100',
                productDescription: 'TEST',
                rate: '18%',
                uoM: 'Numbers, pieces, units',
                quantity: 123,
                totalValues: 0,
                valueSalesExcludingST: 1000,
                fixedNotifiedValueOrRetailPrice: 0,
                salesTaxApplicable: 180,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '',
                fedPayable: 0,
                discount: 0,
                saleType: 'Goods at standard rate (default)',
                sroItemSerialNo: '',
            }),
        ],
    },
    SN027: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: '',
        buyer: {
            ntcnic: '7000006',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '0101.2100',
                productDescription: 'test',
                rate: '18%',
                uoM: 'Numbers, pieces, units',
                quantity: 1,
                totalValues: 118,
                valueSalesExcludingST: 100,
                fixedNotifiedValueOrRetailPrice: 100,
                salesTaxApplicable: 18,
                salesTaxWithheldAtSource: 0,
                extraTax: 0,
                furtherTax: 0,
                sroScheduleNo: '',
                fedPayable: 0,
                discount: 0,
                saleType: '3rd Schedule Goods',
                sroItemSerialNo: '',
            }),
        ],
    },
    SN028: {
        invoiceType: 'Sale Invoice',
        invoiceRefNo: '',
        buyer: {
            ntcnic: '1000000000000',
            businessName: 'FERTILIZER MANUFAC IRS NEW',
            province: 'Sindh',
            address: 'Karachi',
            registrationType: 'Unregistered',
        },
        items: [
            createItem({
                hsCode: '0101.2100',
                productDescription: 'TEST',
                rate: '1%',
                uoM: 'Numbers, pieces, units',
                quantity: 1,
                totalValues: 100,
                valueSalesExcludingST: 99.01,
                fixedNotifiedValueOrRetailPrice: 100,
                salesTaxApplicable: 0.99,
                salesTaxWithheldAtSource: 0,
                extraTax: '',
                furtherTax: 0,
                sroScheduleNo: 'EIGHTH SCHEDULE Table 1',
                fedPayable: 0,
                discount: 0,
                saleType: 'Goods at Reduced Rate',
                sroItemSerialNo: '70',
            }),
        ],
    },
}

function createPresetFromItem(item: DIInvoiceItem): ProductDIAutofillPreset {
    return {
        hsCode: item.hsCode,
        diRate: item.rate,
        diUOM: item.uoM,
        diSaleType: item.saleType,
        diFixedNotifiedValueOrRetailPrice: String(item.fixedNotifiedValueOrRetailPrice),
        diSalesTaxWithheldAtSource: String(item.salesTaxWithheldAtSource),
        extraTax: item.extraTax === '' ? '' : String(item.extraTax),
        furtherTax: String(item.furtherTax),
        fedPayable: String(item.fedPayable),
        sroScheduleNo: item.sroScheduleNo ?? '',
        sroItemSerialNo: item.sroItemSerialNo ?? '',
    }
}

function normalizeText(value: string | null | undefined) {
    return value?.trim().toLowerCase() ?? ''
}

function normalizeNumericValue(value: number | string | { toString(): string } | '' | null | undefined) {
    if (value === '') {
        return ''
    }

    const numericValue = Number(value ?? 0)
    return Number.isFinite(numericValue) ? numericValue.toFixed(2) : '0.00'
}

function createPresetFromMatchItem(item: SandboxScenarioMatchItem): ProductDIAutofillPreset {
    return {
        hsCode: item.hsCode?.trim() ?? '',
        diRate: item.diRate?.trim() ?? '',
        diUOM: item.diUOM?.trim() || item.unit?.trim() || '',
        diSaleType: item.diSaleType?.trim() ?? '',
        diFixedNotifiedValueOrRetailPrice: normalizeNumericValue(item.diFixedNotifiedValueOrRetailPrice),
        diSalesTaxWithheldAtSource: normalizeNumericValue(item.diSalesTaxWithheldAtSource),
        extraTax: item.extraTax === '' ? '' : normalizeNumericValue(item.extraTax),
        furtherTax: normalizeNumericValue(item.furtherTax),
        fedPayable: normalizeNumericValue(item.fedPayable),
        sroScheduleNo: item.sroScheduleNo?.trim() ?? '',
        sroItemSerialNo: item.sroItemSerialNo?.trim() ?? '',
    }
}

function normalizeComparablePreset(preset: ProductDIAutofillPreset) {
    return {
        diRate: normalizeText(preset.diRate),
        diUOM: normalizeText(preset.diUOM),
        diSaleType: normalizeText(preset.diSaleType),
        diFixedNotifiedValueOrRetailPrice: normalizeNumericValue(preset.diFixedNotifiedValueOrRetailPrice),
        diSalesTaxWithheldAtSource: normalizeNumericValue(preset.diSalesTaxWithheldAtSource),
        extraTax: preset.extraTax === '' ? '' : normalizeNumericValue(preset.extraTax),
        furtherTax: normalizeNumericValue(preset.furtherTax),
        fedPayable: normalizeNumericValue(preset.fedPayable),
        sroScheduleNo: normalizeText(preset.sroScheduleNo),
        sroItemSerialNo: normalizeText(preset.sroItemSerialNo),
    }
}

function matchScenarioCandidatesForItem(item: SandboxScenarioMatchItem, buyerRegistrationType: string | null | undefined) {
    const itemPreset = normalizeComparablePreset(createPresetFromMatchItem(item))
    const normalizedBuyerRegistrationType = normalizeText(buyerRegistrationType)

    return Object.keys(SCENARIO_TEMPLATES).filter((scenarioId) => {
        const template = SCENARIO_TEMPLATES[scenarioId]
        if (!template) {
            return false
        }

        if (
            normalizedBuyerRegistrationType
            && normalizeText(template.buyer.registrationType) !== normalizedBuyerRegistrationType
        ) {
            return false
        }

        return template.items.some((templateItem) => {
            const templatePreset = normalizeComparablePreset(createPresetFromItem(templateItem))
            return JSON.stringify(templatePreset) === JSON.stringify(itemPreset)
        })
    })
}

function rankScenarioCandidates(candidates: string[], businessActivity: string | null | undefined, sector: string | null | undefined) {
    if (candidates.length <= 1) {
        return candidates
    }

    const preferredCandidates = new Set(getRequiredScenarios(businessActivity ?? '', sector ?? ''))
    const requiredMatches = candidates.filter((candidate) => preferredCandidates.has(candidate))
    if (requiredMatches.length > 0) {
        candidates = requiredMatches
    }

    if (candidates.length <= 1) {
        return candidates
    }

    const normalizedActivity = normalizeText(businessActivity)
    const normalizedSector = normalizeText(sector)
    const shouldPreferRetailScenarios =
        normalizedActivity === 'retailer'
        || normalizedActivity === 'wholesaler'
        || normalizedSector === 'wholesale / retails'

    if (shouldPreferRetailScenarios) {
        const retailMatches = candidates.filter((candidate) => ['SN026', 'SN027', 'SN028'].includes(candidate))
        if (retailMatches.length > 0) {
            return retailMatches
        }
    }

    return candidates
}

function buildAutofillPresetMap() {
    const grouped = new Map<string, ProductDIAutofillPreset[]>()

    for (const template of Object.values(SCENARIO_TEMPLATES)) {
        for (const item of template.items) {
            const preset = createPresetFromItem(item)
            const existing = grouped.get(item.hsCode) ?? []
            existing.push(preset)
            grouped.set(item.hsCode, existing)
        }
    }

    const presets = new Map<string, ProductDIAutofillPreset>()

    for (const [hsCode, options] of grouped.entries()) {
        const uniqueSerialized = [...new Set(options.map((option) => JSON.stringify(option)))]
        if (uniqueSerialized.length === 1) {
            presets.set(hsCode, JSON.parse(uniqueSerialized[0]) as ProductDIAutofillPreset)
        }
    }

    return presets
}

const PRODUCT_DI_AUTOFILL_PRESETS = buildAutofillPresetMap()

function buildAutofillPresetOptionsMap() {
    const grouped = new Map<string, ProductDIAutofillPreset[]>()

    for (const template of Object.values(SCENARIO_TEMPLATES)) {
        for (const item of template.items) {
            const preset = createPresetFromItem(item)
            const existing = grouped.get(item.hsCode) ?? []

            if (!existing.some((option) => JSON.stringify(option) === JSON.stringify(preset))) {
                existing.push(preset)
            }

            grouped.set(item.hsCode, existing)
        }
    }

    for (const options of grouped.values()) {
        options.sort((left, right) => {
            if (left.diSaleType === 'Goods at standard rate (default)') {
                return -1
            }

            if (right.diSaleType === 'Goods at standard rate (default)') {
                return 1
            }

            return left.diSaleType.localeCompare(right.diSaleType)
        })
    }

    return grouped
}

const PRODUCT_DI_AUTOFILL_PRESET_OPTIONS = buildAutofillPresetOptionsMap()

export function getProductDIAutofillPreset(hsCode: string): ProductDIAutofillPreset | null {
    return PRODUCT_DI_AUTOFILL_PRESETS.get(hsCode) ?? null
}

export function getProductDIAutofillOptions(hsCode: string): ProductDIAutofillPreset[] {
    return PRODUCT_DI_AUTOFILL_PRESET_OPTIONS.get(hsCode) ?? []
}

export function inferSandboxScenario(params: {
    buyerRegistrationType?: string | null
    items: SandboxScenarioMatchItem[]
    businessActivity?: string | null
    sector?: string | null
}): SandboxScenarioInferenceResult {
    const { buyerRegistrationType, items, businessActivity, sector } = params

    if (items.length === 0) {
        return { scenarioId: null, candidates: [], reason: 'no-items' }
    }

    const itemCandidateSets = items.map((item) => matchScenarioCandidatesForItem(item, buyerRegistrationType))
    if (itemCandidateSets.some((candidates) => candidates.length === 0)) {
        return { scenarioId: null, candidates: [], reason: 'no-match' }
    }

    const sharedCandidates = itemCandidateSets.reduce<string[]>((intersection, candidates) => {
        if (intersection.length === 0) {
            return [...candidates]
        }

        return intersection.filter((candidate) => candidates.includes(candidate))
    }, [])

    if (sharedCandidates.length === 0) {
        return { scenarioId: null, candidates: [], reason: 'mixed-items' }
    }

    const rankedCandidates = rankScenarioCandidates(sharedCandidates, businessActivity, sector)
    if (rankedCandidates.length === 1) {
        return { scenarioId: rankedCandidates[0], candidates: rankedCandidates, reason: 'matched' }
    }

    return { scenarioId: null, candidates: rankedCandidates, reason: 'ambiguous' }
}

export function getScenarioTemplate(scenarioId: string): ScenarioTemplate {
    const template = SCENARIO_TEMPLATES[scenarioId]
    if (!template) {
        throw new Error(`Unsupported sandbox scenario: ${scenarioId}`)
    }

    return {
        ...template,
        buyer: { ...template.buyer },
        items: template.items.map((item) => ({ ...item })),
    }
}

export function getScenarioPreview(scenarioId: string): SandboxScenarioPreview {
    const template = getScenarioTemplate(scenarioId)
    return {
        scenarioId,
        buyer: template.buyer,
        items: template.items,
    }
}

export function buildSandboxScenarioPayload(
    scenarioId: string,
    seller: SellerIdentity,
): DIInvoicePayload {
    const template = getScenarioTemplate(scenarioId)

    return {
        invoiceType: template.invoiceType,
        invoiceDate: new Date().toISOString().split('T')[0],
        sellerNTNCNIC: seller.sellerNTNCNIC,
        sellerBusinessName: seller.sellerBusinessName,
        sellerProvince: seller.sellerProvince,
        sellerAddress: seller.sellerAddress,
        buyerNTNCNIC: template.buyer.ntcnic,
        buyerBusinessName: template.buyer.businessName,
        buyerProvince: template.buyer.province,
        buyerAddress: template.buyer.address,
        buyerRegistrationType: template.buyer.registrationType,
        invoiceRefNo: template.invoiceRefNo ?? '',
        scenarioId,
        items: template.items.map((item) => ({ ...item })),
    }
}