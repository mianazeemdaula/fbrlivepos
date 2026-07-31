import { isThirdScheduleSaleType, round2 } from './tax';

export interface ItemCalculationInput {
  saleType: string;                      // e.g. "Goods at standard rate (default)"
  rateDesc: string;                      // from FBR rate API or fallback, e.g. "18%"
  quantity: number;
  unitPrice: number;                     // sale price per unit (excl. tax)
  discount: number;                      // total discount amount
  fixedNotifiedValueOrRetailPrice?: number; // for retail‑price‑based or fixed‑per‑unit taxes
  furtherTaxPercent?: number;
  fedPercent?: number;
  extraTaxPercent?: number;
  isExempt?: boolean;
}

export interface ItemCalculationResult {
  valueSalesExcludingST: number;         // taxable value after discount
  salesTaxApplicable: number;
  furtherTax: number;
  fedPayable: number;
  extraTax: number;
  totalTax: number;
  totalInvoiceValue: number;              // taxable value + all taxes
}

/**
 * Parse a rate description like:
 *   "18%"
 *   "rupees 3 per Kg"
 *   "18% along with rupees 60 per kilogram"
 * Returns { percent: number, fixedPerUnit: number, uom?: string }
 */
function parseRateDescription(rateDesc: string): { percent: number; fixedPerUnit: number } {
  const lower = rateDesc.toLowerCase();
  let percent = 0;
  let fixedPerUnit = 0;

  // Extract percentage
  const percentMatch = lower.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) percent = parseFloat(percentMatch[1]);

  // Extract fixed per unit (rupees X per Y)
  const fixedMatch = lower.match(/(?:rupees?|rs\.?)\s*(\d+(?:\.\d+)?)\s*per\s*([a-z]+)/i);
  if (fixedMatch) fixedPerUnit = parseFloat(fixedMatch[1]);

  return { percent, fixedPerUnit };
}

/**
 * Core calculation – mirrors the logic used to generate SCENARIO_TEMPLATES.
 */
export function calculateItemTax(input: ItemCalculationInput): ItemCalculationResult {
  const {
    saleType,
    rateDesc,
    quantity,
    unitPrice,
    discount,
    fixedNotifiedValueOrRetailPrice,
    furtherTaxPercent = 0,
    fedPercent = 0,
    extraTaxPercent = 0,
    isExempt = false,
  } = input;

  // 1. Taxable value (default: sale price - discount)
  let taxableValue = Math.max(0, unitPrice * quantity - discount);

  // 2. Determine if tax base is "retail price" (3rd Schedule goods, etc.)
  //    Mirrors usesFixedNotifiedTaxBase() in ./tax — the notified/retail price,
  //    when present, is the base PRAL taxes.
  const usesRetailPrice = isThirdScheduleSaleType(saleType) ||
                          (fixedNotifiedValueOrRetailPrice !== undefined &&
                           fixedNotifiedValueOrRetailPrice > 0);

  if (usesRetailPrice && fixedNotifiedValueOrRetailPrice) {
    taxableValue = round2(fixedNotifiedValueOrRetailPrice);
  }

  // 3. Parse rate (percentage + possible fixed per unit)
  const { percent, fixedPerUnit } = parseRateDescription(rateDesc);

  // 4. Sales tax
  let salesTaxApplicable = 0;
  if (!isExempt && percent > 0) {
    salesTaxApplicable = (taxableValue * percent) / 100;
  }
  if (fixedPerUnit > 0) {
    salesTaxApplicable += fixedPerUnit * quantity;
  }
  salesTaxApplicable = round2(salesTaxApplicable);

  // 5. Further tax, FED, extra tax (always on taxableValue, as in scenarios)
  const furtherTax = round2((taxableValue * furtherTaxPercent) / 100);
  const fedPayable = round2((taxableValue * fedPercent) / 100);
  const extraTax = round2((taxableValue * extraTaxPercent) / 100);

  // 6. Totals
  const totalTax = round2(salesTaxApplicable + furtherTax + fedPayable + extraTax);
  const totalInvoiceValue = round2(taxableValue + totalTax);

  return {
    valueSalesExcludingST: taxableValue,
    salesTaxApplicable,
    furtherTax,
    fedPayable,
    extraTax,
    totalTax,
    totalInvoiceValue,
  };
}
