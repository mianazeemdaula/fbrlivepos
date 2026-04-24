# FBR Digital Invoicing — Sale Type Cascade Implementation Spec

**Copilot Implementation Document**  
Based on DI API v1.12 | For developer/copilot implementation use

---

## 1. Purpose & Cascade Overview

This document tells the developer/copilot exactly how to implement the dynamic cascade on the invoice line item form. Every field change triggers a chain reaction through the FBR APIs.

### 1.1 The Cascade Chain

| Step | User Action | API Called | Result |
|------|-------------|-----------|---------|
| 1 | Selects Sale Type | `/pdi/v2/SaleTypeToRate` | Rate dropdown populated |
| 2 | Selects Rate | `/pdi/v1/SroSchedule (if requiresSRO)` | SRO dropdown populated |
| 3 | Selects SRO | `/pdi/v2/SROItem (if requiresSR)` | SR# dropdown populated |
| 4 | Changes HS Code | `/pdi/v2/HS_UOM` | UOM auto-filled / locked |
| 5 | Enters Buyer NTN | `/dist/v1/Get_Reg_Type` | Buyer type auto-filled |

### 1.2 Fields that change per Sale Type

| Field | When Visible | When Calculated |
|-------|-------------|-----------------|
| Rate dropdown | Always | Populated from `/SaleTypeToRate` API |
| EXMT checkbox | Sale type = SN006 only | User toggles |
| FT % and FT Amt | `showFT = true` AND buyer is Unregistered | `taxableValue × ftPct%` |
| FED % and FED Amt | `showFED = true` (SN010/SN017/SN018) | `taxableValue × fedPct%` |
| Ext % and Ext Amt | `showEXT = true` (SN010/SN015/SN022) | `taxableValue × extPct%` |
| Fixed/Retail Price | `taxBase = retailPrice` (SN008/SN025/SN027) | User enters; GST uses this as base |
| SRO dropdown | `requiresSRO = true` | Populated from `/SroSchedule` API |
| SR# dropdown | `requiresSR = true` AND SRO selected | Populated from `/SROItem` API |

---

## 2. API Calls — Exact Endpoints

### 2.1 Pre-load on form open (cache these)

| Endpoint | Method | Purpose | Cache TTL |
|----------|--------|---------|-----------|
| `/pdi/v1/transtypecode` | GET | Transaction type IDs (input to SaleTypeToRate) | 1 month |
| `/pdi/v1/uom` | GET | All valid UOM options | 1 month |
| `/pdi/v1/provinces` | GET | Province codes and names | 1 year |
| `/pdi/v1/itemdesccode` | GET | HS code catalog | 1 week |

### 2.2 `/pdi/v2/SaleTypeToRate` — on Sale Type change

```
GET /pdi/v2/SaleTypeToRate
  ?date=<YYYY-MM-DD>
  &transTypeId=<from SALE_TYPE_CONFIG[saleTypeId].transTypeId>
  &originationSupplier=<sellerProvinceId>
Authorization: Bearer <token>

Response:
[  { "ratE_ID": 734, "ratE_DESC": "18%", "ratE_VALUE": 18 }, ...]

→ Populate Rate dropdown with ratE_DESC
→ Auto-select rates[0].ratE_DESC
→ Store ratE_ID for next call
```

**⚠️ Critical:** The rate field in the FBR invoice payload must be the exact ratE_DESC string from this API — not just the percentage number.

### 2.3 `/pdi/v1/SroSchedule` — on Rate change (if requiresSRO)

```
GET /pdi/v1/SroSchedule
  ?rate_id=<ratE_ID from previous call>
  &date=<invoiceDate>
  &origination_supplier_csv=<sellerProvinceId>
Authorization: Bearer <token>

Response:
[  { "srO_ID": 7, "srO_DESC": "Zero Rated Gas" }, ...]

→ Populate SRO dropdown with srO_DESC values
→ Store srO_ID for next call
→ Only call this if config.requiresSRO = true
```

