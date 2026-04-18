# PRAL Digital Invoicing (DI) API — SaaS Platform Integration Guide
## Step-by-Step Integration for Multi-Tenant FBR Compliance
### Based on: DI User Manual v1.5 + Technical Specification for DI API v1.12

---

## CRITICAL UNDERSTANDING FIRST

Before writing a single line of code, understand the architecture difference between your old system and this one:

**Your old system (previous docs):** You registered YOUR platform as a POS once with FBR, and all tenants used YOUR single `FBR_API_KEY` and `FBR_POS_ID`.

**PRAL Digital Invoicing system (these docs):** Every individual business (tenant) MUST register THEMSELVES on IRIS portal with their own NTN, get their own PRAL security token, and YOU act as their "Licensed Integrator". Each tenant's invoices are submitted using THEIR OWN security token — not yours.

**You are the Licensed Integrator. Your tenants are the taxpayers.**

This changes almost everything in the integration architecture.

---

## THE COMPLETE JOURNEY (Overview)

```
YOU (Platform)                    EACH TENANT (Business)
──────────────────────────────    ────────────────────────────────────────
Phase 1: Register YOUR platform   Phase 1: Tenant registers on IRIS portal
as Licensed Integrator with PRAL  selects YOU as their Licensed Integrator

Phase 2: Build Sandbox            Phase 2: Tenant submits their IP/server
integration                       details for whitelisting

Phase 3: Test all scenarios       Phase 3: Tenant completes sandbox
in sandbox env                    scenarios → gets Production Token

Phase 4: Go live in Production    Phase 4: Tenant stores Production Token
                                  in your platform → invoices go live
```

---

## PHASE 1: YOUR PLATFORM REGISTRATION AS LICENSED INTEGRATOR

### Step 1.1 — Register as Licensed Integrator on IRIS

Before your tenants can select you, you must be an approved Licensed Integrator.

1. Go to **https://iris.fbr.gov.pk**
2. Log in with your company's NTN and password
3. Navigate to **Digital Invoicing**
4. Select **API Integration** tab
5. Choose **"Proceed with PRAL as Licensed Integrator"** for your own registration
6. Fill in Technical Details:
   - Technical Contact Person (your dev team lead)
   - Technical Contact Mobile
   - Technical Contact Email
   - ERP/System Provider: enter your platform name (e.g. "FBR SaaS POS Platform")
   - Software Type: **Cloud**
   - Software Version: your current version number
   - CRM User ID: email for your support account at https://dicrm.pral.com.pk
   - CRM Password

7. Specify Business Types for Sandbox:
   - Business Nature: select all that apply to your platform's tenants
   - Sector: select your primary sector

8. Submit IP Whitelisting:
   - Hosting Server Company Name (e.g. AWS, DigitalOcean, Azure)
   - Hosting Server Country
   - Up to 3 outbound IP addresses of your production servers
   - For multiple IPs: download PRAL's Excel template, fill it, upload in .xls format (max 1MB)
   
   > **IMPORTANT for SaaS:** Your platform makes FBR API calls FROM your servers. Submit your server's outbound IP addresses, not tenants' IPs. PRAL approves whitelisting within ~2 working hours.

9. After IP approval, access the **Sandbox Environment** tab to:
   - View your Web API details (URL + your sandbox Bearer token)
   - Download sample JSON formats
   - See which scenarios apply to your registered business types

---

## PHASE 2: DATABASE CHANGES FOR PRAL DI INTEGRATION

Your existing `FBRCredentials` model needs to be REPLACED. The PRAL DI system works differently — each tenant has their own security token, not an API key + POS ID combination.

### Step 2.1 — Update Prisma Schema

```prisma
// REPLACE the existing FBRCredentials model entirely

model DICredentials {
  id                    String    @id @default(cuid())
  tenant                Tenant    @relation(fields: [tenantId], references: [id])
  tenantId              String    @unique

  // Taxpayer identity (from their IRIS profile)
  sellerNTN             String    // 7-digit NTN (e.g. "0786909")
  sellerCNIC            String?   // 13-digit CNIC (alternative to NTN)
  sellerBusinessName    String    // Registered business name
  sellerProvince        String    // Must match province codes from Reference API 5.1
  sellerAddress         String    // Business address

  // PRAL-issued security token (per taxpayer, 5-year validity)
  // Stored encrypted with AES-256-GCM
  encryptedSandboxToken  String?  // Token for sandbox testing
  encryptedProductionToken String? // Token for live submissions
  
  // Environment state
  environment           DIEnvironment @default(SANDBOX)
  isProductionReady     Boolean       @default(false)

  // Registration status tracking
  irisRegistrationStatus  IRISStatus  @default(PENDING)
  ipWhitelistStatus       IPStatus    @default(PENDING)
  sandboxCompleted        Boolean     @default(false)
  sandboxCompletedAt      DateTime?
  productionTokenIssuedAt DateTime?

  // Business classification (determines which sandbox scenarios to complete)
  businessActivity      String    // Manufacturer/Importer/Distributor/Wholesaler/Retailer/Service Provider/Exporter/Other
  sector                String    // Steel/FMCG/Textile/Telecom/Petroleum/Electricity/Gas/Services/Automobile/CNG/Pharmaceuticals/Wholesale Retails/Other

  // Token validity
  tokenExpiresAt        DateTime?   // 5 years from issuance
  lastVerifiedAt        DateTime?
  verificationError     String?

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}

// Track sandbox scenario completion per tenant
model SandboxScenario {
  id          String           @id @default(cuid())
  tenant      Tenant           @relation(fields: [tenantId], references: [id])
  tenantId    String
  scenarioId  String           // SN001, SN002, etc.
  description String
  status      ScenarioStatus   @default(PENDING)
  completedAt DateTime?
  invoiceNo   String?          // FBR-issued invoice number from successful test
  errorCode   String?
  errorDetail String?
  createdAt   DateTime         @default(now())

  @@unique([tenantId, scenarioId])
  @@index([tenantId])
}

// Update Invoice model — use PRAL DI field names
// The FBR-issued invoiceNumber format is:
// 22 digits for NTN sellers (e.g. "7000007DI1747119701593")
// 28 digits for CNIC sellers
model Invoice {
  // ... existing fields ...

  // PRAL DI specific fields
  diInvoiceNumber      String?   // FBR-issued invoice number (22 or 28 digits)
  diInvoiceDate        DateTime? // Date confirmed by FBR
  diStatusCode         String?   // "00" = Valid, "01" = Invalid
  diStatus             String?   // "Valid" or "Invalid"
  diItemStatuses       Json?     // Array of per-item validation statuses
  diErrorCode          String?   // Error code from FBR if invalid
  diErrorMessage       String?   // Error message from FBR

  // QR code requirements (mandatory on printed receipts)
  qrCodeData           String?   // Data to encode in QR (version 2.0, 25×25, 1×1 inch)
  qrCodePrinted        Boolean   @default(false)
}

enum DIEnvironment   { SANDBOX PRODUCTION }
enum IRISStatus      { PENDING IP_SUBMITTED IP_APPROVED SANDBOX_ACCESS PRODUCTION_READY }
enum IPStatus        { PENDING SUBMITTED APPROVED REJECTED }
enum ScenarioStatus  { PENDING SUBMITTED PASSED FAILED }
```

