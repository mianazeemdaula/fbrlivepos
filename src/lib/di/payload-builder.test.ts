import { describe, expect, it } from 'vitest'
import { buildDIPayload } from './payload-builder'

describe('buildDIPayload rounding', () => {
    it('rounds item tax and monetary fields up to 2 decimal places', () => {
        const invoice = {
            id: 'inv-1',
            tenantId: 'tenant-1',
            invoiceNumber: 'INV-1001',
            invoiceDate: new Date('2026-08-05T00:00:00.000Z'),
            invoiceType: 'Sale Invoice',
            buyerRegistrationType: 'Registered' as const,
            buyerNTN: '1234567',
            buyerName: 'ABC Traders',
            buyerProvince: 'Punjab',
            buyerAddress: 'Lahore',
            diScenarioId: 'SN001',
            items: [
                {
                    id: 'item-1',
                    invoiceId: 'inv-1',
                    productId: 'prod-1',
                    hsCode: '1234.5678',
                    name: 'Test Item',
                    quantity: 3,
                    unit: 'PCS',
                    unitPrice: 33.3333,
                    taxAmount: 18.000000000000004,
                    taxRate: 18,
                    diRate: '18%',
                    diUOM: 'Numbers, pieces, units',
                    diSaleType: 'Goods at standard rate (default)',
                    diFixedNotifiedValueOrRetailPrice: 0,
                    diSalesTaxWithheldAtSource: 1.2345,
                    extraTax: 2.3456,
                    furtherTax: 3.4567,
                    fedPayable: 4.5678,
                    discount: 5.6789,
                    sroScheduleNo: '',
                    sroItemSerialNo: '',
                    lineTotal: 100,
                },
            ],
        }

        const creds = {
            id: 'cred-1',
            tenantId: 'tenant-1',
            environment: 'SANDBOX' as const,
            sellerNTN: '9999999',
            sellerCNIC: null,
            sellerBusinessName: 'My Enterprise',
            sellerProvince: 'Punjab',
            sellerAddress: 'Islamabad',
            encryptedSandboxToken: 'token',
            encryptedProductionToken: null,
            businessActivity: 'Retailer',
            sector: 'Wholesale / Retails',
            isProductionReady: false,
            sandboxCompleted: false,
            sandboxCompletedAt: null,
            irisRegistrationStatus: 'PENDING' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
        }

        const payload = buildDIPayload(invoice as any, creds as any, { isSandbox: true, scenarioId: 'SN001' })

        expect(payload.items[0]).toMatchObject({
            discount: 5.68,
            furtherTax: 3.46,
            fedPayable: 4.57,
            extraTax: 2.35,
            salesTaxWithheldAtSource: 1.23,
            valueSalesExcludingST: 82,
            salesTaxApplicable: 14.76,
        })
    })
})