### 2.4 `/pdi/v2/SROItem` — on SRO change (if requiresSR)

```
GET /pdi/v2/SROItem
  ?date=<invoiceDate>
  &sro_id=<srO_ID from previous call>
Authorization: Bearer <token>

Response:
[  { "srO_ITEM_ID": 17853, "srO_ITEM_DESC": "50" }, ...]

→ Populate SR# dropdown with srO_ITEM_DESC values
→ Only call this if config.requiresSR = true
```

### 2.5 `/pdi/v2/HS_UOM` — on HS Code change

```
GET /pdi/v2/HS_UOM
  ?hs_code=<selected hs code>
  &annexure_id=<sales annexure id>
Authorization: Bearer <token>

Response: [{ uoM_ID: 77, description: 'Square Meter' }]

→ If 1 result: auto-fill UOM field, lock it (no edit)
→ If multiple: show dropdown with only those options
→ If empty: show full UOM list from cached /pdi/v1/uom
```

---

## 3. Sale Type Master Config (all 28 types)

Define this as a constant in your frontend. Every sale type property controls which fields show, which APIs to call, and how tax is calculated.

### 3.1 Interface definition

```typescript
interface SaleTypeConfig {
  id:           string;    // SN001 ... SN028
  scenarioId:   string;    // sandbox scenarioId
  label:        string;    // exact saleType value for FBR payload
  transTypeId:  number;    // input to /SaleTypeToRate API
  requiresSRO:  boolean;   // show SRO dropdown
  requiresSR:   boolean;   // show SR# dropdown
  showFT:       boolean;   // show Further Tax fields
  showFED:      boolean;   // show FED fields
  showEXT:      boolean;   // show Extra Tax fields
  showEXMT:     boolean;   // show Exempt checkbox
  taxBase:      'value' | 'retailPrice' | 'zero';
  uomLocked:    string | null;  // forced UOM override
}
```

### 3.2 Full Sale Type Config Table

| ID | label (→ saleType field) | transTypeId | reqSRO | reqSR | showFT | showFED | showEXT | showEXMT | taxBase | uomLocked |
|----|---------------------------|------------|--------|-------|--------|---------|---------|----------|---------|-----------|
| SN001 | Goods at standard rate (default) | 18 | N | N | Y* | N | N | N | value | null |
| SN002 | Goods at standard rate (default) | 18 | N | N | Y* | N | N | N | value | null |
| SN003 | Steel melting and re-rolling | 82 | N | N | N | N | N | N | value | MT |
| SN004 | Ship breaking | 83 | N | N | N | N | N | N | value | MT |
| SN005 | Goods at Reduced Rate | 19 | Y | Y | N | N | N | N | value | null |
| SN006 | Exempt goods | 20 | Y | Y | N | N | N | Y | zero | null |
| SN007 | Goods at zero-rate | 21 | Y | N | N | N | N | N | zero | null |
| SN008 | 3rd Schedule Goods | 22 | N | N | N | N | N | N | retailPrice | null |
| SN009 | Cotton ginners | 87 | N | N | N | N | N | N | value | KG |
| SN010 | Telecommunication services | 23 | Y | N | N | Y | Y | N | value | null |
| SN011 | Toll Manufacturing | 24 | N | N | N | N | N | N | value | MT |
| SN012 | Petroleum Products | 25 | Y | Y | N | N | N | N | value | KG |
| SN013 | Electricity Supply to Retailers | 26 | Y | N | N | N | N | N | value | KWH |
| SN014 | Gas to CNG stations | 27 | Y | N | N | N | N | N | value | MMBTU |
| SN015 | Mobile Phones | 28 | Y | Y | N | N | Y | N | value | null |
| SN016 | Processing/ Conversion of Goods | 29 | N | N | N | N | N | N | value | null |
| SN017 | Goods (FED in ST Mode) | 30 | Y | Y | N | Y | N | N | value | null |
| SN018 | Services (FED in ST Mode) | 31 | Y | Y | N | Y | N | N | value | null |
| SN019 | Services | 32 | N | N | N | N | N | N | value | null |
| SN020 | Electric Vehicle | 33 | Y | Y | N | N | N | N | value | null |
| SN021 | Cement /Concrete Block | 34 | Y | Y | N | N | N | N | value | MT |
| SN022 | Potassium Chlorate | 35 | Y | Y | N | N | Y | N | value | KG |
| SN023 | CNG Sales | 36 | Y | N | N | N | N | N | value | KG |
| SN024 | Goods as per SRO.297(I)/2023 | 37 | Y | Y | N | N | N | N | value | null |
| SN025 | Non-Adjustable Supplies | 38 | Y | Y | N | N | N | N | retailPrice | null |
| SN026 | Goods at standard rate (default) | 18 | N | N | N | N | N | N | value | null |
| SN027 | 3rd Schedule Goods | 22 | N | N | N | N | N | N | retailPrice | null |
| SN028 | Goods at Reduced Rate | 19 | Y | Y | N | N | N | N | value | null |