### Step 2.2 — Add Reference Data Tables (sync from PRAL APIs)

```prisma
// Platform-level cache of PRAL reference data
// Sync these once daily — they rarely change

model DIProvince {
  code        Int     @id   // stateProvinceCode
  description String        // stateProvinceDesc (e.g. "PUNJAB", "SINDH")
}

model DIDocumentType {
  id          Int     @id   // docTypeId
  description String        // "Sale Invoice", "Debit Note"
}

model DIUnitOfMeasure {
  id          Int     @id   // uoM_ID
  description String        // "KG", "Numbers, pieces, units", etc.
}

model DIRate {
  id          Int     @id   // ratE_ID
  description String        // "18%", "0%", "18% along with rupees 60 per kilogram"
  value       Decimal @db.Decimal(5,2)  // numeric rate value
}

model DISaleType {
  code        String  @id   // internal code
  description String        // "Goods at Standard Rate (default)", "Exempt Goods", etc.
}

// HS Code + valid UOM combinations (from API 5.9)
model DIHSCodeUOM {
  id          String  @id @default(cuid())
  hsCode      String
  uomId       Int
  uomDesc     String
  annexureId  Int     @default(3)  // Sales annexure

  @@unique([hsCode, uomId, annexureId])
  @@index([hsCode])
}
```

---

## PHASE 3: REFERENCE DATA SYNC SERVICE

PRAL provides 12 Reference APIs. Your platform must sync these and cache them — your tenants will need this data when building invoices (for dropdowns, validation, etc.). The reference APIs use the SAME token as the submission APIs.

### Step 3.1 — All Reference API Endpoints

```
BASE: https://gw.fbr.gov.pk

Provinces:        GET /pdi/v1/provinces
Document Types:   GET /pdi/v1/doctypecode
HS Codes + Desc:  GET /pdi/v1/itemdesccode
SRO Items:        GET /pdi/v1/sroitemcode
Transaction Types: GET /pdi/v1/transtypecode
Units of Measure: GET /pdi/v1/uom
SRO Schedule:     GET /pdi/v1/SroSchedule?rate_id={id}&date={DD-MMM-YYYY}&origination_supplier_csv={provinceId}
Sale Type → Rate: GET /pdi/v2/SaleTypeToRate?date={DD-MMM-YYYY}&transTypeId={id}&originationSupplier={provinceId}
HS Code + UOM:    GET /pdi/v2/HS_UOM?hs_code={code}&annexure_id=3
SRO Item by ID:   GET /pdi/v2/SROItem?date={YYYY-MM-DD}&sro_id={id}
ATL Status Check: GET /gw.fbr.gov.pk/dist/v1/statl  BODY: {"regno":"NTN","date":"YYYY-MM-DD"}
Reg Type Check:   GET /gw.fbr.gov.pk/dist/v1/Get_Reg_Type  BODY: {"Registration_No":"NTN"}
```

### Step 3.2 — Reference Sync Worker

```typescript
// workers/di-reference-sync.worker.ts
// Run this ONCE on platform startup and then every 24 hours

import { prisma } from '@/lib/db/prisma'

const FBR_BASE = 'https://gw.fbr.gov.pk'
// Use YOUR platform's sandbox token for reference syncing
const PLATFORM_TOKEN = process.env.PRAL_PLATFORM_TOKEN!

async function fetchWithToken(url: string) {
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${PLATFORM_TOKEN}` },
  })
  if (!res.ok) throw new Error(`Reference API ${url} returned ${res.status}`)
  return res.json()
}

export async function syncAllReferenceData() {
  console.log('[DI Sync] Starting reference data sync...')

  // 1. Provinces
  const provinces = await fetchWithToken(`${FBR_BASE}/pdi/v1/provinces`)
  await prisma.$transaction(
    provinces.map((p: any) =>
      prisma.dIProvince.upsert({
        where: { code: p.stateProvinceCode },
        create: { code: p.stateProvinceCode, description: p.stateProvinceDesc },
        update: { description: p.stateProvinceDesc },
      })
    )
  )

  // 2. Document Types
  const docTypes = await fetchWithToken(`${FBR_BASE}/pdi/v1/doctypecode`)
  await prisma.$transaction(
    docTypes.map((d: any) =>
      prisma.dIDocumentType.upsert({
        where: { id: d.docTypeId },
        create: { id: d.docTypeId, description: d.docDescription },
        update: { description: d.docDescription },
      })
    )
  )

  // 3. Units of Measure
  const uoms = await fetchWithToken(`${FBR_BASE}/pdi/v1/uom`)
  await prisma.$transaction(
    uoms.map((u: any) =>
      prisma.dIUnitOfMeasure.upsert({
        where: { id: u.uoM_ID },
        create: { id: u.uoM_ID, description: u.description },
        update: { description: u.description },
      })
    )
  )

  console.log('[DI Sync] Reference data sync complete')
}
```

### Step 3.3 — Buyer Validation API (call before each invoice)

```typescript
// lib/di/buyer-validation.ts
// CRITICAL: Before submitting any invoice, check if the buyer NTN is registered

export async function checkBuyerRegistrationType(
  buyerNTN: string,
  tenantToken: string
): Promise<'Registered' | 'Unregistered' | 'unknown'> {
  try {
    const res = await fetch('https://gw.fbr.gov.pk/dist/v1/Get_Reg_Type', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tenantToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ Registration_No: buyerNTN }),
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    // statuscode "00" = Registered, "01" = Unregistered
    return data.REGISTRATION_TYPE === 'Registered' ? 'Registered' : 'Unregistered'
  } catch {
    return 'unknown'
  }
}

