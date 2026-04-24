# FBR Digital Invoicing (DI) — Complete Developer & Integration Documentation

> **Version:** Based on PRAL DI API Specification v1.12 (April 2025)
> **Audience:** Backend developers, ERP integrators, compliance engineers

---

## Table of Contents

1. [System Overview & Integration Architecture](#1-system-overview--integration-architecture)
2. [Authentication & Security](#2-authentication--security)
3. [API Wireframes — All Endpoints](#3-api-wireframes--all-endpoints)
   - 3.1 Core Invoicing APIs
   - 3.2 Reference / Lookup APIs
4. [Invoice Lifecycle: Draft → Validate → Confirm](#4-invoice-lifecycle-draft--validate--confirm)
5. [Sale Types, SR Numbers, Tax Rates & SR Items — Full Concept](#5-sale-types-sr-numbers-tax-rates--sr-items--full-concept)
6. [Business Activity & Sector → Applicable Scenarios Matrix](#6-business-activity--sector--applicable-scenarios-matrix)
7. [HS Code & Unit of Measurement (UOM) — How They Interact](#7-hs-code--unit-of-measurement-uom--how-they-interact)
8. [Prisma Schema](#8-prisma-schema)
9. [Sales Error Code Reference](#9-sales-error-code-reference)
10. [Purchase Error Code Reference](#10-purchase-error-code-reference)
11. [QR Code & Logo Requirements](#11-qr-code--logo-requirements)

---

## 1. System Overview & Integration Architecture

### What is FBR Digital Invoicing?

Pakistan's Federal Board of Revenue (FBR), through PRAL (Pakistan Revenue Automation Pvt. Ltd.), mandates that Supply Chain Operators (SCOs) — manufacturers, importers, distributors, wholesalers, retailers, exporters, and service providers — submit every taxable invoice to the FBR DI system in real time.

The ERP or POS system does **not** merely store invoices locally. It must:
1. Build a structured JSON payload for each invoice.
2. POST it to the FBR Gateway (`gw.fbr.gov.pk`) with a Bearer token.
3. Receive back an FBR-assigned Invoice Number.
4. Print that invoice number + a QR code on the physical/digital invoice.

### Integration Flow Diagram

```
┌──────────────────────────────┐
│  Your ERP / POS / Billing    │
│  System                      │
│                              │
│  1. User creates invoice     │
│  2. System builds JSON       │
│  3. Calls POST API  ─────────┼──► FBR Gateway (gw.fbr.gov.pk)
│  4. Receives FBR Inv No ◄────┼───── Returns Invoice Number
│  5. Prints QR + Logo         │
└──────────────────────────────┘
         │
         │ (Optional Pre-check before committing)
         ▼
┌──────────────────────────────┐
│  validateinvoicedata API     │
│  (Dry-run — no FBR number    │
│   issued, just validation)   │
└──────────────────────────────┘
```

### Key Design Principles

| Principle | Detail |
|---|---|
| **Real-time only** | Invoices must be submitted at the time of creation, not in batches |
| **Single token** | One Bearer token per NTN/CNIC; valid for 5 years |
| **Same URL, different routing** | Sandbox and Production share the same endpoint URLs; routing is determined by which token you use |
| **Item-level validation** | Each line item in an invoice is independently validated and gets its own FBR line item number |
| **Buyer type drives tax logic** | Whether the buyer is Registered or Unregistered changes which tax fields are mandatory |

---

## 2. Authentication & Security

### Token Format

All requests must include an `Authorization` header:

```
Authorization: Bearer <YOUR_5_YEAR_TOKEN>
```

The token is issued by PRAL, tied to the seller's NTN/CNIC, and valid for 5 years. A new token must be requested before expiry.

### Environment Routing

| Environment | Determined By |
|---|---|
| **Sandbox** | Sandbox token (+ `scenarioId` field required in payload) |
| **Production** | Production token (`scenarioId` must be omitted) |

> **Critical:** The URLs are identical in both environments. Environment routing is entirely token-based. Never hardcode environment logic in your URL configuration.

### HTTP Status Codes (Global)

| Code | Meaning |
|---|---|
| `200` | Request processed (check `statusCode` inside response body) |
| `401` | Invalid or missing token |
| `500` | Internal server error — contact PRAL |

---

## 3. API Wireframes — All Endpoints

### 3.1 Core Invoicing APIs

---

#### `POST /di_data/v1/di/postinvoicedata`
**Sandbox:** `/di_data/v1/di/postinvoicedata_sb`

**Purpose:** Submit a finalized invoice to FBR. Returns an FBR-assigned invoice number.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body Schema:**

```
InvoicePayload
├── invoiceType          String    REQUIRED   "Sale Invoice" | "Debit Note"
├── invoiceDate          Date      REQUIRED   "YYYY-MM-DD"
├── sellerNTNCNIC        String    REQUIRED   7-digit NTN or 13-digit CNIC
├── sellerBusinessName   String    REQUIRED   Business name of seller
├── sellerProvince       String    REQUIRED   Province name (from /provinces API)
├── sellerAddress        String    REQUIRED   Physical address of seller
├── buyerNTNCNIC         String    COND       Required if buyer is Registered
├── buyerBusinessName    String    REQUIRED   Business name of buyer
├── buyerProvince        String    REQUIRED   Province name (from /provinces API)
├── buyerAddress         String    REQUIRED   Physical address of buyer
├── buyerRegistrationType String   REQUIRED   "Registered" | "Unregistered"
├── invoiceRefNo         String    COND       Required for Debit Note (22 or 28 chars)
├── scenarioId           String    SANDBOX    e.g. "SN001" (omit in Production)
└── items[]              Array     REQUIRED   One or more line items
    ├── hsCode                     String    REQUIRED   HS Code e.g. "0101.2100"
    ├── productDescription         String    REQUIRED   Description of goods/service
    ├── rate                       String    REQUIRED   Tax rate from /SaleTypeToRate API
    ├── uoM                        String    REQUIRED   UOM from /uom API
    ├── quantity                   Decimal   REQUIRED   Quantity sold
    ├── totalValues                Decimal   REQUIRED   Total value including tax
    ├── valueSalesExcludingST      Decimal   REQUIRED   Value before sales tax
    ├── fixedNotifiedValueOrRetailPrice Decimal REQUIRED  Notified retail price (0 if N/A)
    ├── salesTaxApplicable         Decimal   REQUIRED   Sales tax / FED in ST mode
    ├── salesTaxWithheldAtSource   Decimal   REQUIRED   STWH (0 if N/A)
    ├── extraTax                   Decimal   OPTIONAL   Extra tax (if applicable)
    ├── furtherTax                 Decimal   OPTIONAL   Further tax (12% on unreg buyers)
    ├── sroScheduleNo              String    OPTIONAL   SRO schedule number
    ├── fedPayable                 Decimal   OPTIONAL   Federal Excise Duty
    ├── discount                   Decimal   OPTIONAL   Discount amount
    ├── saleType                   String    REQUIRED   Sale type description
    └── sroItemSerialNo            String    OPTIONAL   Serial no in SRO
```

**Success Response (200):**
```json
{
  "invoiceNumber": "7000007DI1747119701593",
  "dated": "2025-05-13 12:01:41",
  "validationResponse": {
    "statusCode": "00",
    "status": "Valid",
    "error": "",
    "invoiceStatuses": [
      {
        "itemSNo": "1",
        "statusCode": "00",
        "status": "Valid",
        "invoiceNo": "7000007DI1747119701593-1",
        "errorCode": "",
        "error": ""
      }
    ]
  }
}
```

**Error Response (200 with invalid status):**
```json
{
  "dated": "2025-05-13 13:09:05",
  "validationResponse": {
    "statusCode": "01",
    "status": "Invalid",
    "errorCode": "0052",
    "error": "Provide proper HS Code with invoice no. null",
    "invoiceStatuses": null
  }
}
```

**Response Field Reference:**

| Field | Meaning |
|---|---|
| `invoiceNumber` | FBR-assigned master invoice number (store this permanently) |
| `statusCode` | `00` = Valid, `01` = Invalid |
| `invoiceStatuses[].invoiceNo` | FBR line-item number (e.g., `...701593-1` for item 1) |
| `invoiceStatuses[].errorCode` | Error code if item is invalid |

---

#### `POST /di_data/v1/di/validateinvoicedata`
**Sandbox:** `/di_data/v1/di/validateinvoicedata_sb`

**Purpose:** Dry-run validation of an invoice. **No FBR invoice number is issued.** Use this as a pre-flight check before `postinvoicedata`.

**Request Body:** Identical structure to `postinvoicedata`.

**Key Difference from Post:** Response does NOT contain `invoiceNumber`. It only returns `validationResponse`.

**Success Response (Valid):**
```json
{
  "dated": "2025-05-13 13:13:07",
  "validationResponse": {
    "statusCode": "00",
    "status": "Valid",
    "errorCode": null,
    "error": "",
    "invoiceStatuses": [
      {
        "itemSNo": "1",
        "statusCode": "00",
        "status": "Valid",
        "errorCode": null,
        "error": ""
      }
    ]
  }
}
```

**Error Response (Invalid item):**
```json
{
  "dated": "2025-05-13 13:13:54",
  "validationResponse": {
    "statusCode": "00",
    "status": "Invalid",
    "errorCode": null,
    "error": "",
    "invoiceStatuses": [
      {
        "itemSNo": "1",
        "statusCode": "01",
        "status": "Invalid",
        "errorCode": "0046",
        "error": "Provide rate."
      }
    ]
  }
}
```

---

### 3.2 Reference / Lookup APIs

All reference APIs use **HTTP GET**, require the Bearer token, and take no body. Some take query string parameters.

---

#### `GET /pdi/v1/provinces`
**Purpose:** Get list of valid province codes and descriptions.

**Response:**
```json
[
  { "stateProvinceCode": 7, "stateProvinceDesc": "PUNJAB" },
  { "stateProvinceCode": 8, "stateProvinceDesc": "SINDH" }
]
```

| Field | Use |
|---|---|
| `stateProvinceDesc` | Pass as `sellerProvince` / `buyerProvince` in invoice |

---

#### `GET /pdi/v1/doctypecode`
**Purpose:** Get valid document types (invoice types).

**Response:**
```json
[
  { "docTypeId": 4, "docDescription": "Sale Invoice" },
  { "docTypeId": 9, "docDescription": "Debit Note" }
]
```

---

#### `GET /pdi/v1/itemdesccode`
**Purpose:** Get HS Codes with their descriptions. Use to build your product catalog mapping.

**Response:**
```json
[
  { "hS_CODE": "8432.1010", "description": "CHISEL PLOUGHS (AGRICULTURAL MACHINERY)" },
  { "hS_CODE": "0304.7400", "description": "FISH FILLETS — HAKE, FRESH/CHILLED/FROZEN" }
]
```

> **Note:** This returns a large dataset. Cache it locally and refresh periodically.

---

#### `GET /pdi/v1/sroitemcode`
**Purpose:** Get SRO item IDs (used in `sroItemSerialNo` field).

**Response:**
```json
[
  { "srO_ITEM_ID": 724, "srO_ITEM_DESC": "9" },
  { "srO_ITEM_ID": 728, "srO_ITEM_DESC": "1" }
]
```

---

#### `GET /pdi/v1/transtypecode`
**Purpose:** Get transaction type IDs. Used as input to `/SaleTypeToRate` to filter applicable rates.

**Response:**
```json
[
  { "transactioN_TYPE_ID": 82,  "transactioN_DESC": "DTRE goods" },
  { "transactioN_TYPE_ID": 87,  "transactioN_DESC": "Special procedure cottonseed" },
  { "transactioN_TYPE_ID": 111, "transactioN_DESC": "Electricity Supplied to marble/granite industry" }
]
```

---

#### `GET /pdi/v1/uom`
**Purpose:** Get all valid Units of Measurement. The `uom` field in your invoice item must match the `description` from this API.

**Response:**
```json
[
  { "uoM_ID": 77, "description": "Square Metre" },
  { "uoM_ID": 13, "description": "KG" }
]
```

---

#### `GET /pdi/v1/SroSchedule?rate_id=413&date=04-Feb-2024&origination_supplier_csv=1`
**Purpose:** Get SRO schedules applicable for a given rate, date, and supplier province.

**Query Parameters:**

| Param | Description |
|---|---|
| `rate_id` | Rate ID from `/SaleTypeToRate` |
| `date` | Invoice date |
| `origination_supplier_csv` | Province ID(s) of seller |

**Response:**
```json
[
  { "srO_ID": 7, "srO_DESC": "Zero Rated Gas" },
  { "srO_ID": 8, "srO_DESC": "5th Schedule" }
]
```

---

#### `GET /pdi/v2/SaleTypeToRate?date=24-Feb-2024&transTypeId=18&originationSupplier=1`
**Purpose:** Get applicable tax rates for a given transaction type, date, and seller province. This drives the `rate` field in your invoice items.

**Query Parameters:**

| Param | Description |
|---|---|
| `date` | Invoice date |
| `transTypeId` | Transaction type ID from `/transtypecode` |
| `originationSupplier` | Province ID of seller |

**Response:**
```json
[
  { "ratE_ID": 734, "ratE_DESC": "18% along with rupees 60 per kilogram", "ratE_VALUE": 18 },
  { "ratE_ID": 280, "ratE_DESC": "0%", "ratE_VALUE": 0 }
]
```

> `ratE_DESC` is what goes in the `rate` field of your invoice item payload.

---

#### `GET /pdi/v2/HS_UOM?hs_code=5904.9000&annexure_id=3`
**Purpose:** **Critical lookup** — Given an HS code and sales annexure, returns the ONLY valid UOM for that product. If you send a different UOM, the invoice will be rejected.

**Query Parameters:**

| Param | Description |
|---|---|
| `hs_code` | The product HS code |
| `annexure_id` | Sales annexure ID |

**Response:**
```json
[
  { "uoM_ID": 77, "description": "Square Meter" }
]
```

---

#### `GET /pdi/v2/SROItem?date=2025-03-25&sro_id=389`
**Purpose:** Get items within a specific SRO schedule. Used to populate `sroItemSerialNo`.

**Query Parameters:**

| Param | Description |
|---|---|
| `date` | Reference date |
| `sro_id` | SRO ID from `/SroSchedule` |

**Response:**
```json
[
  { "srO_ITEM_ID": 17853, "srO_ITEM_DESC": "50" },
  { "srO_ITEM_ID": 17854, "srO_ITEM_DESC": "51" }
]
```

---

#### `GET /dist/v1/statl`
**Purpose:** Check if a taxpayer (buyer/seller) is ATL-active (Active Taxpayer List).

**Request Body:**
```json
{ "regno": "0788762", "date": "2025-05-18" }
```

**Response:**
```json
{ "status code": "01", "status": "In-Active" }
```

| Status Code | Meaning |
|---|---|
| `01` | In-Active |
| `02` | In-Active (different reason) |
| (active response) | Active taxpayer |

---

#### `GET /dist/v1/Get_Reg_Type`
**Purpose:** Verify whether a given NTN/CNIC is Registered or Unregistered for sales tax. Use this to auto-populate `buyerRegistrationType`.

**Request Body:**
```json
{ "Registration_No": "0788762" }
```

**Response:**
```json
{
  "statuscode": "00",
  "REGISTRATION_NO": "0788762",
  "REGISTRATION_TYPE": "Registered"
}
```

---

## 4. Invoice Lifecycle: Draft → Validate → Confirm

This describes the recommended internal flow for your ERP/system, not just the FBR API states.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     INVOICE LIFECYCLE                               │
│                                                                     │
│  USER CREATES INVOICE                                               │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────┐                                                    │
│  │    DRAFT    │  ← Local status. Invoice exists only in your DB.   │
│  │  status=0   │    No FBR interaction yet. User can edit freely.   │
│  └──────┬──────┘                                                    │
│         │  User clicks "Validate"                                   │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────┐               │
│  │  Call: POST /validateinvoicedata                │               │
│  │  (Dry-run — FBR validates but issues NO number) │               │
│  └──────────────────┬──────────────────────────────┘               │
│         │           │                                               │
│    statusCode       │                                               │
│       "01"         "00"                                             │
│    (Invalid)      (Valid)                                           │
│         │           │                                               │
│         ▼           ▼                                               │
│  ┌────────────┐  ┌──────────────┐                                  │
│  │   DRAFT    │  │  VALIDATED   │  ← Local status. FBR confirmed   │
│  │ (with      │  │  status=1    │    the data is correct.          │
│  │  errors    │  │              │    Still no FBR invoice number.  │
│  │  shown)    │  └──────┬───────┘                                  │
│  └────────────┘         │  User clicks "Submit / Confirm"           │
│                         ▼                                           │
│                ┌─────────────────────────────────────────┐         │
│                │  Call: POST /postinvoicedata             │         │
│                │  (Creates actual invoice in FBR system)  │         │
│                └──────────────────┬──────────────────────┘         │
│                         │         │                                 │
│                    statusCode      │                                │
│                      "01"        "00"                               │
│                   (Invalid)     (Valid)                             │
│                         │         │                                 │
│                         ▼         ▼                                 │
│                  ┌─────────┐  ┌───────────────────────────────┐    │
│                  │  DRAFT  │  │  CONFIRMED    status=2        │    │
│                  │(retry)  │  │                               │    │
│                  └─────────┘  │  ✓ FBR Invoice Number stored  │    │
│                               │  ✓ QR Code generated          │    │
│                               │  ✓ Invoice is LOCKED          │    │
│                               │  ✓ Cannot be edited           │    │
│                               └───────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### State Machine Rules

| Transition | Trigger | Effect |
|---|---|---|
| DRAFT → VALIDATED | `/validateinvoicedata` returns `statusCode: "00"` | Mark `status = VALIDATED`, store no FBR number |
| VALIDATED → DRAFT | User edits any field | Reset to DRAFT, clear validation result |
| DRAFT → CONFIRMED | `/postinvoicedata` returns `statusCode: "00"` | Store `fbrInvoiceNumber`, lock record |
| VALIDATED → CONFIRMED | `/postinvoicedata` returns `statusCode: "00"` | Store `fbrInvoiceNumber`, lock record |
| CONFIRMED → DEBIT NOTE | User creates correction | New invoice with `invoiceType: "Debit Note"` and `invoiceRefNo` pointing to original |

### Field Locking Rules

Once an invoice reaches **CONFIRMED** status:
- No fields may be edited
- Corrections must be made via a **Debit Note** (`invoiceType: "Debit Note"`, `invoiceRefNo` = original FBR invoice number)
- Debit Note date must be ≥ original invoice date
- Debit Note must be created within 180 days of the original invoice

---

## 5. Sale Types, SR Numbers, Tax Rates & SR Items — Full Concept

### 5.1 What is a Scenario (SR Number / SN)?

An **SR Number** (also called Scenario ID, e.g. `SN001`) defines the **type of supply transaction**. It determines:
- Which `saleType` string to use in the invoice
- Which tax rates are applicable
- Which UOMs are valid
- Whether SRO fields are required
- Whether FED fields apply

Think of the scenario as a "tax treatment profile" for an invoice line item.

### 5.2 Complete Scenario Reference Table

| Scenario | Description | Sale Type Value | Key Tax Rule |
|---|---|---|---|
| **SN001** | Goods at standard rate to **registered** buyers | `Goods at Standard Rate (default)` | 18% ST, further tax = 0 |
| **SN002** | Goods at standard rate to **unregistered** buyers | `Goods at Standard Rate (default)` | 18% ST + 3% further tax on value |
| **SN003** | Sale of Steel (Melted and Re-Rolled) | `Steel Melting and re-rolling` | Specific rate per MT; SRO required |
| **SN004** | Sale by Ship Breakers | `Ship breaking` | Sector-specific rate |
| **SN005** | Reduced rate sale | `Goods at Reduced Rate` | Rate < 18% per SRO schedule |
| **SN006** | Exempt goods sale | `Exempt Goods` | Rate = 0%, no tax charged |
| **SN007** | Zero rated sale | `Goods at zero-rate` | Rate = 0%, tax = 0, buyer can claim input |
| **SN008** | Sale of 3rd Schedule goods | `3rd Schedule Goods` | Tax on retail price (not ex-factory) |
| **SN009** | Cotton Spinners purchase from Cotton Ginners | `Cotton Ginners` | Purchase type; STWH = 0 or = ST |
| **SN010** | Telecom services | `Telecommunication services` | 19.5% FED charged; specific HS codes |
| **SN011** | Toll Manufacturing (Steel) | `Toll Manufacturing` | Only Steel sector; service fee taxed |
| **SN012** | Petroleum products | `Petroleum Products` | Petroleum levy + ST; KG/Litre UOM |
| **SN013** | Electricity supply to retailers | `Electricity Supply to Retailers` | KWH UOM mandatory |
| **SN014** | Gas to CNG stations | `Gas to CNG stations` | MMBTU or M3 UOM; specific HS code |
| **SN015** | Sale of mobile phones | `Mobile Phones` | Fixed amount per unit in addition to % |
| **SN016** | Processing / Conversion of Goods | `Processing/ Conversion of Goods` | Conversion fee is the taxable base |
| **SN017** | Sale of Goods where FED is charged in ST mode | `Goods (FED in ST Mode)` | `fedPayable` field populated |
| **SN018** | Services where FED charged in ST mode | `Services (FED in ST Mode)` | `fedPayable` + `salesTaxApplicable` both used |
| **SN019** | Services rendered or provided | `Services` | Standard 16% or 13% province-dependent |
| **SN020** | Sale of Electric Vehicles | `Electric Vehicle` | Reduced rate per EV SRO |
| **SN021** | Cement / Concrete Block | `Cement /Concrete Block` | Fixed amount per 50kg bag |
| **SN022** | Potassium Chlorate | `Potassium Chlorate` | Specific calculation formula |
| **SN023** | CNG sales | `CNG Sales` | Per KG rate; specific HS code |
| **SN024** | Goods listed in SRO 297(I)/2023 | `Goods as per SRO.297(I)/2023` | SRO schedule + item no. required |
| **SN025** | Drugs at fixed ST rate (8th Schedule Table 1 Serial 81) | `Non-Adjustable Supplies` | Fixed rate; non-adjustable input credit |
| **SN026** | Sale to End Consumer — standard goods (Retailer only) | `Goods at Standard Rate (default)` | Only if registered as Retailer |
| **SN027** | Sale to End Consumer — 3rd Schedule goods (Retailer only) | `3rd Schedule Goods` | Only if registered as Retailer |
| **SN028** | Sale to End Consumer — reduced rate (Retailer only) | `Goods at Reduced Rate` | Only if registered as Retailer |

### 5.3 How Sale Type Drives Tax Fields

```
Sale Type Selected
       │
       ├─► SN001/SN002 (Standard Rate)
       │       ├── rate = "18%"
       │       ├── salesTaxApplicable = valueSalesExcludingST × 0.18
       │       ├── furtherTax = 0 (SN001, registered buyer)
       │       └── furtherTax = valueSalesExcludingST × 0.03 (SN002, unregistered)
       │
       ├─► SN005 (Reduced Rate)
       │       ├── rate = per SRO (e.g., "5%", "7%", "10%")
       │       ├── salesTaxApplicable = valueSalesExcludingST × reduced_rate
       │       └── sroScheduleNo = REQUIRED
       │
       ├─► SN006 (Exempt)
       │       ├── rate = "0%"
       │       ├── salesTaxApplicable = 0
       │       └── furtherTax = 0
       │
       ├─► SN007 (Zero-Rated)
       │       ├── rate = "0%"
       │       ├── salesTaxApplicable = 0
       │       └── furtherTax = 0 (but buyer can claim input tax credit)
       │
       ├─► SN008 (3rd Schedule)
       │       ├── fixedNotifiedValueOrRetailPrice = REQUIRED (retail price)
       │       ├── salesTaxApplicable = fixedNotifiedValueOrRetailPrice × rate
       │       └── Tax base is retail price, NOT ex-factory value
       │
       ├─► SN017/SN018 (FED in ST Mode)
       │       ├── fedPayable = REQUIRED (FED component)
       │       └── salesTaxApplicable = ST component (separate from FED)
       │
       ├─► SN012 (Petroleum)
       │       ├── uoM MUST be "KG" or "Litre"
       │       ├── rate includes fixed levy per KG + percentage
       │       └── furtherTax = 0 (petroleum is exempt from further tax)
       │
       └─► SN013 (Electricity)
               ├── uoM MUST be "KWH"
               └── Error 0164 / 0096 if any other UOM used
```

### 5.4 SRO Items — When and How to Use Them

SRO (Statutory Regulatory Order) items apply when goods are taxed under a specific schedule rather than the standard Sales Tax Act rate.

**When `sroScheduleNo` is required:**
- SN005 (Reduced Rate) — must cite which SRO grants the reduction
- SN024 (SRO 297/2023 goods) — must cite SRO 297
- SN003/SN004 (Steel) — may cite relevant SRO

**Lookup flow for SRO fields:**
```
1. Call /SaleTypeToRate → get rate_id
2. Call /SroSchedule?rate_id=X → get sro_id + sro_desc
3. Call /SROItem?sro_id=X → get sro_item_id + sro_item_desc
4. Pass sro_item_desc as sroItemSerialNo in invoice
   Pass sro_desc as sroScheduleNo in invoice
```

---

## 6. Business Activity & Sector → Applicable Scenarios Matrix

This matrix defines which scenarios a business MUST support based on their **Business Activity** (what they do in the supply chain) and **Sector** (what industry they operate in).

> **How to read:** A Manufacturer in Steel can ONLY submit invoices with scenarios SN003, SN004, SN011. Submitting SN001 for a Steel manufacturer will be rejected.

### 6.1 Manufacturer

| Sector | Applicable Scenarios |
|---|---|
| All Other Sectors | SN001, SN002, SN005, SN006, SN007, SN015, SN016, SN017, SN021, SN022, SN024 |
| **Steel** | **SN003, SN004, SN011** |
| FMCG | SN001, SN002, SN005-SN007, SN015-SN017, SN021, SN022, SN024, **SN008** |
| Textile | SN001, SN002, SN005-SN007, SN015-SN017, SN021, SN022, SN024, **SN009** |
| Telecom | SN001, SN002, SN005-SN007, SN015-SN017, SN021, SN022, SN024, **SN010** |
| Petroleum | SN001, SN002, SN005-SN007, SN015-SN017, SN021, SN022, SN024, **SN012** |
| Electricity Distribution | SN001, SN002, SN005-SN007, SN015-SN017, SN021, SN022, SN024, **SN013** |
| Gas Distribution | SN001, SN002, SN005-SN007, SN015-SN017, SN021, SN022, SN024, **SN014** |
| Services | SN001, SN002, SN005-SN007, SN015-SN017, SN021, SN022, SN024, **SN018, SN019** |
| Automobile | SN001, SN002, SN005-SN007, SN015-SN017, SN021, SN022, SN024, **SN020** |
| CNG Stations | SN001, SN002, SN005-SN007, SN015-SN017, SN021, SN022, SN024, **SN023** |
| Pharmaceuticals | SN001, SN002, SN005-SN007, SN015-SN017, SN021, SN022, SN024 *(no SN025)* |
| Wholesale / Retail | SN001, SN002, SN005-SN007, SN015-SN017, SN021, SN022, SN024, **SN026, SN027, SN028, SN008** |

### 6.2 Importer

| Sector | Applicable Scenarios |
|---|---|
| All Other Sectors | SN001, SN002, SN005-SN007, SN015-SN017, SN021, SN022, SN024 |
| Steel | SN001, SN002, SN005-SN007, SN015-SN017, SN021, SN022, SN024, **SN003, SN004, SN011** |
| FMCG | + SN008 |
| Textile | + SN009 |
| Telecom | + SN010 |
| Petroleum | + SN012 |
| Electricity Distribution | + SN013 |
| Gas Distribution | + SN014 |
| Services | + SN018, SN019 |
| Automobile | + SN020 |
| CNG Stations | + SN023 |
| Pharmaceuticals | + SN025 |
| Wholesale / Retail | + SN026, SN027, SN028, SN008 |

### 6.3 Distributor

> Distributors always include SN026, SN027, SN028, SN008 as base scenarios.

| Sector | Applicable Scenarios |
|---|---|
| All Other Sectors | SN001, SN002, SN005-SN007, SN015-SN017, SN021, SN022, SN024, SN026-SN028, SN008 |
| Steel | SN003, SN004, SN011, SN026-SN028, SN008 |
| FMCG | SN008, SN026-SN028 |
| Textile | SN009, SN026-SN028, SN008 |
| Telecom | SN010, SN026-SN028, SN008 |
| Petroleum | SN012, SN026-SN028, SN008 |
| Electricity Distribution | SN013, SN026-SN028, SN008 |
| Gas Distribution | SN014, SN026-SN028, SN008 |
| Services | SN018, SN019, SN026-SN028, SN008 |
| Automobile | SN020, SN026-SN028, SN008 |
| CNG Stations | SN023, SN026-SN028, SN008 |
| Pharmaceuticals | SN025, SN026-SN028, SN008 |
| Wholesale / Retail | SN001, SN002, SN026-SN028, SN008 |

### 6.4 Wholesaler

> Identical structure to Distributor (same scenario sets apply per sector).

### 6.5 Exporter

> Exporters have the broadest scenario set. They combine the general scenarios (SN001-SN007, SN015-SN017, SN021-SN022, SN024) with their sector-specific ones. All exports may also be zero-rated (SN007).

| Sector | Applicable Scenarios |
|---|---|
| All Other Sectors | SN001, SN002, SN005-SN007, SN015-SN017, SN021, SN022, SN024 |
| Steel | + SN003, SN004, SN011 |
| FMCG | + SN008 |
| Textile | + SN009 |
| Telecom | + SN010 |
| Petroleum | + SN012 |
| Electricity Distribution | + SN013 |
| Gas Distribution | + SN014 |
| Services | + SN018, SN019 |
| Automobile | + SN020 |
| CNG Stations | + SN023 |
| Pharmaceuticals | + SN025 |
| Wholesale / Retail | + SN026, SN027, SN028, SN008 |

### 6.6 Retailer

> Retailers have SECTOR-SPECIFIC scenario sets. Most sectors drop the general SN001-SN007 range and only get sector-specific + retail end-consumer scenarios.

| Sector | Applicable Scenarios |
|---|---|
| All Other Sectors | SN001, SN002, SN005-SN007, SN015-SN017, SN021, SN022, SN024, SN026-SN028, SN008 |
| **Steel** | **SN003, SN004, SN011** *(only these three)* |
| **FMCG** | **SN026, SN027, SN028, SN008** *(retail only)* |
| Textile | SN009, SN026-SN028, SN008 |
| Telecom | SN010, SN026-SN028, SN008 |
| Petroleum | SN012, SN026-SN028, SN008 |
| Electricity Distribution | SN013, SN026-SN028, SN008 |
| Gas Distribution | SN014, SN026-SN028, SN008 |
| Services | SN018, SN019, SN026-SN028, SN008 |
| Automobile | SN020, SN026-SN028, SN008 |
| CNG Stations | SN023, SN026-SN028, SN008 |
| Pharmaceuticals | SN025, SN026-SN028, SN008 |
| Wholesale / Retail | SN026-SN028, SN008 |

### 6.7 Service Provider

> Service providers are centered around SN018 and SN019, combined with sector-specific scenarios.

| Sector | Applicable Scenarios |
|---|---|
| All Other Sectors | SN001, SN002, SN005-SN007, SN015-SN017, SN021, SN022, SN024, **SN018, SN019** |
| Steel | SN003, SN004, SN011, SN018, SN019 |
| FMCG | SN008, SN018, SN019 |
| Textile | SN009, SN018, SN019 |
| Telecom | SN010, SN018, SN019 |
| Petroleum | SN012, SN018, SN019 |
| Electricity Distribution | SN013, SN018, SN019 |
| Gas Distribution | SN014, SN018, SN019 |
| Services | SN018, SN019 |
| Automobile | SN020, SN018, SN019 |
| CNG Stations | SN023, SN018, SN019 |
| Pharmaceuticals | SN025, SN018, SN019 |
| Wholesale / Retail | SN026-SN028, SN008, SN018, SN019 |

### 6.8 Other (Non-Standard Business Activity)

> "Other" businesses get the full general set plus sector-specific additions, similar to Manufacturers/Importers.

| Sector | Applicable Scenarios |
|---|---|
| All Other Sectors | SN001, SN002, SN005-SN007, SN015-SN017, SN021, SN022, SN024 |
| Steel | + SN003, SN004, SN011 |
| FMCG | + SN008 |
| Textile | + SN009 |
| Telecom | + SN010 |
| Petroleum | + SN012 |
| Electricity Distribution | + SN013 |
| Gas Distribution | + SN014 |
| Services | + SN018, SN019 |
| Automobile | + SN020 |
| CNG Stations | + SN023 |
| Pharmaceuticals | + SN025 |
| Wholesale / Retail | + SN026, SN027, SN028, SN008 |

---

## 7. HS Code & Unit of Measurement (UOM) — How They Interact

### 7.1 Core Concept

An **HS Code** (Harmonized System Code) classifies a product under the international customs classification system. In the FBR DI system, certain HS codes are **locked to a specific UOM** — meaning you cannot use any other unit of measurement for that product, regardless of how your business normally measures it.

### 7.2 The HS_UOM API — Your Single Source of Truth

Before building your invoice item, always call:

```
GET /pdi/v2/HS_UOM?hs_code=<your_hs_code>&annexure_id=<annexure>
```

This returns the **only valid UOM** for that HS code. If you send a different UOM, FBR will reject the invoice with:

- **Error 0164:** "For selected HSCode only KWH UOM is allowed"
- **Error 0165:** "Provide UOM KG"
- **Error 0099:** "UOM is not valid. UOM must be according to given HS Code"

### 7.3 Sector-Specific UOM Rules

| Sector / Scenario | Mandatory UOM | Enforcement Error |
|---|---|---|
| **Electricity (SN013)** | `KWH` (Kilowatt-Hour) | 0164 / 0096 |
| **Petroleum (SN012)** | `KG` | 0165 / 0097 |
| **Gas / CNG (SN014, SN023)** | `MMBTU` or `M3` | Varies |
| **Cotton / Textile (SN009)** | `KG` | 0165 |
| **Cement (SN021)** | `MT` (Metric Ton) or `Bags` | Configured |
| **All other products** | Per HS_UOM API response | 0099 |

### 7.4 Implementation Pattern

```
User selects HS Code in invoice line item
         │
         ▼
Call /pdi/v2/HS_UOM?hs_code=<selected>&annexure_id=<annexure>
         │
         ▼
Response returns allowed UOM(s)
         │
    ┌────┴────┐
    │ 1 UOM  │ Multiple UOMs       No result
    │returned│ returned            (HS not restricted)
    │        │                              │
    ▼        ▼                              ▼
Auto-fill   Show dropdown         Show full UOM list
UOM field   with only those       to user
(locked,    options               (from /uom API)
no edit)
         │
         ▼
Proceed to invoice submission with validated UOM
```

### 7.5 HS Code Format Rules

- Format: `XXXX.XXXX` (4 digits, dot, 4 digits)
- Example valid: `0101.2100`, `5904.9000`, `8432.1010`
- Empty or malformed HS code → Error `0019` / `0044` / `0052`
- Wrong HS code for the selected sale type → Error `0052`

---

## 8. Prisma Schema

This schema covers the full data model for an ERP system integrating with the FBR DI API.

```prisma
// =============================================
// FBR DIGITAL INVOICING - PRISMA SCHEMA
// =============================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ── ENUMS ────────────────────────────────────

enum InvoiceStatus {
  DRAFT
  VALIDATED
  CONFIRMED
  FAILED
  CANCELLED
}

enum InvoiceType {
  SALE_INVOICE
  DEBIT_NOTE
}

enum BuyerRegistrationType {
  REGISTERED
  UNREGISTERED
}

enum BusinessActivity {
  MANUFACTURER
  IMPORTER
  DISTRIBUTOR
  WHOLESALER
  EXPORTER
  RETAILER
  SERVICE_PROVIDER
  OTHER
}

enum Sector {
  ALL_OTHER_SECTORS
  STEEL
  FMCG
  TEXTILE
  TELECOM
  PETROLEUM
  ELECTRICITY_DISTRIBUTION
  GAS_DISTRIBUTION
  SERVICES
  AUTOMOBILE
  CNG_STATIONS
  PHARMACEUTICALS
  WHOLESALE_RETAIL
}

enum Environment {
  SANDBOX
  PRODUCTION
}

// ── COMPANY / TAXPAYER ───────────────────────

model Company {
  id               String           @id @default(cuid())
  ntnCnic          String           @unique  // 7-digit NTN or 13-digit CNIC
  businessName     String
  province         String           // From /provinces API
  address          String
  businessActivity BusinessActivity
  sector           Sector
  isActive         Boolean          @default(true)
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  fbrTokens        FbrToken[]
  invoices         Invoice[]        @relation("SellerInvoices")
  purchaseInvoices Invoice[]        @relation("BuyerInvoices")

  @@map("companies")
}

// ── FBR API TOKENS ───────────────────────────

model FbrToken {
  id          String      @id @default(cuid())
  companyId   String
  company     Company     @relation(fields: [companyId], references: [id])
  token       String      @unique
  environment Environment
  issuedAt    DateTime
  expiresAt   DateTime    // 5 years from issuance
  isActive    Boolean     @default(true)
  createdAt   DateTime    @default(now())

  @@map("fbr_tokens")
}

// ── REFERENCE DATA (cached from FBR APIs) ────

model Province {
  id          Int      @id
  code        Int      @unique  // stateProvinceCode
  description String   // stateProvinceDesc
  syncedAt    DateTime @default(now())

  @@map("provinces")
}

model DocumentType {
  id          Int      @id  // docTypeId
  description String   // docDescription
  syncedAt    DateTime @default(now())

  @@map("document_types")
}

model HsCode {
  id          String   @id @default(cuid())
  code        String   @unique  // e.g. "0101.2100"
  description String
  syncedAt    DateTime @default(now())

  hsUomMappings HsUomMapping[]
  invoiceItems  InvoiceItem[]

  @@map("hs_codes")
}

model UnitOfMeasurement {
  id          Int      @id  // uoM_ID
  description String   // e.g. "KG", "KWH", "Square Metre"
  syncedAt    DateTime @default(now())

  hsUomMappings HsUomMapping[]
  invoiceItems  InvoiceItem[]

  @@map("units_of_measurement")
}

model HsUomMapping {
  id          String            @id @default(cuid())
  hsCodeId    String
  hsCode      HsCode            @relation(fields: [hsCodeId], references: [id])
  uomId       Int
  uom         UnitOfMeasurement @relation(fields: [uomId], references: [id])
  annexureId  Int               // Sales annexure ID
  syncedAt    DateTime          @default(now())

  @@unique([hsCodeId, annexureId])
  @@map("hs_uom_mappings")
}

model TransactionType {
  id          Int      @id  // transactioN_TYPE_ID
  description String   // transactioN_DESC
  syncedAt    DateTime @default(now())

  rates       TaxRate[]

  @@map("transaction_types")
}

model TaxRate {
  id                Int             @id  // ratE_ID
  description       String          // ratE_DESC — this is sent in invoice
  value             Decimal         // ratE_VALUE (e.g., 18)
  transactionTypeId Int
  transactionType   TransactionType @relation(fields: [transactionTypeId], references: [id])
  provinceId        Int             // originationSupplier
  effectiveDate     DateTime
  syncedAt          DateTime        @default(now())

  sroSchedules      SroSchedule[]
  invoiceItems      InvoiceItem[]

  @@map("tax_rates")
}

model SroSchedule {
  id          Int      @id  // srO_ID
  description String   // srO_DESC e.g. "Zero Rated Gas", "5th Schedule"
  rateId      Int
  rate        TaxRate  @relation(fields: [rateId], references: [id])
  syncedAt    DateTime @default(now())

  sroItems    SroItem[]

  @@map("sro_schedules")
}

model SroItem {
  id          Int         @id  // srO_ITEM_ID
  description String      // srO_ITEM_DESC — this is the serial no in SRO
  sroId       Int
  sro         SroSchedule @relation(fields: [sroId], references: [id])
  effectiveDate DateTime
  syncedAt    DateTime    @default(now())

  invoiceItems InvoiceItem[]

  @@map("sro_items")
}

model Scenario {
  id          String   @id  // e.g. "SN001"
  description String
  saleType    String   // The string to pass as saleType in invoice
  notes       String?

  businessScenarios BusinessScenario[]

  @@map("scenarios")
}

model BusinessScenario {
  id               String           @id @default(cuid())
  businessActivity BusinessActivity
  sector           Sector
  scenarioId       String
  scenario         Scenario         @relation(fields: [scenarioId], references: [id])

  @@unique([businessActivity, sector, scenarioId])
  @@map("business_scenarios")
}

// ── INVOICES ──────────────────────────────────

model Invoice {
  id                    String                @id @default(cuid())

  // Invoice type & status
  invoiceType           InvoiceType           @default(SALE_INVOICE)
  status                InvoiceStatus         @default(DRAFT)

  // Invoice date & number
  invoiceDate           DateTime
  internalRefNo         String?               // Your internal invoice number
  fbrInvoiceNumber      String?               // Assigned by FBR after POST (e.g. "7000007DI...")
  fbrInvoiceDate        DateTime?             // Timestamp from FBR response

  // Seller info
  sellerId              String
  seller                Company               @relation("SellerInvoices", fields: [sellerId], references: [id])

  // Buyer info
  buyerId               String?               // Null for unregistered buyers
  buyer                 Company?              @relation("BuyerInvoices", fields: [buyerId], references: [id])
  buyerNtnCnic          String?               // Direct storage for unregistered buyers
  buyerBusinessName     String
  buyerProvince         String
  buyerAddress          String
  buyerRegistrationType BuyerRegistrationType

  // For Debit Notes — reference to original invoice
  refInvoiceId          String?
  refInvoice            Invoice?              @relation("DebitNotes", fields: [refInvoiceId], references: [id])
  debitNotes            Invoice[]             @relation("DebitNotes")

  // Sandbox-only
  scenarioId            String?               // Required in Sandbox, omit in Production
  environment           Environment           @default(PRODUCTION)

  // FBR response tracking
  fbrStatusCode         String?               // "00" or "01"
  fbrStatus             String?               // "Valid" or "Invalid"
  fbrError              String?               // Error message if failed
  fbrRawResponse        Json?                 // Full raw response stored for audit

  // Validation tracking
  lastValidatedAt       DateTime?
  lastValidationResult  Json?

  // Metadata
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt
  confirmedAt           DateTime?             // When status became CONFIRMED

  items                 InvoiceItem[]
  submissionLogs        FbrSubmissionLog[]

  @@map("invoices")
}

model InvoiceItem {
  id                              String             @id @default(cuid())
  invoiceId                       String
  invoice                         Invoice            @relation(fields: [invoiceId], references: [id])

  // Item sequence
  itemSNo                         Int                // Line item number (1,2,3...)

  // Product classification
  hsCodeId                        String
  hsCode                          HsCode             @relation(fields: [hsCodeId], references: [id])
  productDescription              String

  // Tax configuration
  rateId                          Int?
  rate                            TaxRate?           @relation(fields: [rateId], references: [id])
  rateDescription                 String             // Actual string sent to FBR (e.g. "18%")
  saleType                        String             // Must match scenario's saleType
  scenarioId                      String?            // Which scenario this item uses

  // UOM
  uomId                           Int?
  uom                             UnitOfMeasurement? @relation(fields: [uomId], references: [id])
  uomDescription                  String             // Actual UOM string sent to FBR

  // Quantity & values
  quantity                        Decimal            @db.Decimal(18, 4)
  totalValues                     Decimal            @db.Decimal(18, 2)
  valueSalesExcludingST           Decimal            @db.Decimal(18, 2)
  fixedNotifiedValueOrRetailPrice Decimal            @default(0) @db.Decimal(18, 2)

  // Tax amounts
  salesTaxApplicable              Decimal            @db.Decimal(18, 2)
  salesTaxWithheldAtSource        Decimal            @default(0) @db.Decimal(18, 2)
  extraTax                        Decimal            @default(0) @db.Decimal(18, 2)
  furtherTax                      Decimal            @default(0) @db.Decimal(18, 2)
  fedPayable                      Decimal            @default(0) @db.Decimal(18, 2)

  // Discount
  discount                        Decimal            @default(0) @db.Decimal(18, 2)

  // SRO references
  sroScheduleId                   Int?
  sroSchedule                     SroSchedule?       @relation(fields: [sroScheduleId], references: [id])
  sroScheduleNo                   String?            // String sent to FBR
  sroItemId                       Int?
  sroItem                         SroItem?           @relation(fields: [sroItemId], references: [id])
  sroItemSerialNo                 String?            // String sent to FBR

  // FBR response for this line item
  fbrLineItemNumber               String?            // e.g. "7000007DI1747119701593-1"
  fbrStatusCode                   String?
  fbrStatus                       String?
  fbrErrorCode                    String?
  fbrError                        String?

  createdAt                       DateTime           @default(now())
  updatedAt                       DateTime           @updatedAt

  @@unique([invoiceId, itemSNo])
  @@map("invoice_items")
}

// ── SUBMISSION LOGS ───────────────────────────

model FbrSubmissionLog {
  id            String      @id @default(cuid())
  invoiceId     String
  invoice       Invoice     @relation(fields: [invoiceId], references: [id])
  apiEndpoint   String      // Which endpoint was called
  requestBody   Json        // What was sent
  responseBody  Json?       // What came back
  httpStatus    Int         // HTTP status code
  statusCode    String?     // FBR statusCode ("00"/"01")
  durationMs    Int?        // Response time in milliseconds
  environment   Environment
  createdAt     DateTime    @default(now())

  @@map("fbr_submission_logs")
}

// ── REFERENCE DATA SYNC LOG ──────────────────

model RefDataSyncLog {
  id           String   @id @default(cuid())
  dataType     String   // "provinces", "uom", "hscodes", etc.
  recordsCount Int
  status       String   // "success" | "failed"
  errorMessage String?
  syncedAt     DateTime @default(now())

  @@map("ref_data_sync_logs")
}
```

---

## 9. Sales Error Code Reference

| Code | Short Message | Full Explanation |
|---|---|---|
| 0001 | Seller not registered | Seller NTN/CNIC not registered for sales tax |
| 0002 | Invalid Buyer Reg No | Buyer NTN must be 7/9 digits, CNIC must be 13 digits |
| 0003 | Invalid invoice type | Must be "Sale Invoice" or "Debit Note" |
| 0005 | Invalid invoice date format | Use `YYYY-MM-DD` format |
| 0006 | Sale invoice not exist | Referenced invoice for STWH does not exist |
| 0007 | Wrong sale type for invoice | Sale type mismatches the registration number context |
| 0008 | STWH must be 0 or = Sales Tax | `salesTaxWithheldAtSource` must be 0 or equal to `salesTaxApplicable` |
| 0009 | Buyer registration no required | Registered buyer must have NTN/CNIC |
| 0010 | Buyer name required | `buyerBusinessName` is empty |
| 0011 | Invoice type required | `invoiceType` is empty |
| 0012 | Buyer registration type required | `buyerRegistrationType` is empty |
| 0013 | Valid sale type required | `saleType` is empty or null |
| 0018 | Sales Tax/FED required | `salesTaxApplicable` is empty |
| 0019 | HS Code required | `hsCode` is empty |
| 0020 | Rate required | `rate` is empty |
| 0021 | Value of Sales Excl ST required | `valueSalesExcludingST` is empty |
| 0022 | STWH required | `salesTaxWithheldAtSource` is empty |
| 0026 | Invoice Reference No required | Debit Note must have `invoiceRefNo` |
| 0027 | Reason required | Debit/Credit note must have reason |
| 0028 | Reason remarks required | When reason = "Others", remarks are mandatory |
| 0029 | Note date < original invoice date | Debit Note date must be ≥ original invoice date |
| 0030 | Unregistered distributor not allowed | Before system cutoff date |
| 0032 | STWH only for GOV/FTN | STWH invoice only allowed for FTN holders |
| 0034 | Note must be within 180 days | Debit/Credit note allowed only within 180 days of original |
| 0036 | Credit note value > original | Credit Note value cannot exceed original invoice value |
| 0041 | Invoice number required | `invoiceRefNo` is empty |
| 0042 | Invoice date required | `invoiceDate` is empty |
| 0043 | Invalid date | Date is not a valid date |
| 0044 | HS Code required | `hsCode` is empty (item level) |
| 0046 | Rate required | `rate` is empty (item level) |
| 0050 | Invalid STWH for Cotton Ginners | Cotton ginner STWH must equal sales tax or zero |
| 0052 | Invalid HS Code for sale type | HS code does not match the selected sale type |
| 0053 | Invalid buyer registration type | `buyerRegistrationType` value is not valid |
| 0055 | STWH as WH Agent required | Sales tax withheld is empty or invalid |
| 0056 | Buyer not in steel sector | Buyer not registered in steel sector |
| 0057 | Reference invoice not exist | Debit Note original invoice not found |
| 0058 | Self-invoicing not allowed | Buyer and Seller NTN cannot be same |
| 0064 | Credit note already exists | Credit note already added to this invoice |
| 0067 | Debit Note ST > original | Debit Note sales tax exceeds original |
| 0068 | Credit Note ST < original rate | Credit Note ST lower than what rate requires |
| 0070 | STWH not for unregistered | STWH only allowed for registered buyers |
| 0073 | Province of supplier required | `sellerProvince` is empty |
| 0074 | Destination of supply required | `buyerProvince` is empty |
| 0075 | SRO/Schedule No required | `sroScheduleNo` cannot be empty for this sale type |
| 0077 | SRO/Schedule No required | (Same as 0075, different context) |
| 0078 | Item serial no required | `sroItemSerialNo` cannot be empty |
| 0079 | Rate 5% not allowed for value > 20,000 | `valueSalesExcludingST` > 20,000 cannot use 5% rate |
| 0080 | Further Tax required | `furtherTax` is empty |
| 0082 | Seller not registered | (Purchase context) Seller NTN not registered |
| 0083 | Seller Reg No mismatch | Seller registration number does not match |
| 0085 | Total value required (PFAD) | For PFAD invoices, total value is mandatory |
| 0086 | Not an EFS license holder | Must have imported Compressor Scrap in last 12 months |
| 0087 | Petroleum levy not configured | Levy rates not set up properly |
| 0088 | Invalid invoice number format | Must be alphanumeric with `-` only between characters |
| 0089 | FED charged required | `fedPayable` is empty |
| 0090 | Fixed/Retail price required | `fixedNotifiedValueOrRetailPrice` is empty |
| 0091 | Extra tax must be empty | `extraTax` must be 0 for this sale type |
| 0092 | Valid sale type required (purchase) | Purchase type is empty |
| 0095 | Extra tax required | `extraTax` is empty for this scenario |
| 0096 | Only KWH UOM allowed for HS Code | Electricity HS code requires KWH |
| 0097 | UOM KG required | Petroleum/Cotton HS code requires KG |
| 0098 | Quantity required | `quantity` is empty |
| 0099 | UOM must match HS Code | UOM sent doesn't match what HS_UOM API returns |
| 0100 | Cotton Ginners: registered buyers only | Cotton ginner sale type requires registered buyer |
| 0101 | Use Toll Manufacturing for Steel | Steel sector must use Toll Manufacturing sale type |
| 0102 | 3rd Schedule tax mismatch | Tax not calculated per 3rd Schedule formula |
| 0103 | Potassium Chlorate tax mismatch | Specific calculation formula not followed |
| 0104 | Calculated ST% doesn't match | Tax percentage is incorrect |
| 0105 | Quantity-based ST incorrect | Quantity-based tax calculation is wrong |
| 0106 | Buyer not registered | Buyer NTN not registered for sales tax |
| 0107 | Buyer Reg No mismatch | Buyer registration doesn't match FBR records |
| 0108 | Invalid Seller Reg No | Seller NTN is not valid |
| 0109 | Wrong invoice type | Invoice type doesn't match the invoice number |
| 0111 | Wrong purchase type | Purchase type doesn't match the invoice number |
| 0113 | Invalid date format | Date must be `YYYY-MM-DD` |
| 0300 | Invalid decimal value | Decimal field has invalid format |
| 0401 | Seller token unauthorized | Seller NTN/token mismatch or token doesn't exist |
| 0402 | Buyer token unauthorized | Buyer NTN not 7/13 digits or token invalid |

---

## 10. Purchase Error Code Reference

| Code | Message |
|---|---|
| 0156 | Invalid NTN / Reg No. — must be 7 or 13 digits |
| 0157 | Buyer not registered for sales tax |
| 0158 | Buyer Reg No. mismatch |
| 0159 | FTN holder as seller not allowed for purchases |
| 0160 | Buyer name is empty |
| 0161 | Invoice date must be ≥ original sale invoice date |
| 0162 | Sale type is empty or invalid |
| 0163 | Sale type not allowed for Manufacturer |
| 0164 | For selected HS Code, only KWH UOM is allowed |
| 0165 | UOM must be KG |
| 0166 | Quantity / Electricity Units are required |
| 0167 | Value of Sales Excl. ST is empty or invalid |
| 0168 | Cotton Ginners: registered buyers only |
| 0169 | STWH only for GOV/FTN Holders |
| 0170 | Value > 20,000 — rate 5% not allowed |
| 0171 | Not an EFS license holder (Compressor Scrap) |
| 0172 | Petroleum levy rates not configured |
| 0173 | Invalid invoice number format (alphanumeric with - only) |
| 0174 | Sales Tax is empty |
| 0175 | Fixed/Notified value or Retail Price is empty |
| 0176 | ST Withheld at Source is empty |
| 0177 | Further Tax is empty |

---

## 11. QR Code & Logo Requirements

Every physical or digital invoice issued by a taxpayer must include:

### QR Code Specifications

| Spec | Value |
|---|---|
| **QR Code Version** | 2.0 (25×25 modules) |
| **Dimensions** | 1.0 × 1.0 inch |
| **Content** | FBR-assigned Invoice Number |
| **Placement** | Prominently on invoice, not obstructed |

### FBR DI Logo

The official FBR Digital Invoicing System logo must appear on the invoice alongside the QR code.

### What to Encode in QR Code

After a successful `postinvoicedata` call, you receive:
- `invoiceNumber` (e.g., `7000007DI1747119701593`) — encode this in the QR code

The buyer can scan this QR code to verify the invoice is genuine and registered with FBR.

---

*End of FBR Digital Invoicing Complete Developer Documentation*
*Based on PRAL Technical Specification v1.12 — April 2025*