**Note:** Y* for `showFT` means: field is rendered, but Further Tax amount is only calculated when `buyerRegistrationType = 'Unregistered'`. For registered buyers, FT % shows but FT Amt = 0.

**Note:** SN001 and SN002 share the same label and transTypeId. The distinction is buyer registration type — handle this at the invoice header level, not the sale type level.

**Note:** SN026, SN027, SN028 are only valid if the taxpayer is registered as a Retailer in their FBR Sales Tax profile.

---

## 4. Tax Calculation Formulas

### 4.1 Taxable Value (always compute first)

```
taxableValue = (quantity × salePricePerUnit) - discount
             = Math.max(0, quantity * salePricePerUnit - discount)
```

### 4.2 GST Amount

```javascript
function calcGST(config, taxableValue, fixedRetailPrice, qty, rateNum, isExempt) {
  if (isExempt || config.taxBase === 'zero') return 0;

  if (config.taxBase === 'retailPrice') {
    // 3rd Schedule (SN008/SN025/SN027) — base is printed retail price
    return fixedRetailPrice * qty * (rateNum / 100);
  }

  // All other sale types — base is taxable value
  return taxableValue * (rateNum / 100);
}

// rateNum = numeric portion of rate: '18%' → 18, '1%' → 1, 'Exempt' → 0
```

### 4.3 Further Tax (FT)

```javascript
function calcFT(config, buyerRegType, taxableValue, ftPct) {
  if (!config.showFT)                     return 0;
  if (buyerRegType !== 'Unregistered')    return 0;
  return taxableValue * (ftPct / 100);
  // ftPct default = 3; user can edit the field
}

// FT applies ONLY to: SN001 / SN002 with Unregistered buyer
// FT = 3% × taxableValue  (not on GST — on the value before tax)
```

### 4.4 FED Amount

```javascript
function calcFED(config, taxableValue, fedPct) {
  if (!config.showFED) return 0;
  return taxableValue * (fedPct / 100);
  // fedPct: user enters manually; often embedded in rate description
  // Applies to: SN010 (Telecom), SN017, SN018
}
```

### 4.5 Extra Tax

```javascript
function calcEXT(config, taxableValue, extPct) {
  if (!config.showEXT) return 0;
  return taxableValue * (extPct / 100);
  // Applies to: SN010 (Telecom), SN015 (Mobile Phones), SN022 (Potassium Chlorate)
}
```

### 4.6 Total Tax and Value Including Tax

```
totalTax     = gstAmt + ftAmt + fedAmt + extAmt;
valueInclTax = taxableValue + totalTax;
```

### 4.7 Special: 3rd Schedule (SN008 / SN027)

FBR validates that the tax is based on the printed retail price, NOT the ex-factory taxable value. Error code 0102 is returned if the calculation is wrong.