// Also check ATL (Active Taxpayer List) status
export async function checkBuyerATLStatus(
  buyerNTN: string,
  tenantToken: string
): Promise<'Active' | 'In-Active' | 'unknown'> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const res = await fetch('https://gw.fbr.gov.pk/dist/v1/statl', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tenantToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ regno: buyerNTN, date: today }),
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    // statuscode "00" = Active (not in the doc but "In-Active" codes are "01" and "02")
    return data.status === 'In-Active' ? 'In-Active' : 'Active'
  } catch {
    return 'unknown'
  }
}
```

---

## PHASE 4: PRAL DI API CLIENT (PER-TENANT)

This replaces your existing `lib/fbr/client.ts`. The key difference: routing to sandbox vs production is determined by **the token itself** — the URL is the same.

### Step 4.1 — API Endpoints

```
# SANDBOX
POST Invoice:    https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb
Validate:        https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb

# PRODUCTION  
POST Invoice:    https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata
Validate:        https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata

# REFERENCE DATA (same for both)
Base:            https://gw.fbr.gov.pk/pdi/v1/...
                 https://gw.fbr.gov.pk/pdi/v2/...

# SECURITY: Bearer token in Authorization header of EVERY request
```

### Step 4.2 — DI Client Factory

```typescript
// lib/di/client.ts

import { decryptCredential } from '@/lib/crypto/credentials'
import { prisma } from '@/lib/db/prisma'
import { DICircuitBreakerRegistry } from './circuit-breaker'

const DI_POST_URL      = 'https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata'
const DI_POST_URL_SB   = 'https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb'
const DI_VAL_URL       = 'https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata'
const DI_VAL_URL_SB    = 'https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb'

const circuitRegistry = DICircuitBreakerRegistry.getInstance()

export async function getDIClientForTenant(tenantId: string) {
  const creds = await prisma.dICredentials.findUniqueOrThrow({
    where: { tenantId },
  })

  if (!creds.encryptedProductionToken && creds.environment === 'PRODUCTION') {
    throw new Error('Tenant does not have a production token yet. Complete sandbox testing first.')
  }

  const isSandbox = creds.environment === 'SANDBOX'
  const encryptedToken = isSandbox
    ? creds.encryptedSandboxToken!
    : creds.encryptedProductionToken!

  // Decrypt at runtime — never stored in memory
  const token = decryptCredential(encryptedToken)
  const breaker = circuitRegistry.get(tenantId)

  const postUrl     = isSandbox ? DI_POST_URL_SB   : DI_POST_URL
  const validateUrl = isSandbox ? DI_VAL_URL_SB    : DI_VAL_URL

  return {
    tenantId,
    isSandbox,
    sellerNTN: creds.sellerNTN,
    sellerBusinessName: creds.sellerBusinessName,
    sellerProvince: creds.sellerProvince,
    sellerAddress: creds.sellerAddress,

    // Submit invoice to FBR (creates it)
    postInvoice: async (payload: DIInvoicePayload): Promise<DIResponse> => {
      return breaker.execute(async () => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 15_000)
        try {
          const res = await fetch(postUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          })
          clearTimeout(timer)
          if (res.status === 401) throw new DIAuthError(tenantId)
          if (res.status === 500) throw new DIServerError(tenantId)
          return res.json() as Promise<DIResponse>
        } catch (err) {
          clearTimeout(timer)
          throw err
        }
      })
    },

    // Validate invoice WITHOUT submitting (useful for pre-flight check)
    validateInvoice: async (payload: DIInvoicePayload): Promise<DIValidationResponse> => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10_000)
      try {
        const res = await fetch(validateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        clearTimeout(timer)
        return res.json() as Promise<DIValidationResponse>
      } catch (err) {
        clearTimeout(timer)
        throw err
      }
    },

    getCircuitState: () => breaker.getState(),
  }
}

export class DIAuthError extends Error {
  constructor(public tenantId: string) {
    super(`PRAL DI token unauthorized for tenant ${tenantId}. Token may be expired or not yet whitelisted.`)
    this.name = 'DIAuthError'
  }
}

export class DIServerError extends Error {
  constructor(public tenantId: string) {
    super(`PRAL DI server error for tenant ${tenantId}. Contact PRAL support via dicrm.pral.com.pk`)
    this.name = 'DIServerError'
  }
}
```

---

## PHASE 5: INVOICE PAYLOAD BUILDER

This is the most critical translation layer — mapping your internal invoice data to the exact JSON structure PRAL requires.

### Step 5.1 — TypeScript Types

```typescript
// lib/di/types.ts

export interface DIInvoicePayload {
  invoiceType:  'Sale Invoice' | 'Debit Note'
  invoiceDate:  string   // "YYYY-MM-DD" format ONLY
  
  sellerNTNCNIC:        string   // 7-digit NTN or 13-digit CNIC
  sellerBusinessName:   string
  sellerProvince:       string   // Use exact description from Reference API 5.1
  sellerAddress:        string
  
  buyerNTNCNIC?:        string   // Optional ONLY if buyerRegistrationType = "Unregistered"
  buyerBusinessName:    string
  buyerProvince:        string
  buyerAddress:         string
  buyerRegistrationType: 'Registered' | 'Unregistered'
  
  invoiceRefNo?:        string   // REQUIRED for Debit Note (22 or 28 digit FBR invoice number)
  scenarioId?:          string   // REQUIRED for Sandbox ONLY (e.g. "SN001")
  
  items: DIInvoiceItem[]
}

export interface DIInvoiceItem {
  hsCode:                           string   // Format: "XXXX.XXXX" e.g. "0101.2100"
  productDescription:               string
  rate:                             string   // Exact value from Reference API 5.8 ratE_DESC e.g. "18%"
  uoM:                              string   // Exact value from Reference API 5.6 description
  quantity:                         number   // Decimal, 4 decimal places e.g. 1.0000
  totalValues:                      number   // Total including tax (0.00 if not 3rd schedule)
  valueSalesExcludingST:            number   // Sale value EXCLUDING sales tax
  fixedNotifiedValueOrRetailPrice:  number   // 0.00 unless fixed price item
  salesTaxApplicable:               number   // GST amount (NOT including further/extra tax)
  salesTaxWithheldAtSource:         number   // Usually 0.00
  extraTax:                         number   // 0.00 if not applicable
  furtherTax:                       number   // 0.00 if not applicable
  sroScheduleNo?:                   string   // Required if saleType uses SRO
  fedPayable:                       number   // 0.00 if no FED
  discount:                         number   // 0.00 if no discount
  saleType:                         string   // Exact value from Reference API 5.8 ratE_DESC
  sroItemSerialNo?:                 string   // Required for some SRO-based items
}

