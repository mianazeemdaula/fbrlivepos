import { describe, expect, it } from 'vitest'
import { calculateDILineValues, calculateSalesTaxApplicable } from './tax'

describe('calculateDILineValues', () => {
    it('taxes the notified/retail price on 3rd Schedule lines', () => {
        // SN008 reference scenario: retail base 1000 @ 18% => 180 tax, 1180 total
        expect(calculateDILineValues({
            saleType: '3rd Schedule Goods',
            taxRate: 18,
            valueSalesExcludingST: 1000,
            fixedNotifiedValueOrRetailPrice: 1000,
        })).toEqual({ taxableValue: 1000, salesTaxApplicable: 180, totalValues: 1180 })
    })

    it('ignores the sale value when a notified price is present', () => {
        // Sold below MRP: tax still follows the notified price, not the 800 sale value
        expect(calculateDILineValues({
            saleType: '3rd Schedule Goods',
            taxRate: 18,
            valueSalesExcludingST: 800,
            fixedNotifiedValueOrRetailPrice: 1000,
        })).toEqual({ taxableValue: 1000, salesTaxApplicable: 180, totalValues: 1180 })
    })

    it('rounds tax and total to 2 decimals', () => {
        expect(calculateDILineValues({
            saleType: '3rd Schedule Goods',
            taxRate: 18,
            valueSalesExcludingST: 0,
            fixedNotifiedValueOrRetailPrice: 333.33,
        })).toEqual({ taxableValue: 333.33, salesTaxApplicable: 60, totalValues: 393.33 })
    })

    it('falls back to the sale value and reports totalValues 0 for standard-rate lines', () => {
        expect(calculateDILineValues({
            saleType: 'Goods at standard rate (default)',
            taxRate: 18,
            valueSalesExcludingST: 1000,
            fixedNotifiedValueOrRetailPrice: 0,
        })).toEqual({ taxableValue: 1000, salesTaxApplicable: 180, totalValues: 0 })
    })

    it('matches the sale type case-insensitively', () => {
        expect(calculateDILineValues({
            saleType: '3rd schedule goods',
            taxRate: 18,
            valueSalesExcludingST: 500,
            fixedNotifiedValueOrRetailPrice: null,
        })).toEqual({ taxableValue: 500, salesTaxApplicable: 90, totalValues: 590 })
    })

    it('yields no tax at a zero rate', () => {
        expect(calculateDILineValues({
            saleType: 'Exempt goods',
            taxRate: 0,
            valueSalesExcludingST: 1000,
        })).toEqual({ taxableValue: 1000, salesTaxApplicable: 0, totalValues: 0 })
    })
})

describe('calculateSalesTaxApplicable', () => {
    it('keeps the line-level retail price as the tax base', () => {
        // 3 units @ MRP 250 => base 750 @ 18%
        expect(calculateSalesTaxApplicable({
            saleType: '3rd Schedule Goods',
            taxRate: 18,
            taxableValue: 600,
            retailPrice: 750,
        })).toBe(135)
    })
})