```javascript
// Correct:
salesTaxApplicable = fixedNotifiedValueOrRetailPrice * quantity * (rate / 100);
valueSalesExcludingST = taxableValue;   // still the ex-factory value

// Wrong (FBR rejects with error 0102):
// salesTaxApplicable = taxableValue * (rate / 100);  ← DO NOT DO THIS
```

### 4.8 Special: Potassium Chlorate (SN022)

FBR applies a specific per-KG formula. Error code 0103 is returned if the calculation does not match.

```
// Tax is quantity-based using notified price per KG
// Let FBR validate — enter the correct calculated value
// Error 0103: 'Calculated tax for Potassium Chlorate does not match'
```

---

## 5. FBR Payload — Field Mapping

### 5.1 Invoice Item payload structure

```typescript
interface FBRInvoiceItem {
  hsCode:                          string;  // 'XXXX.XXXX'
  productDescription:              string;
  rate:                            string;  // ratE_DESC from API EXACTLY
  uoM:                             string;  // description from /uom API
  quantity:                        number;  // 4 decimal places
  totalValues:                     number;  // valueInclTax
  valueSalesExcludingST:           number;  // taxableValue
  fixedNotifiedValueOrRetailPrice: number;  // retail price (3rd Sched); else 0
  salesTaxApplicable:              number;  // gstAmt (2dp)
  salesTaxWithheldAtSource:        number;  // STWH; 0 unless GOV/FTN buyer
  extraTax:                        number;  // extAmt
  furtherTax:                      number;  // ftAmt
  sroScheduleNo:                   string;  // srO_DESC; '' if not required
  fedPayable:                      number;  // fedAmt; 0 if not applicable
  discount:                        number;
  saleType:                        string;  // config.label EXACTLY
  sroItemSerialNo:                 string;  // srO_ITEM_DESC; '' if not required
}
```

### 5.2 UI field to FBR payload mapping

| UI Field | FBR JSON Field | Notes |
|----------|----------------|-------|
| Sale Type dropdown selected | `saleType` | `config.label` — case-sensitive exact string |
| Rate dropdown (ratE_DESC) | `rate` | Exact string from API, e.g. '18%' or '18% along with Rs.60 per Kg' |
| HS Code field | `hsCode` | Format: XXXX.XXXX |
| UOM field | `uoM` | Description string from `/uom` API |
| FBR Qty field | `quantity` | Send with 4 decimal places |
| Sale Price × Qty − Discount | `valueSalesExcludingST` | Taxable value (computed) |
| GST Amt (computed) | `salesTaxApplicable` | Rounded to 2 decimal places |
| FT Amt (computed) | `furtherTax` | 0 if registered buyer or not applicable |
| FED Amt (computed) | `fedPayable` | 0 if not FED scenario |
| Ext Amt (computed) | `extraTax` | 0 if not applicable |
| Discount field | `discount` | |
| Fixed/Retail Price field | `fixedNotifiedValueOrRetailPrice` | 3rd Schedule only; 0 otherwise |
| SRO dropdown (srO_DESC) | `sroScheduleNo` | Empty string if not required |
| SR# dropdown (srO_ITEM_DESC) | `sroItemSerialNo` | Empty string if not required |
| STWH field | `salesTaxWithheldAtSource` | 0 unless withholding agent |
| Value Incl. Tax (computed) | `totalValues` | Can also send 0 |

**⚠️ Critical:** The `saleType` and `rate` fields must be the EXACT strings from the FBR API / config — FBR does string matching on these values. Any variation in casing or spacing will cause rejection.

---

## 6. Cascade Implementation Code

### 6.1 On Sale Type change