export interface DIResponse {
  invoiceNumber?:    string   // FBR-issued (22 or 28 digits)
  dated?:            string   // "YYYY-MM-DD HH:mm:ss"
  validationResponse: {
    statusCode:      string   // "00" = Valid, "01" = Invalid
    status:          string   // "Valid" or "Invalid" or "invalid" (note: lowercase possible)
    error?:          string
    errorCode?:      string
    invoiceStatuses: DIItemStatus[] | null
  }
}

export interface DIItemStatus {
  itemSNo:     string
  statusCode:  string   // "00" = Valid, "01" = Invalid
  status:      string
  invoiceNo:   string | null  // Item-level FBR invoice number
  errorCode:   string
  error:       string
}

export type DIValidationResponse = Omit<DIResponse, 'invoiceNumber'>
```

### Step 5.2 — Payload Builder

```typescript
// lib/di/payload-builder.ts

import { Invoice, InvoiceItem, DICredentials } from '@prisma/client'
import { DIInvoicePayload } from './types'

export function buildDIPayload(
  invoice: Invoice & { items: InvoiceItem[] },
  creds: DICredentials,
  options?: {
    scenarioId?: string     // Required for sandbox
    isSandbox?: boolean
  }
): DIInvoicePayload {
  return {
    invoiceType: invoice.invoiceType as 'Sale Invoice' | 'Debit Note',
    invoiceDate: invoice.invoiceDate.toISOString().split('T')[0], // "YYYY-MM-DD"

    // Seller details come from the tenant's DI credentials (registered with IRIS)
    sellerNTNCNIC: creds.sellerNTN,
    sellerBusinessName: creds.sellerBusinessName,
    sellerProvince: creds.sellerProvince,
    sellerAddress: creds.sellerAddress,

    // Buyer details from the invoice
    buyerNTNCNIC: invoice.buyerNTN ?? undefined,
    buyerBusinessName: invoice.buyerName ?? 'Walk-in Customer',
    buyerProvince: invoice.buyerProvince ?? creds.sellerProvince,
    buyerAddress: invoice.buyerAddress ?? invoice.buyerName ?? 'N/A',
    buyerRegistrationType: invoice.buyerRegistrationType as 'Registered' | 'Unregistered',

    // For debit notes only
    invoiceRefNo: invoice.diReferenceInvoiceNo ?? undefined,

    // Sandbox testing scenario (omit in production)
    scenarioId: options?.isSandbox ? options.scenarioId : undefined,

    items: invoice.items.map(item => ({
      hsCode: item.hsCode,                         // e.g. "8471.3000"
      productDescription: item.name,
      rate: item.diRate,                           // Must be exact string from Reference API 5.8
      uoM: item.diUOM,                             // Must be exact string from Reference API 5.6
      quantity: Number(item.quantity.toFixed(4)),
      totalValues: 0.00,                           // Only non-zero for 3rd schedule items
      valueSalesExcludingST: Number(item.unitPrice.mul(item.quantity).toFixed(2)),
      fixedNotifiedValueOrRetailPrice: 0.00,
      salesTaxApplicable: Number(item.taxAmount.toFixed(2)),
      salesTaxWithheldAtSource: 0.00,
      extraTax: Number((item.extraTax ?? 0).toFixed(2)),
      furtherTax: Number((item.furtherTax ?? 0).toFixed(2)),
      sroScheduleNo: item.sroScheduleNo ?? '',
      fedPayable: Number((item.fedPayable ?? 0).toFixed(2)),
      discount: Number((item.discount ?? 0).toFixed(2)),
      saleType: item.diSaleType,                   // Exact string from Reference API
      sroItemSerialNo: item.sroItemSerialNo ?? '',
    })),
  }
}
```

---

## PHASE 6: UPDATED INVOICE SUBMISSION ROUTE

```typescript
// app/api/tenant/di/submit/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { getDIClientForTenant, DIAuthError, DIServerError } from '@/lib/di/client'
import { buildDIPayload } from '@/lib/di/payload-builder'
import { enqueueInvoiceSubmission } from '@/lib/fbr/queue'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/admin/audit'