```javascript
async function onSaleTypeChange(newId, { invoiceDate, sellerProvinceId, hsCode }) {
  const config = SALE_TYPE_CONFIG[newId];

  // 1. Reset downstream
  resetRates(); resetSRO(); resetSR();

  // 2. Fetch rates
  const rates = await fetchRates({
    transTypeId:         config.transTypeId,
    date:                invoiceDate,
    originationSupplier: sellerProvinceId,
  });

  // 3. Populate Rate dropdown
  setRateOptions(rates);
  setRate(rates[0]);   // auto-select first

  // 4. UOM enforcement
  if (FORCED_UOM[newId]) {
    setUOM(FORCED_UOM[newId]);
    lockUOM(true);
  } else {
    await resolveUOM(hsCode);
  }

  // 5. Auto-fetch SRO if needed
  if (config.requiresSRO && rates[0]) {
    await onRateChange(rates[0].id);
  }
}
```

### 6.2 On Rate change

```javascript
async function onRateChange(rateId, { invoiceDate, sellerProvinceId }) {
  const config = currentSaleTypeConfig();
  if (!config.requiresSRO) return;

  resetSRO(); resetSR();

  const sros = await fetchSROSchedule({
    rateId,
    date:                    invoiceDate,
    originationSupplierCsv:  sellerProvinceId,
  });

  setSROOptions(sros);
  setSRO(sros[0]);   // auto-select first

  if (config.requiresSR && sros[0]) {
    await onSROChange(sros[0].id);
  }
}
```

### 6.3 On SRO change

```javascript
async function onSROChange(sroId, { invoiceDate }) {
  const config = currentSaleTypeConfig();
  if (!config.requiresSR) return;

  resetSR();

  const items = await fetchSROItems({ sroId, date: invoiceDate });
  setSRItems(items);
  // Do NOT auto-select SR# — user must pick
}
```

### 6.4 API call wrappers

```javascript
const BASE = 'https://gw.fbr.gov.pk';
const hdrs = { Authorization: `Bearer ${token}` };

async function fetchRates({ transTypeId, date, originationSupplier }) {
  const r = await fetch(
    `${BASE}/pdi/v2/SaleTypeToRate?date=${date}` +
    `&transTypeId=${transTypeId}&originationSupplier=${originationSupplier}`,
    { headers: hdrs }
  );
  const d = await r.json();
  return d.map(x => ({ id: x.ratE_ID, desc: x.ratE_DESC, value: x.ratE_VALUE }));
}

async function fetchSROSchedule({ rateId, date, originationSupplierCsv }) {
  const r = await fetch(
    `${BASE}/pdi/v1/SroSchedule?rate_id=${rateId}&date=${date}` +
    `&origination_supplier_csv=${originationSupplierCsv}`,
    { headers: hdrs }
  );
  const d = await r.json();
  return d.map(x => ({ id: x.srO_ID, desc: x.srO_DESC }));
}

async function fetchSROItems({ sroId, date }) {
  const r = await fetch(
    `${BASE}/pdi/v2/SROItem?date=${date}&sro_id=${sroId}`,
    { headers: hdrs }
  );
  const d = await r.json();
  return d.map(x => ({ id: x.srO_ITEM_ID, desc: x.srO_ITEM_DESC }));
}
```

---

## 7. UOM Lock Rules

These UOMs are ALWAYS enforced by FBR regardless of the HS_UOM API response. Lock these in the UI as non-editable when the sale type is selected.

| Sale Type | Forced UOM | FBR Error if wrong |
|-----------|-----------|-------------------|
| SN013 — Electricity Supply to Retailers | KWH | 0164 / 0096 |
| SN012 — Petroleum Products | KG | 0165 / 0097 |
| SN023 — CNG Sales | KG | 0165 |
| SN009 — Cotton Ginners | KG | 0165 |
| SN003 — Steel Melting and Re-rolling | MT | 0099 |
| SN004 — Ship Breaking | MT | 0099 |
| SN011 — Toll Manufacturing (Steel) | MT | 0099 |
| SN021 — Cement / Concrete Block | MT | 0099 |
| SN014 — Gas to CNG Stations | MMBTU | 0099 |
| All other sale types | Per HS_UOM API response | 0099 |

```javascript
const FORCED_UOM = {
  SN013: 'KWH',
  SN012: 'KG',
  SN023: 'KG',
  SN009: 'KG',
  SN003: 'MT',
  SN004: 'MT',
  SN011: 'MT',
  SN021: 'MT',
  SN014: 'MMBTU',
};

if (FORCED_UOM[saleTypeId]) {
  setUOM(FORCED_UOM[saleTypeId]);
  setUOMLocked(true);  // render as readonly input
} else {
  const results = await fetchHsUOM(hsCode, annexureId);
  if (results.length === 1) {
    setUOM(results[0].description);
    setUOMLocked(true);
  } else {
    setUOMOptions(results.length > 1 ? results : allCachedUOMs);
    setUOMLocked(false);
  }
}
```

---

## 8. Client-side Validation

### 8.1 Field-level validations before API submission

| Check | Condition | Error message | FBR Error Code |
|-------|-----------|---------------|-----------------|
| HS Code required | `hsCode` is empty | Provide valid HS Code | 0019 / 0044 |
| HS Code format | not XXXX.XXXX pattern | HS Code format: XXXX.XXXX | 0052 |
| Rate required | no rate selected | Select a valid rate | 0020 / 0046 |
| UOM required | no UOM selected | UOM is required | 0099 |
| Quantity > 0 | `quantity <= 0` | Quantity must be greater than 0 | 0166 |
| SRO required | `requiresSRO = true`, sro empty | SRO Schedule is required | 0077 |
| SR# required | `requiresSR = true`, sro selected, sr empty | SR# is required | 0078 |
| Retail price for 3rd Sched | `taxBase = retailPrice`, price <= 0 | Fixed/Retail Price is required | 0090 |
| Cotton Ginners: registered buyer only | SN009 and buyer = Unregistered | Cotton Ginners requires registered buyer | 0100 |
| Rate 5% limit | `rate = 5%` and `taxableValue > 20000` | Rate 5% not allowed above Rs. 20,000 | 0079 |
| Electricity UOM | SN013 and `uom != KWH` | UOM must be KWH | 0164 |
| Petroleum UOM | SN012 and `uom != KG` | UOM must be KG | 0097 |

### 8.2 FBR error code → UI field mapping

When FBR returns an error on a line item, highlight the correct field:

| Error Code | Field to Highlight | User-facing Message |
|------------|-------------------|---------------------|
| 0019 / 0044 | `hsCode` | Provide valid HS Code |
| 0052 | `hsCode` / `saleType` | HS Code does not match this sale type |
| 0020 / 0046 | `rate` | Rate is required for this sale type |
| 0077 | `sroScheduleNo` | SRO Schedule is required |
| 0078 | `sroItemSerialNo` | SR# is required for selected SRO |
| 0096 / 0164 | `uom` | UOM must be KWH for this product |
| 0097 / 0165 | `uom` | UOM must be KG |
| 0099 | `uom` | UOM must match the selected HS Code |
| 0079 / 0170 | `rate` | Rate 5% not allowed when value exceeds Rs. 20,000 |
| 0089 | `fedPayable` | FED Charged is required |
| 0090 | `fixedNotifiedValueOrRetailPrice` | Fixed/Retail Price is required |
| 0095 | `extraTax` | Extra Tax is required |
| 0080 | `furtherTax` | Further Tax is required |
| 0102 | `salesTaxApplicable` | 3rd Schedule tax calculation is incorrect |
| 0103 | `salesTaxApplicable` | Potassium Chlorate tax calculation is incorrect |
| 0104 | `salesTaxApplicable` | Tax percentage does not match the selected rate |
| 0100 | `buyerRegistrationType` | Cotton Ginners: buyer must be Registered |

---

## 9. Sandbox vs Production Handling