export async function POST(req: NextRequest) {
  const { tenant, userId } = await getTenantFromSession()
  const { invoiceId, scenarioId } = await req.json()

  const [invoice, creds] = await Promise.all([
    prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId, tenantId: tenant.id },  // Cross-tenant guard
      include: { items: true },
    }),
    prisma.dICredentials.findUniqueOrThrow({
      where: { tenantId: tenant.id },
    }),
  ])

  // Guard: must have a token
  const hasToken = creds.environment === 'SANDBOX'
    ? !!creds.encryptedSandboxToken
    : !!creds.encryptedProductionToken

  if (!hasToken) {
    return NextResponse.json({
      error: 'Your FBR DI credentials are not fully configured. Please complete IRIS registration.',
      action: 'COMPLETE_REGISTRATION',
    }, { status: 422 })
  }

  // Guard: sandbox must have scenarioId
  if (creds.environment === 'SANDBOX' && !scenarioId) {
    return NextResponse.json({
      error: 'Sandbox requires a scenarioId (e.g. SN001). Please select the appropriate scenario.',
    }, { status: 422 })
  }

  const diClient = await getDIClientForTenant(tenant.id)

  // Build exact PRAL payload
  const payload = buildDIPayload(invoice, creds, {
    scenarioId,
    isSandbox: creds.environment === 'SANDBOX',
  })

  // Pre-validate (optional but recommended)
  const validation = await diClient.validateInvoice(payload)
  if (validation.validationResponse.statusCode === '01') {
    // Invalid — return errors to user with actionable messages
    const errors = mapDIErrorCodes(validation.validationResponse)
    return NextResponse.json({
      success: false,
      valid: false,
      errors,
      rawResponse: validation,
    }, { status: 422 })
  }

  // Check circuit breaker
  if (diClient.getCircuitState().state === 'OPEN') {
    await enqueueInvoiceSubmission(tenant.id, invoiceId)
    return NextResponse.json({
      success: true,
      offline: true,
      message: 'PRAL DI service temporarily unavailable. Invoice queued for automatic retry.',
    })
  }

  // Submit to PRAL
  const start = Date.now()
  try {
    const response = await diClient.postInvoice(payload)
    const isValid = response.validationResponse.statusCode === '00'

    await prisma.$transaction([
      prisma.invoice.update({
        where: { id: invoiceId, tenantId: tenant.id },
        data: {
          status: isValid ? 'SUBMITTED' : 'FAILED',
          submittedToFbr: isValid,
          diInvoiceNumber: response.invoiceNumber ?? null,
          diInvoiceDate: response.dated ? new Date(response.dated) : null,
          diStatusCode: response.validationResponse.statusCode,
          diStatus: response.validationResponse.status,
          diItemStatuses: response.validationResponse.invoiceStatuses as any,
          diErrorCode: response.validationResponse.errorCode ?? null,
          diErrorMessage: response.validationResponse.error ?? null,
          // QR code data = FBR-issued invoice number (encode this in QR)
          qrCodeData: response.invoiceNumber ?? null,
        },
      }),
      prisma.fBRSubmissionLog.create({
        data: {
          tenantId: tenant.id,
          invoiceId,
          attempt: 1,
          requestBody: payload as object,
          responseCode: 200,
          responseBody: response as object,
          durationMs: Date.now() - start,
        },
      }),
    ])

    // Update sandbox scenario status if in sandbox
    if (creds.environment === 'SANDBOX' && scenarioId && isValid) {
      await prisma.sandboxScenario.upsert({
        where: { tenantId_scenarioId: { tenantId: tenant.id, scenarioId } },
        create: {
          tenantId: tenant.id,
          scenarioId,
          description: SCENARIO_DESCRIPTIONS[scenarioId] ?? scenarioId,
          status: 'PASSED',
          completedAt: new Date(),
          invoiceNo: response.invoiceNumber,
        },
        update: {
          status: 'PASSED',
          completedAt: new Date(),
          invoiceNo: response.invoiceNumber,
        },
      })

      // Check if all required scenarios are now complete
      await checkAndUpdateSandboxCompletion(tenant.id)
    }

    return NextResponse.json({
      success: true,
      valid: isValid,
      diInvoiceNumber: response.invoiceNumber,
      response,
    })

  } catch (err) {
    if (err instanceof DIAuthError) {
      return NextResponse.json({
        error: 'Your PRAL DI token is invalid or unauthorized. Please update your credentials.',
        action: 'UPDATE_TOKEN',
      }, { status: 401 })
    }

    if (err instanceof DIServerError) {
      await enqueueInvoiceSubmission(tenant.id, invoiceId)
      return NextResponse.json({
        success: true,
        offline: true,
        message: 'PRAL server error. Invoice queued for retry. Contact PRAL support if this persists.',
        supportUrl: 'https://dicrm.pral.com.pk',
      })
    }

    throw err
  }
}

async function checkAndUpdateSandboxCompletion(tenantId: string) {
  const creds = await prisma.dICredentials.findUniqueOrThrow({ where: { tenantId } })
  const requiredScenarios = getRequiredScenarios(creds.businessActivity, creds.sector)
  const passedScenarios = await prisma.sandboxScenario.count({
    where: { tenantId, status: 'PASSED' },
  })

  if (passedScenarios >= requiredScenarios.length) {
    await prisma.dICredentials.update({
      where: { tenantId },
      data: {
        sandboxCompleted: true,
        sandboxCompletedAt: new Date(),
        irisRegistrationStatus: 'PRODUCTION_READY',
      },
    })
    // TODO: Notify tenant that production token is ready on IRIS portal
    // TODO: Send email: "Your sandbox testing is complete! Log in to IRIS to get your Production Token."
  }
}
```

---

## PHASE 7: TENANT ONBOARDING — UPDATED FOR PRAL DI

The onboarding flow changes significantly. Tenants no longer just paste credentials — they need to go through a multi-step process involving IRIS registration.

### Step 7.1 — Updated Onboarding Steps

```
STEP 1: Account Creation (unchanged)
  → Email, password, business name

STEP 2: Business Profile
  → Full address, province (dropdown from Reference API 5.1)
  → Business Activity: Manufacturer / Importer / Distributor / Wholesaler / Retailer / Service Provider / Exporter / Other
  → Sector: dropdown (FMCG, Steel, Textile, Telecom, Petroleum, etc.)
  → NTN (7 digits) or CNIC (13 digits)

STEP 3: IRIS Registration Guide ← NEW MAJOR STEP
  Show tenant a step-by-step guide:
  ┌────────────────────────────────────────────────────────┐
  │  Register on IRIS for Digital Invoicing                │
  │                                                        │
  │  1. Go to https://iris.fbr.gov.pk                     │
  │  2. Login with your NTN and password                   │
  │  3. Click "Digital Invoicing"                          │
  │  4. Select "API Integration" tab                       │
  │  5. Select "Proceed with Other Licensed Integrator"    │
  │  6. Choose "[YOUR PLATFORM NAME]" from dropdown        │
  │  7. Submit your technical details:                     │
  │     - Technical Contact: [auto-fill from their profile]│
  │     - ERP Provider: [YOUR PLATFORM NAME]               │
  │     - Software Type: Cloud                             │
  │  8. Our team will review and APPROVE your request      │
  │                                                        │
  │  [I have completed these steps →]                      │
  └────────────────────────────────────────────────────────┘

STEP 4: Sandbox Token Entry
  → Once YOU (as LI) approve their IRIS request, they get a sandbox token
  → Show field: "Paste your Sandbox Security Token from IRIS"
  → [Test Connection] → calls Reference API with their token
  → On success → show required sandbox scenarios for their business type

STEP 5: Sandbox Testing
  → Show list of required scenarios for their sector/activity
  → For each scenario: show description, let them run a test invoice
  → Track scenario completion with green checkmarks
  → All scenarios complete → instruct: "Log in to IRIS to get your Production Token"

STEP 6: Production Token Entry
  → "Paste your Production Token from IRIS"
  → [Activate Production] → verify token works
  → On success → environment switches to PRODUCTION
  → POS is now fully live!
```

### Step 7.2 — Required Scenarios Helper

```typescript
// lib/di/scenarios.ts