| Behaviour | Sandbox | Production |
|-----------|---------|------------|
| `scenarioId` field | REQUIRED — include in payload | OMIT — do not send |
| Token | Sandbox Bearer token | Production Bearer token |
| URL | Same endpoint URLs | Same endpoint URLs |
| `invoiceRefNo` format | Any test value | Real invoice ref (Debit Notes only) |
| FBR Invoice Number | Issued (test) | Issued (real) |

```javascript
// Resolve which scenarioId to send based on sale type + buyer type
function getScenarioId(saleTypeId, buyerRegType) {
  if (saleTypeId === 'SN001') {
    // SN001 = registered, SN002 = unregistered (same saleType string)
    return buyerRegType === 'Registered' ? 'SN001' : 'SN002';
  }
  return saleTypeId;  // all others map directly
}

const payload = {
  ...invoiceHeader,
  ...(isSandbox ? { scenarioId: getScenarioId(saleTypeId, buyerRegType) } : {}),
  items: lineItems.map(buildItemPayload),
};
```

---

## 10. Copilot Implementation Checklist

Every item below must be implemented for FBR compliance:

### Sale Type Cascade
- [ ] SALE_TYPE_CONFIG object defined with all 28 entries (Section 3.2)
- [ ] On sale type change: call `/SaleTypeToRate` with `config.transTypeId`
- [ ] Rate dropdown populated from `ratE_DESC` values; `ratE_ID` stored
- [ ] If `requiresSRO`: auto-call `/SroSchedule` on rate change
- [ ] SRO dropdown shown only when `requiresSRO = true`
- [ ] If `requiresSR` AND SRO selected: call `/SROItem` on SRO change
- [ ] SR# dropdown shown only when `requiresSR = true` AND SRO is selected
- [ ] SR# is never auto-selected — user must pick

### Field Visibility
- [ ] EXMT checkbox: only visible for SN006
- [ ] FT fields: rendered when `showFT = true`; amount = 0 for registered buyers
- [ ] FED fields: rendered only when `showFED = true`
- [ ] EXT fields: rendered only when `showEXT = true`
- [ ] Fixed/Retail Price field: shown only when `taxBase = 'retailPrice'`

### UOM
- [ ] FORCED_UOM map applied on sale type change before HS_UOM API call
- [ ] HS_UOM API called on every HS code change
- [ ] UOM field locked (readonly) when single result from HS_UOM API

### Tax Calculation
- [ ] GST base = `retailPrice × qty` for SN008/SN025/SN027; else = `taxableValue`
- [ ] GST = 0 for SN006 and SN007 (and when EXMT checkbox is checked)
- [ ] FT = `taxableValue × 3%` only for Unregistered buyers on applicable types
- [ ] FED calculated separately from GST for SN010/SN017/SN018
- [ ] `totalTax = GST + FT + FED + EXT`
- [ ] `valueInclTax = taxableValue + totalTax`

### FBR Payload
- [ ] `saleType = config.label` (exact string, case-sensitive)
- [ ] `rate = ratE_DESC` from API (exact string — not just the percentage)
- [ ] `sroScheduleNo = srO_DESC` from API; empty string if not required
- [ ] `sroItemSerialNo = srO_ITEM_DESC` from API; empty string if not required
- [ ] `furtherTax = 0` for registered buyers even if sale type supports FT
- [ ] `fedPayable` required and non-zero for SN017 and SN018
- [ ] `fixedNotifiedValueOrRetailPrice = 0` for all non-3rd-schedule items
- [ ] `scenarioId`: sent in sandbox, omitted in production

### Invoice Lifecycle
- [ ] DRAFT status: local only, no FBR call, all fields editable
- [ ] VALIDATED status: `/validateinvoicedata` returned 00, no FBR number yet
- [ ] Any field edit after VALIDATED resets status to DRAFT
- [ ] CONFIRMED status: `/postinvoicedata` returned 00, FBR number stored, fields locked
- [ ] Corrections to CONFIRMED invoices: Debit Note only (within 180 days)

---

**FBR DI Cascade Implementation Spec — Based on PRAL DI API v1.12, April 2025**  
For Internal Developer Use