// Complete mapping from Technical Document section 10
const SCENARIO_MAP: Record<string, Record<string, string[]>> = {
  'Manufacturer': {
    'All Other Sectors': ['SN001','SN002','SN005','SN006','SN007','SN015','SN016','SN017','SN021','SN022','SN024'],
    'Steel':            ['SN003','SN004','SN011'],
    'FMCG':             ['SN001','SN002','SN005','SN006','SN007','SN015','SN016','SN017','SN021','SN022','SN024','SN008'],
    'Textile':          ['SN001','SN002','SN005','SN006','SN007','SN015','SN016','SN017','SN021','SN022','SN024','SN009'],
    'Telecom':          ['SN001','SN002','SN005','SN006','SN007','SN015','SN016','SN017','SN021','SN022','SN024','SN010'],
    'Petroleum':        ['SN001','SN002','SN005','SN006','SN007','SN015','SN016','SN017','SN021','SN022','SN024','SN012'],
    'Services':         ['SN001','SN002','SN005','SN006','SN007','SN015','SN016','SN017','SN021','SN022','SN024','SN018','SN019'],
    'Wholesale / Retails': ['SN001','SN002','SN005','SN006','SN007','SN015','SN016','SN017','SN021','SN022','SN024','SN026','SN027','SN028','SN008'],
  },
  'Retailer': {
    'All Other Sectors': ['SN001','SN002','SN005','SN006','SN007','SN015','SN016','SN017','SN021','SN022','SN024','SN026','SN027','SN028','SN008'],
    'FMCG':              ['SN026','SN027','SN028','SN008'],
    'Textile':           ['SN009','SN026','SN027','SN028','SN008'],
    'Services':          ['SN018','SN019','SN026','SN027','SN028','SN008'],
    'Wholesale / Retails': ['SN026','SN027','SN028','SN008'],
  },
  'Service Provider': {
    'All Other Sectors': ['SN001','SN002','SN005','SN006','SN007','SN015','SN016','SN017','SN021','SN022','SN024','SN018','SN019'],
    'Services':          ['SN018','SN019'],
    'Telecom':           ['SN010','SN018','SN019'],
  },
  // ... add all other mappings from Technical Document section 10
}

export const SCENARIO_DESCRIPTIONS: Record<string, string> = {
  'SN001': 'Goods at standard rate to registered buyers',
  'SN002': 'Goods at standard rate to unregistered buyers',
  'SN003': 'Sale of Steel (Melted and Re-Rolled)',
  'SN004': 'Sale by Ship Breakers',
  'SN005': 'Reduced rate sale',
  'SN006': 'Exempt goods sale',
  'SN007': 'Zero rated sale',
  'SN008': 'Sale of 3rd schedule goods',
  'SN009': 'Cotton Spinners purchase from Cotton Ginners (Textile)',
  'SN010': 'Telecom services rendered or provided',
  'SN011': 'Toll Manufacturing sale by Steel sector',
  'SN012': 'Sale of Petroleum products',
  'SN013': 'Electricity Supply to Retailers',
  'SN014': 'Sale of Gas to CNG stations',
  'SN015': 'Sale of mobile phones',
  'SN016': 'Processing / Conversion of Goods',
  'SN017': 'Sale of Goods where FED is charged in ST mode',
  'SN018': 'Services rendered where FED is charged in ST mode',
  'SN019': 'Services rendered or provided',
  'SN020': 'Sale of Electric Vehicles',
  'SN021': 'Sale of Cement / Concrete Block',
  'SN022': 'Sale of Potassium Chlorate',
  'SN023': 'Sale of CNG',
  'SN024': 'Goods sold listed in SRO 297(I)/2023',
  'SN025': 'Drugs sold at fixed ST rate (Eighth Schedule)',
  'SN026': 'Sale to End Consumer by retailers (Standard Rate)',
  'SN027': 'Sale to End Consumer by retailers (3rd Schedule)',
  'SN028': 'Sale to End Consumer by retailers (Reduced Rate)',
}

export function getRequiredScenarios(businessActivity: string, sector: string): string[] {
  return SCENARIO_MAP[businessActivity]?.[sector]
      ?? SCENARIO_MAP[businessActivity]?.['All Other Sectors']
      ?? ['SN001', 'SN002']   // Minimum fallback
}
```

---

## PHASE 8: QR CODE & RECEIPT REQUIREMENTS

PRAL has MANDATORY receipt requirements you must implement.

### Step 8.1 — QR Code Specifications

```
QR Code Version: 2.0 (25×25 modules)
QR Code Size:    1.0 × 1.0 inch (printed)
QR Content:      The FBR-issued diInvoiceNumber (22 or 28 digit string)
Logo:            FBR Digital Invoicing System logo MUST appear on every invoice
```

```typescript
// lib/di/qr-generator.ts
import QRCode from 'qrcode'

export async function generateDIQRCode(fbrInvoiceNumber: string): Promise<string> {
  // Version 2 = 25x25 modules
  return QRCode.toDataURL(fbrInvoiceNumber, {
    version: 2,        // Forces 25×25 module grid
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 96,         // 96px ≈ 1 inch at 96dpi
    color: { dark: '#000000', light: '#FFFFFF' },
  })
}

// For PDF receipts — generate as SVG for crisp printing
export async function generateDIQRCodeSVG(fbrInvoiceNumber: string): Promise<string> {
  return QRCode.toString(fbrInvoiceNumber, {
    type: 'svg',
    version: 2,
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 96,
  })
}
```

### Step 8.2 — Receipt Requirements Checklist

Every printed/digital invoice MUST include:
- [ ] FBR Digital Invoicing System LOGO (obtain from PRAL)
- [ ] QR Code (version 2.0, 25×25, 1×1 inch) encoding the `diInvoiceNumber`
- [ ] Seller NTN/CNIC and business name
- [ ] Buyer NTN/CNIC (if registered) and name
- [ ] Invoice date in YYYY-MM-DD format
- [ ] All items with HS code, quantity, unit, rate, sales tax
- [ ] Total sales value excluding ST, total ST, grand total
- [ ] FBR-issued invoice number (the 22/28 digit number)

For **offline/pending** receipts (FBR submission queued):
- [ ] Print "PENDING FBR VERIFICATION" banner prominently
- [ ] Do NOT print QR code until `diInvoiceNumber` is received from FBR
- [ ] Print again / send digital copy once FBR submission succeeds

---

## PHASE 9: ERROR HANDLING MAP

Build a human-readable error mapper so tenants understand what went wrong.

```typescript
// lib/di/error-codes.ts

const DI_SALES_ERRORS: Record<string, string> = {
  '0001': 'Seller NTN is not registered for sales tax. Verify your NTN in your DI credentials.',
  '0002': 'Buyer NTN/CNIC format is invalid. Must be 7-digit NTN or 13-digit CNIC.',
  '0003': 'Invalid invoice type. Use "Sale Invoice" or "Debit Note".',
  '0005': 'Invoice date format incorrect. Use YYYY-MM-DD (e.g. 2025-07-29).',
  '0009': 'Buyer registration number is required for registered buyers.',
  '0010': 'Buyer name is required.',
  '0012': 'Buyer registration type is required. Set "Registered" or "Unregistered".',
  '0013': 'Sale type is invalid or missing.',
  '0018': 'Sales tax amount is required.',
  '0019': 'HS Code is required on all items.',
  '0020': 'Tax rate is required on all items.',
  '0021': 'Sales value excluding ST is required.',
  '0041': 'Invoice number is required.',
  '0044': 'HS Code is missing. Add a valid HS Code to this product.',
  '0046': 'Tax rate is missing. Select a valid rate for the sale type.',
  '0052': 'HS Code does not match the sale type. Check HS Code is valid for this product category.',
  '0053': 'Buyer registration type is invalid.',
  '0057': 'Reference invoice does not exist. For Debit Notes, the original FBR invoice number is required.',
  '0058': 'Self-invoicing not allowed. Buyer and Seller NTN cannot be the same.',
  '0073': 'Seller province is required.',
  '0074': 'Buyer province is required.',
  '0077': 'SRO/Schedule number is required for this sale type.',
  '0078': 'SRO item serial number is required.',
  '0079': 'Sales value over PKR 20,000 — 5% rate is not allowed at this value.',
  '0083': 'Seller registration number does not match your IRIS profile.',
  '0096': 'For this HS Code, only KWH unit of measure is allowed.',
  '0099': 'Unit of measure does not match the HS Code. Check the valid UOM for this product.',
  '0104': 'Sales tax calculation is incorrect. Check: quantity × unit price × rate% = salesTaxApplicable.',
  '0107': 'Buyer NTN does not match FBR records.',
  '0108': 'Seller NTN format is invalid.',
  '0300': 'Decimal value format error. Check quantity, discount, tax, and fee fields.',
  '0401': 'Your PRAL DI token is not authorized for this seller NTN. Re-register on IRIS portal.',
  '0402': 'Your PRAL DI token is not authorized for this buyer NTN.',
}

export function mapDIErrorCodes(validationResponse: any): Array<{
  code: string
  message: string
  item?: string
  action: string
}> {
  const errors: ReturnType<typeof mapDIErrorCodes> = []

  // Header-level error
  if (validationResponse.errorCode) {
    errors.push({
      code: validationResponse.errorCode,
      message: DI_SALES_ERRORS[validationResponse.errorCode] ?? validationResponse.error,
      action: getActionForError(validationResponse.errorCode),
    })
  }

  // Item-level errors
  if (validationResponse.invoiceStatuses) {
    for (const item of validationResponse.invoiceStatuses) {
      if (item.statusCode === '01' && item.errorCode) {
        errors.push({
          code: item.errorCode,
          message: DI_SALES_ERRORS[item.errorCode] ?? item.error,
          item: `Item #${item.itemSNo}`,
          action: getActionForError(item.errorCode),
        })
      }
    }
  }

  return errors
}

function getActionForError(code: string): string {
  const actions: Record<string, string> = {
    '0001': 'Update your seller NTN in Settings → DI Credentials',
    '0019': 'Assign a valid HS Code to this product in Products catalogue',
    '0044': 'Assign a valid HS Code to this product in Products catalogue',
    '0046': 'Select a tax rate for this item',
    '0052': 'Check the HS Code is valid for the selected sale type',
    '0099': 'Select the correct unit of measure for this HS Code',
    '0401': 'Your DI token may have expired. Go to IRIS portal and generate a new token.',
    '0104': 'Recalculate sales tax: value × rate = tax amount',
  }
  return actions[code] ?? 'Check field and try again'
}
```

---

## PHASE 10: TENANT SETTINGS — DI CREDENTIALS PAGE

The `/settings/di-credentials` page replaces the old FBR credentials page.

```
┌──────────────────────────────────────────────────────────┐
│  PRAL Digital Invoicing — Credentials                     │
├──────────────────────────────────────────────────────────┤
│  Status:  🟢 PRODUCTION ACTIVE                            │
│  (or)     🟡 SANDBOX TESTING — 7/10 scenarios passed      │
│  (or)     🔴 NOT CONFIGURED — complete IRIS registration  │
│                                                          │
│  Seller Details                                          │
│  NTN:          07XXXXX   ← masked                        │
│  Business:     [Auto-filled from IRIS profile]           │
│  Province:     Punjab                                    │
│                                                          │
│  Environment:  [SANDBOX ●] [PRODUCTION ○]                │
│                                                          │
│  Sandbox Token:   ••••••••••••••••1234  [Update]         │
│  Production Token: NOT YET ACTIVE      [Activate]        │
│                                                          │
│  Token Expires:  29 Jul 2030 (5 years)                   │
│                                                          │
│  [Re-test Connection]    [Contact PRAL Support]          │
├──────────────────────────────────────────────────────────┤
│  Sandbox Progress (Required Scenarios for your sector)   │
│  ✅ SN001 - Goods at standard rate (registered)          │
│  ✅ SN002 - Goods at standard rate (unregistered)        │
│  ✅ SN005 - Reduced rate sale                            │
│  ⬜ SN006 - Exempt goods                                 │
│  ⬜ SN007 - Zero rated sale                              │
│  ...                                                     │
│                                                          │
│  [Run Test Invoice for SN006 →]                          │
└──────────────────────────────────────────────────────────┘
```

---

## PHASE 11: SUPER ADMIN — MONITOR TENANT DI STATUS

Add to your existing super admin panel:

```typescript
// app/api/admin/tenants/di-status/route.ts
// Returns DI registration status for all tenants at a glance

export async function GET(req: NextRequest) {
  await assertSuperAdmin(req)

  const tenants = await prisma.tenant.findMany({
    include: {
      diCredentials: {
        select: {
          environment: true,
          irisRegistrationStatus: true,
          sandboxCompleted: true,
          isProductionReady: true,
          tokenExpiresAt: true,
          sellerNTN: true,
        }
      },
      _count: { select: { invoices: true } }
    }
  })

  const summary = {
    notConfigured: tenants.filter(t => !t.diCredentials).length,
    sandbox:       tenants.filter(t => t.diCredentials?.environment === 'SANDBOX').length,
    production:    tenants.filter(t => t.diCredentials?.environment === 'PRODUCTION').length,
    tokensExpiringSoon: tenants.filter(t => {
      const exp = t.diCredentials?.tokenExpiresAt
      if (!exp) return false
      return (exp.getTime() - Date.now()) < (30 * 24 * 60 * 60 * 1000) // 30 days
    }).length,
  }

  return NextResponse.json({ tenants, summary })
}
```

---

## PHASE 12: MANUAL RETRY — IMPORTANT PRAL REQUIREMENT

From the PRAL User Manual (section 5.1): **PRAL's system does NOT support automatic retries.** When an invoice fails due to connectivity, it must be manually resubmitted.

Your BullMQ retry queue handles this automatically — but there are two important caveats:

1. **Idempotency:** PRAL does not have a built-in idempotency mechanism by invoice number alone. Check the FBR invoice dashboard first before retrying to avoid duplicates.

2. **Reconciliation:** Build a reconciliation page where tenants can compare their local invoices against what is in their IRIS invoice dashboard and manually trigger resubmission for any gaps.

```typescript
// app/(tenant)/invoices/reconcile/page.tsx
// Shows:
// - All local invoices with QUEUED or FAILED status
// - [Retry] button per invoice → triggers BullMQ job
// - Warning: "Check your IRIS invoice dashboard before retrying to avoid duplicates"
// - Link to IRIS dashboard: https://iris.fbr.gov.pk
```

---

## PHASE 13: SUPPORT ESCALATION VIA PRAL CRM

When tenants have integration issues, they (or you as LI) use the PRAL CRM.

```typescript
// lib/di/support.ts
// Helper to generate pre-filled CRM case information for your tenants

export function generateSupportCaseInfo(
  tenantNTN: string,
  errorCode: string,
  errorDetail: string,
  invoiceId: string
): string {
  return `
PRAL DI Support Case Information
──────────────────────────────────
CRM Portal: https://dicrm.pral.com.pk
Login Type: DI-Support (use your registered CRM email)

Query Type: ${errorCode.startsWith('04') ? 'Integration' : 'Post Integration'}
Priority: ${['0401','0402','0083'].includes(errorCode) ? 'High' : 'Normal'}

Title: Error ${errorCode} - ${DI_SALES_ERRORS[errorCode] ?? 'Invoice submission failure'}

Description:
- Seller NTN: ${tenantNTN}
- Invoice ID: ${invoiceId}
- Error Code: ${errorCode}
- Error Detail: ${errorDetail}
- Platform: [YOUR PLATFORM NAME]
- Licensed Integrator: [YOUR LI NAME]

Please attach: Screenshot of error response (PDF, max 5MB)
  `.trim()
}
```

---

## COMPLETE INTEGRATION CHECKLIST

### Your Platform (One-Time)
- [ ] Register as Licensed Integrator on IRIS portal
- [ ] Submit server IP(s) for whitelisting to PRAL
- [ ] Get sandbox token for your platform
- [ ] Sync reference data (Provinces, UOMs, Rates, HS Codes) from Reference APIs
- [ ] Build sandbox test suite covering all 28 scenarios
- [ ] Pass all sandbox scenarios → get production token
- [ ] Store `PRAL_PLATFORM_TOKEN` in environment variables (for reference data sync)

### Database
- [ ] Replace `FBRCredentials` with `DICredentials` model
- [ ] Add `SandboxScenario` tracking table
- [ ] Add PRAL reference data tables (Province, UOM, Rate, DocType)
- [ ] Update `Invoice` model with `di*` fields
- [ ] Update `InvoiceItem` model with `diRate`, `diUOM`, `diSaleType` fields

### Code
- [ ] Build `getDIClientForTenant()` factory (uses per-tenant Bearer token)
- [ ] Build `buildDIPayload()` — maps your invoice structure to exact PRAL JSON
- [ ] Build `checkBuyerRegistrationType()` — call before each invoice
- [ ] Build `generateDIQRCode()` — version 2.0, 25×25, 1×1 inch
- [ ] Build `mapDIErrorCodes()` — human-readable errors for tenants
- [ ] Build `getRequiredScenarios()` — based on business activity + sector
- [ ] Update `/api/tenant/di/submit/route.ts`
- [ ] Update onboarding flow (Steps 3-6 for IRIS + sandbox)
- [ ] Add QR code + FBR DI logo to receipt PDF template
- [ ] Add sandbox scenario tracking UI
- [ ] Add reconciliation page for manual retry

### Per Tenant (Onboarding)
- [ ] Tenant registers on IRIS and selects you as Licensed Integrator
- [ ] You review and approve their LI request (this triggers PRAL to send them sandbox token)
- [ ] Tenant enters sandbox token in your platform
- [ ] Tenant completes all required sandbox scenarios (minimum 1 invoice each)
- [ ] IRIS auto-generates production token for tenant
- [ ] Tenant enters production token in your platform
- [ ] Environment switches to PRODUCTION → tenant is live

---

## KEY API REFERENCE CARD

```
SUBMIT INVOICE (SANDBOX):   POST https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb
SUBMIT INVOICE (PRODUCTION): POST https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata
VALIDATE INVOICE (SANDBOX):  POST https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb
VALIDATE INVOICE (PRODUCTION): POST https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata

AUTH HEADER: Authorization: Bearer {tenant_security_token}
TOKEN VALIDITY: 5 years (renewable on expiry)

STATUS CODES: 200 OK | 401 Unauthorized | 500 Server Error
RESPONSE STATUS: "00" = Valid | "01" = Invalid

PROVINCES:     GET https://gw.fbr.gov.pk/pdi/v1/provinces
DOC TYPES:     GET https://gw.fbr.gov.pk/pdi/v1/doctypecode
HS CODES:      GET https://gw.fbr.gov.pk/pdi/v1/itemdesccode
UOM:           GET https://gw.fbr.gov.pk/pdi/v1/uom
RATES:         GET https://gw.fbr.gov.pk/pdi/v2/SaleTypeToRate?date=&transTypeId=&originationSupplier=
HS CODE + UOM: GET https://gw.fbr.gov.pk/pdi/v2/HS_UOM?hs_code=&annexure_id=3
REG TYPE:      GET https://gw.fbr.gov.pk/dist/v1/Get_Reg_Type  BODY: {"Registration_No":"NTN"}
ATL STATUS:    GET https://gw.fbr.gov.pk/dist/v1/statl  BODY: {"regno":"NTN","date":"YYYY-MM-DD"}

PRAL SUPPORT CRM: https://dicrm.pral.com.pk
IRIS PORTAL:      https://iris.fbr.gov.pk
```

---

*Integration Guide v1.0 — Based on PRAL DI User Manual v1.5 + Technical Specification for DI API v1.12*
*Platform: Licensed Integrator mode — each tenant uses their own IRIS-issued security token*
