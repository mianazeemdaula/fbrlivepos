# FBR Multi-Tenant SaaS POS / Invoicing Platform
## AI Agent Build Instructions v2.0
### NextJS · Multi-Business · Per-Tenant FBR Credentials · HS Code Sales · Offline Resilience

---

## 0. System Architecture Overview

This is a **SaaS platform** where multiple independent businesses (tenants) sign up, configure their own FBR credentials, and operate their own POS/invoicing system — all on shared infrastructure.

### Core Concepts

```
Platform Layer (YOU own this)
│
├── Super Admin Panel     → manage tenants, billing, platform health
│
└── Tenant Layer (each BUSINESS gets their own)
    ├── Business onboarding & FBR credential setup
    ├── POS Terminal(s)   → one or many per business
    ├── Product Catalogue → scoped to tenant
    ├── Invoice History   → scoped to tenant
    ├── Staff accounts    → cashiers, managers, admins per tenant
    └── FBR submissions   → using THAT tenant's credentials only
```

### Tenancy Model: **Schema-per-tenant isolation via `tenantId`**
- Single PostgreSQL database, every table has `tenantId`
- Row-level security enforced at API and DB level
- FBR credentials encrypted at rest per tenant
- BullMQ queue jobs tagged with `tenantId`
- Circuit breakers are per-tenant (Business A's FBR failures don't affect Business B)

---

## 1. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 App Router | SSR + API routes, subdomain routing |
| Language | TypeScript strict | Type-safe FBR payloads per tenant |
| Database | PostgreSQL + Prisma | Multi-tenant with `tenantId` on all tables |
| Encryption | `@node-rs/argon2` + AES-256-GCM | Encrypt FBR API keys at rest |
| Queue | BullMQ + Redis | Per-tenant job queues for FBR retries |
| Auth | NextAuth.js v5 | Tenant-scoped sessions |
| PDF | @react-pdf/renderer | Per-tenant branded invoices |
| QR | qrcode | FBR verification QR codes |
| UI | Tailwind CSS + shadcn/ui | Shared component library |
| State | Zustand | POS cart, tenant context |
| Validation | Zod | FBR payload + credential schemas |
| Email | Resend | Onboarding, alerts, invoice emails |
| Billing | Stripe | Subscription per tenant (optional) |
| Testing | Vitest + Playwright | Multi-tenant test isolation |

---

## 2. Repository Structure

```
fbr-saas/
├── app/
│   ├── (marketing)/               # Public landing, pricing, signup
│   │   ├── page.tsx
│   │   ├── pricing/page.tsx
│   │   └── signup/page.tsx
│   │
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── onboarding/            # Post-signup business setup
│   │       ├── business/page.tsx
│   │       ├── fbr-credentials/page.tsx
│   │       └── pos-setup/page.tsx
│   │
│   ├── (tenant)/                  # All tenant-scoped pages
│   │   ├── layout.tsx             # Injects tenantId from session
│   │   ├── pos/
│   │   │   ├── page.tsx           # POS Terminal
│   │   │   └── invoice/[id]/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── invoices/page.tsx
│   │   ├── products/page.tsx
│   │   ├── reports/page.tsx
│   │   └── settings/
│   │       ├── page.tsx
│   │       ├── fbr/page.tsx       # FBR credential management
│   │       ├── pos-terminals/page.tsx
│   │       └── staff/page.tsx
│   │
│   ├── (super-admin)/             # Platform owner panel
│   │   ├── layout.tsx             # Super-admin role guard
│   │   ├── tenants/page.tsx
│   │   ├── fbr-health/page.tsx    # Cross-tenant FBR health
│   │   └── billing/page.tsx
│   │
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── onboarding/
│       │   └── route.ts
│       ├── tenant/
│       │   ├── fbr-credentials/route.ts    # Save/update FBR creds
│       │   ├── fbr-credentials/verify/route.ts  # Test FBR connection
│       │   ├── fbr/submit/route.ts
│       │   ├── fbr/status/route.ts
│       │   └── fbr/retry/route.ts
│       ├── invoices/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── products/route.ts
│       └── super-admin/
│           ├── tenants/route.ts
│           └── platform-health/route.ts
│
├── lib/
│   ├── tenant/
│   │   ├── context.ts             # getTenantFromSession(), getTenantById()
│   │   └── guard.ts               # assertTenantAccess() middleware helper
│   ├── fbr/
│   │   ├── client.ts              # Per-tenant FBR client factory
│   │   ├── schema.ts              # Zod schemas
│   │   ├── circuit-breaker.ts     # Per-tenant circuit breaker registry
│   │   └── queue.ts               # Per-tenant BullMQ queue
│   ├── crypto/
│   │   └── credentials.ts         # AES-256-GCM encrypt/decrypt FBR keys
│   ├── db/
│   │   └── prisma.ts
│   └── pdf/
│       └── invoice-template.tsx
│
├── prisma/
│   └── schema.prisma
│
├── components/
│   ├── pos/
│   ├── onboarding/
│   │   ├── FBRCredentialsForm.tsx
│   │   └── FBRConnectionTest.tsx
│   └── ui/
│
├── workers/
│   └── fbr-worker.ts              # Single worker, handles all tenants
│
└── middleware.ts                  # Auth + tenant resolution
```

---

## 3. Database Schema (Prisma — Multi-Tenant)

```prisma
// prisma/schema.prisma

// ─── PLATFORM LEVEL ──────────────────────────────────────────────────────────

model Tenant {
  id            String        @id @default(cuid())
  name          String                            // Business name
  slug          String        @unique             // URL slug: acme-traders
  email         String        @unique             // Owner email
  phone         String?
  address       String?
  logoUrl       String?
  plan          Plan          @default(FREE)
  planStatus    PlanStatus    @default(ACTIVE)
  isActive      Boolean       @default(true)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  fbrCredentials  FBRCredentials?
  users           User[]
  posTerminals    POSTerminal[]
  products        Product[]
  invoices        Invoice[]
  submissionLogs  FBRSubmissionLog[]
}

// FBR credentials stored encrypted — one set per tenant
model FBRCredentials {
  id                String    @id @default(cuid())
  tenant            Tenant    @relation(fields: [tenantId], references: [id])
  tenantId          String    @unique

  // Encrypted with AES-256-GCM using CREDENTIALS_ENCRYPTION_KEY env var
  encryptedApiKey   String    // FBR API key — NEVER store plaintext
  encryptedPosId    String    // FBR registered POS ID(s)
  ntn               String    // National Tax Number (not sensitive, stored plain)
  strn              String?   // Sales Tax Registration Number
  businessName      String    // Registered business name with FBR
  fbrEndpoint       String    @default("https://esp.fbr.gov.pk")

  isVerified        Boolean   @default(false)  // true after successful test call
  lastVerifiedAt    DateTime?
  lastUsedAt        DateTime?
  verificationError String?

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}

model POSTerminal {
  id          String    @id @default(cuid())
  tenant      Tenant    @relation(fields: [tenantId], references: [id])
  tenantId    String
  name        String    // e.g. "Counter 1", "Main POS"
  location    String?   // Physical location description
  isActive    Boolean   @default(true)
  lastSeenAt  DateTime?
  createdAt   DateTime  @default(now())

  invoices    Invoice[]

  @@index([tenantId])
}

// ─── USERS ────────────────────────────────────────────────────────────────────

model User {
  id        String    @id @default(cuid())
  tenant    Tenant    @relation(fields: [tenantId], references: [id])
  tenantId  String
  name      String
  email     String
  password  String    // argon2 hash
  role      UserRole  @default(CASHIER)
  pin       String?   // 4-digit PIN hash for quick POS login
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now())

  invoices  Invoice[]

  @@unique([email, tenantId])   // email unique per tenant, not globally
  @@index([tenantId])
}

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────

model Product {
  id          String    @id @default(cuid())
  tenant      Tenant    @relation(fields: [tenantId], references: [id])
  tenantId    String
  name        String
  sku         String?
  hsCode      String    // HS Code 4–10 digits — FBR mandatory
  description String?
  price       Decimal   @db.Decimal(10, 2)
  taxRate     Decimal   @db.Decimal(5, 2)   // e.g. 17.00 = 17% GST
  unit        String    // PCS, KG, LTR, MTR, etc.
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())

  invoiceItems InvoiceItem[]

  @@index([tenantId])
  @@index([tenantId, hsCode])
}

// ─── INVOICES ─────────────────────────────────────────────────────────────────

model Invoice {
  id              String        @id @default(cuid())
  tenant          Tenant        @relation(fields: [tenantId], references: [id])
  tenantId        String
  terminal        POSTerminal?  @relation(fields: [terminalId], references: [id])
  terminalId      String?
  user            User          @relation(fields: [userId], references: [id])
  userId          String

  // Invoice identity
  invoiceNumber   String        // Per-tenant sequential: INV-2024-000001
  invoiceDate     DateTime      @default(now())

  // Buyer info (optional for B2C)
  buyerNTN        String?
  buyerName       String?
  buyerPhone      String?

  // Financials
  subtotal        Decimal       @db.Decimal(12, 2)
  taxAmount       Decimal       @db.Decimal(12, 2)
  totalAmount     Decimal       @db.Decimal(12, 2)
  paymentMethod   PaymentMethod

  // FBR submission state
  status          InvoiceStatus @default(PENDING)
  submittedToFbr  Boolean       @default(false)
  fbrInvoiceId    String?       // FBR-issued reference
  fbrQrCode       String?       // QR data from FBR
  fbrResponse     Json?         // Full FBR response stored
  submissionError String?
  retryCount      Int           @default(0)
  queuedAt        DateTime?

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  items           InvoiceItem[]

  @@unique([tenantId, invoiceNumber])   // Sequential per tenant
  @@index([tenantId])
  @@index([tenantId, status])
  @@index([tenantId, createdAt])
}

model InvoiceItem {
  id          String  @id @default(cuid())
  invoice     Invoice @relation(fields: [invoiceId], references: [id])
  invoiceId   String
  product     Product @relation(fields: [productId], references: [id])
  productId   String
  hsCode      String
  name        String
  quantity    Decimal @db.Decimal(10, 3)
  unit        String
  unitPrice   Decimal @db.Decimal(10, 2)
  taxRate     Decimal @db.Decimal(5, 2)
  taxAmount   Decimal @db.Decimal(10, 2)
  lineTotal   Decimal @db.Decimal(12, 2)
}

// ─── LOGS ─────────────────────────────────────────────────────────────────────

model FBRSubmissionLog {
  id           String   @id @default(cuid())
  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  tenantId     String
  invoiceId    String
  attempt      Int
  requestBody  Json
  responseCode Int?
  responseBody Json?
  error        String?
  durationMs   Int?
  createdAt    DateTime @default(now())

  @@index([tenantId])
  @@index([invoiceId])
}

// Invoice number counter per tenant (atomic increment)
model InvoiceCounter {
  tenantId      String  @id
  currentValue  Int     @default(0)
}

// ─── ENUMS ────────────────────────────────────────────────────────────────────

enum Plan          { FREE STARTER PRO ENTERPRISE }
enum PlanStatus    { ACTIVE SUSPENDED CANCELLED }
enum UserRole      { SUPER_ADMIN TENANT_ADMIN MANAGER CASHIER }
enum PaymentMethod { CASH CARD BANK_TRANSFER }
enum InvoiceStatus { PENDING QUEUED SUBMITTED FAILED }
```

---

## 4. Credential Encryption

```typescript
// lib/crypto/credentials.ts
// AES-256-GCM symmetric encryption for FBR API keys

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM  = 'aes-256-gcm'
const KEY_HEX    = process.env.CREDENTIALS_ENCRYPTION_KEY! // 64 hex chars = 32 bytes
const KEY_BUFFER = Buffer.from(KEY_HEX, 'hex')

export function encryptCredential(plaintext: string): string {
  const iv        = randomBytes(12)                          // 96-bit IV for GCM
  const cipher    = createCipheriv(ALGORITHM, KEY_BUFFER, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag   = cipher.getAuthTag()

  // Format: iv:authTag:ciphertext  (all base64)
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

export function decryptCredential(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(':')
  const iv        = Buffer.from(ivB64, 'base64')
  const authTag   = Buffer.from(tagB64, 'base64')
  const data      = Buffer.from(dataB64, 'base64')

  const decipher  = createDecipheriv(ALGORITHM, KEY_BUFFER, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
```

**Key rotation:** When rotating `CREDENTIALS_ENCRYPTION_KEY`, run a migration job that decrypts all records with the old key and re-encrypts with the new key. Never store old keys in env files.

---

## 5. Per-Tenant FBR Client Factory

```typescript
// lib/fbr/client.ts

import { decryptCredential } from '@/lib/crypto/credentials'
import { FBRCircuitBreakerRegistry } from './circuit-breaker'
import { FBRInvoicePayload, FBRResponse } from './schema'
import { prisma } from '@/lib/db/prisma'

// One circuit breaker instance per tenant — failures are isolated
const circuitRegistry = new FBRCircuitBreakerRegistry()

export async function getFBRClientForTenant(tenantId: string) {
  const creds = await prisma.fBRCredentials.findUnique({
    where: { tenantId },
  })

  if (!creds) throw new Error(`No FBR credentials configured for tenant ${tenantId}`)
  if (!creds.isVerified) throw new Error(`FBR credentials not verified for tenant ${tenantId}`)

  // Decrypt at runtime — never cached in memory
  const apiKey = decryptCredential(creds.encryptedApiKey)
  const posId  = decryptCredential(creds.encryptedPosId)
  const breaker = circuitRegistry.get(tenantId)

  return {
    submitInvoice: async (payload: FBRInvoicePayload): Promise<FBRResponse> => {
      return breaker.execute(async () => {
        const start = Date.now()
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 15_000)

        try {
          const res = await fetch(`${creds.fbrEndpoint}/api/invoice/submit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'X-POS-ID': posId,
              'X-NTN': creds.ntn,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          })
          clearTimeout(timer)

          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}))
            throw new FBRApiError(res.status, errBody, tenantId)
          }

          // Track last used
          await prisma.fBRCredentials.update({
            where: { tenantId },
            data: { lastUsedAt: new Date() },
          })

          return res.json() as Promise<FBRResponse>
        } catch (err) {
          clearTimeout(timer)
          throw err
        }
      })
    },

    checkHealth: async (): Promise<{ online: boolean; latencyMs?: number }> => {
      const start = Date.now()
      try {
        const res = await fetch(`${creds.fbrEndpoint}/api/health`, {
          signal: AbortSignal.timeout(5_000),
        })
        return { online: res.ok, latencyMs: Date.now() - start }
      } catch {
        return { online: false }
      }
    },

    getCircuitState: () => breaker.getState(),
    tenantId,
    ntn: creds.ntn,
  }
}

export class FBRApiError extends Error {
  constructor(
    public statusCode: number,
    public body: unknown,
    public tenantId: string,
  ) {
    super(`FBR API error ${statusCode} for tenant ${tenantId}`)
    this.name = 'FBRApiError'
  }
}
```

---

## 6. Per-Tenant Circuit Breaker Registry

```typescript
// lib/fbr/circuit-breaker.ts

type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

class TenantCircuitBreaker {
  private state: State = 'CLOSED'
  private failureCount = 0
  private successCount = 0
  private nextAttempt = 0
  private readonly FAILURE_THRESHOLD = 3
  private readonly SUCCESS_THRESHOLD = 2
  private readonly OPEN_TIMEOUT_MS   = 30_000

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('FBR_CIRCUIT_OPEN')
      }
      this.state = 'HALF_OPEN'
      this.successCount = 0
    }
    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure()
      throw err
    }
  }

  private onSuccess() {
    this.failureCount = 0
    if (this.state === 'HALF_OPEN') {
      if (++this.successCount >= this.SUCCESS_THRESHOLD) this.state = 'CLOSED'
    }
  }

  private onFailure() {
    if (++this.failureCount >= this.FAILURE_THRESHOLD || this.state === 'HALF_OPEN') {
      this.state = 'OPEN'
      this.nextAttempt = Date.now() + this.OPEN_TIMEOUT_MS
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      nextAttemptAt: this.state === 'OPEN' ? new Date(this.nextAttempt) : null,
    }
  }

  reset() { this.state = 'CLOSED'; this.failureCount = 0 }
}

// Singleton registry — one breaker per tenant per server process
export class FBRCircuitBreakerRegistry {
  private static instance: FBRCircuitBreakerRegistry
  private breakers = new Map<string, TenantCircuitBreaker>()

  static getInstance() {
    if (!this.instance) this.instance = new FBRCircuitBreakerRegistry()
    return this.instance
  }

  get(tenantId: string): TenantCircuitBreaker {
    if (!this.breakers.has(tenantId)) {
      this.breakers.set(tenantId, new TenantCircuitBreaker())
    }
    return this.breakers.get(tenantId)!
  }

  getAllStates() {
    const result: Record<string, ReturnType<TenantCircuitBreaker['getState']>> = {}
    this.breakers.forEach((b, id) => { result[id] = b.getState() })
    return result
  }
}
```

---

## 7. Per-Tenant BullMQ Queue

```typescript
// lib/fbr/queue.ts

import { Queue, Worker, Job } from 'bullmq'
import { getFBRClientForTenant } from './client'
import { prisma } from '@/lib/db/prisma'
import { buildFBRPayload } from './builder'

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
}

// Single shared queue — tenantId is in job data
export const fbrQueue = new Queue('fbr-submissions', {
  connection,
  defaultJobOptions: {
    attempts: 10,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 5000 },
    removeOnFail:    { count: 2000 },
  },
})

export async function enqueueInvoiceSubmission(tenantId: string, invoiceId: string) {
  const jobId = `tenant:${tenantId}:inv:${invoiceId}`

  await fbrQueue.add(
    'submit',
    { tenantId, invoiceId },
    {
      jobId,            // Idempotent — duplicate enqueue is a no-op
      priority: 1,
    }
  )

  await prisma.invoice.update({
    where: { id: invoiceId, tenantId },   // tenantId guard
    data: { status: 'QUEUED', queuedAt: new Date() },
  })
}

export async function getQueueStatsForTenant(tenantId: string) {
  const jobs = await fbrQueue.getJobs(['waiting', 'active', 'delayed', 'failed'])
  const tenantJobs = jobs.filter(j => j.data?.tenantId === tenantId)

  return {
    waiting: tenantJobs.filter(j => j.opts.priority !== undefined).length,
    active:  (await fbrQueue.getActive()).filter(j => j.data?.tenantId === tenantId).length,
    failed:  tenantJobs.filter(j => j.failedReason).length,
  }
}

// ─── WORKER ────────────────────────────────────────────────────────────────────
// Run as a standalone process: npx tsx workers/fbr-worker.ts

export function startFBRWorker() {
  const worker = new Worker(
    'fbr-submissions',
    async (job: Job<{ tenantId: string; invoiceId: string }>) => {
      const { tenantId, invoiceId } = job.data

      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { id: invoiceId, tenantId },  // tenantId guard — critical
        include: { items: true, tenant: { include: { fbrCredentials: true } } },
      })

      const fbrClient = await getFBRClientForTenant(tenantId)
      const payload = buildFBRPayload(invoice, invoice.tenant.fbrCredentials!)

      const start = Date.now()

      try {
        const response = await fbrClient.submitInvoice(payload)

        await prisma.$transaction([
          prisma.invoice.update({
            where: { id: invoiceId, tenantId },
            data: {
              status: 'SUBMITTED',
              submittedToFbr: true,
              fbrInvoiceId: response.invoiceNumber,
              fbrQrCode: response.qrCode,
              fbrResponse: response as object,
              retryCount: job.attemptsMade,
            },
          }),
          prisma.fBRSubmissionLog.create({
            data: {
              tenantId,
              invoiceId,
              attempt: job.attemptsMade + 1,
              requestBody: payload as object,
              responseCode: 200,
              responseBody: response as object,
              durationMs: Date.now() - start,
            },
          }),
        ])

      } catch (err) {
        await prisma.$transaction([
          prisma.fBRSubmissionLog.create({
            data: {
              tenantId,
              invoiceId,
              attempt: job.attemptsMade + 1,
              requestBody: payload as object,
              error: String(err),
              durationMs: Date.now() - start,
            },
          }),
          prisma.invoice.update({
            where: { id: invoiceId, tenantId },
            data: {
              submissionError: String(err),
              retryCount: job.attemptsMade + 1,
            },
          }),
        ])

        throw err  // BullMQ will retry
      }
    },
    {
      connection,
      concurrency: 10,   // 10 concurrent jobs across all tenants
    }
  )

  worker.on('failed', async (job, err) => {
    if (!job) return
    const maxAttempts = job.opts.attempts ?? 10
    if (job.attemptsMade >= maxAttempts) {
      // Final failure — mark invoice permanently failed
      await prisma.invoice.update({
        where: { id: job.data.invoiceId, tenantId: job.data.tenantId },
        data: { status: 'FAILED' },
      }).catch(console.error)

      // TODO: Send alert email to tenant admin via Resend
    }
  })

  return worker
}
```

---

## 8. Tenant Context & Guard

```typescript
// lib/tenant/context.ts

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

export async function getTenantFromSession() {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('UNAUTHORIZED')

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: session.user.tenantId, isActive: true },
  })

  return { tenant, userId: session.user.id, role: session.user.role }
}

// Use in every API route that touches tenant data
export function assertTenantOwnership(
  resourceTenantId: string,
  sessionTenantId: string
) {
  if (resourceTenantId !== sessionTenantId) {
    throw new Error('FORBIDDEN: Cross-tenant access denied')
  }
}
```

```typescript
// middleware.ts

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function middleware(req: NextRequest) {
  const session = await auth()
  const path = req.nextUrl.pathname

  // Protect all tenant routes
  if (path.startsWith('/pos') || path.startsWith('/dashboard') ||
      path.startsWith('/invoices') || path.startsWith('/settings')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    // Enforce onboarding completion
    if (!session.user.fbrConfigured && !path.startsWith('/onboarding')) {
      return NextResponse.redirect(new URL('/onboarding/fbr-credentials', req.url))
    }
  }

  // Protect super-admin
  if (path.startsWith('/super-admin') && session?.user.role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}
```

---

## 9. FBR Credentials API Routes

```typescript
// app/api/tenant/fbr-credentials/route.ts
// Save or update tenant's FBR credentials

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantFromSession } from '@/lib/tenant/context'
import { encryptCredential } from '@/lib/crypto/credentials'
import { prisma } from '@/lib/db/prisma'

const CredentialsSchema = z.object({
  apiKey:       z.string().min(10),
  posId:        z.string().min(3),
  ntn:          z.string().regex(/^\d{7}$/, 'NTN must be 7 digits'),
  strn:         z.string().optional(),
  businessName: z.string().min(2),
  fbrEndpoint:  z.string().url().optional(),
})

export async function POST(req: NextRequest) {
  const { tenant } = await getTenantFromSession()
  const body = CredentialsSchema.parse(await req.json())

  const encryptedApiKey = encryptCredential(body.apiKey)
  const encryptedPosId  = encryptCredential(body.posId)

  await prisma.fBRCredentials.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId:       tenant.id,
      encryptedApiKey,
      encryptedPosId,
      ntn:            body.ntn,
      strn:           body.strn,
      businessName:   body.businessName,
      fbrEndpoint:    body.fbrEndpoint ?? 'https://esp.fbr.gov.pk',
      isVerified:     false,
    },
    update: {
      encryptedApiKey,
      encryptedPosId,
      ntn:            body.ntn,
      strn:           body.strn,
      businessName:   body.businessName,
      fbrEndpoint:    body.fbrEndpoint ?? 'https://esp.fbr.gov.pk',
      isVerified:     false,   // Reset verification on credential change
      verificationError: null,
    },
  })

  return NextResponse.json({ success: true })
}
```

```typescript
// app/api/tenant/fbr-credentials/verify/route.ts
// Test FBR connection with the stored credentials

import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { getFBRClientForTenant } from '@/lib/fbr/client'
import { prisma } from '@/lib/db/prisma'

export async function POST(req: NextRequest) {
  const { tenant } = await getTenantFromSession()

  try {
    // Temporarily mark as verified to allow the health check call
    await prisma.fBRCredentials.update({
      where: { tenantId: tenant.id },
      data: { isVerified: true },
    })

    const client = await getFBRClientForTenant(tenant.id)
    const health = await client.checkHealth()

    if (!health.online) throw new Error('FBR endpoint unreachable')

    await prisma.fBRCredentials.update({
      where: { tenantId: tenant.id },
      data: {
        isVerified: true,
        lastVerifiedAt: new Date(),
        verificationError: null,
      },
    })

    return NextResponse.json({
      success: true,
      latencyMs: health.latencyMs,
      message: 'FBR connection verified successfully',
    })

  } catch (err) {
    await prisma.fBRCredentials.update({
      where: { tenantId: tenant.id },
      data: {
        isVerified: false,
        verificationError: String(err),
      },
    })

    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 422 }
    )
  }
}
```

---

## 10. Invoice Submission Route (Tenant-Scoped)

```typescript
// app/api/tenant/fbr/submit/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession } from '@/lib/tenant/context'
import { getFBRClientForTenant, FBRApiError } from '@/lib/fbr/client'
import { enqueueInvoiceSubmission } from '@/lib/fbr/queue'
import { prisma } from '@/lib/db/prisma'
import { buildFBRPayload } from '@/lib/fbr/builder'

export async function POST(req: NextRequest) {
  const { tenant, userId } = await getTenantFromSession()
  const { invoiceId } = await req.json()

  // Fetch and verify ownership in one query
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId, tenantId: tenant.id },   // Cross-tenant guard
    include: { items: true },
  })

  // Check if FBR credentials are configured
  const creds = await prisma.fBRCredentials.findUnique({
    where: { tenantId: tenant.id },
  })

  if (!creds?.isVerified) {
    return NextResponse.json(
      { error: 'FBR credentials not configured. Please set up your FBR credentials in Settings.' },
      { status: 422 }
    )
  }

  const fbrClient = await getFBRClientForTenant(tenant.id)
  const circuitState = fbrClient.getCircuitState()

  // If circuit is OPEN — skip the health check and queue immediately
  if (circuitState.state === 'OPEN') {
    await enqueueInvoiceSubmission(tenant.id, invoiceId)
    return NextResponse.json({
      success: true,
      offline: true,
      reason: 'circuit_open',
      message: 'FBR service is temporarily unavailable. Invoice queued for automatic retry.',
      nextRetryAt: circuitState.nextAttemptAt,
    })
  }

  // Health check
  const health = await fbrClient.checkHealth()

  if (!health.online) {
    await enqueueInvoiceSubmission(tenant.id, invoiceId)
    return NextResponse.json({
      success: true,
      offline: true,
      reason: 'health_check_failed',
      message: 'FBR is currently unreachable. Invoice queued for automatic submission.',
    })
  }

  // Attempt live submission
  const payload = buildFBRPayload(invoice, creds)

  try {
    const response = await fbrClient.submitInvoice(payload)

    await prisma.$transaction([
      prisma.invoice.update({
        where: { id: invoiceId, tenantId: tenant.id },
        data: {
          status: 'SUBMITTED',
          submittedToFbr: true,
          fbrInvoiceId: response.invoiceNumber,
          fbrQrCode: response.qrCode,
          fbrResponse: response as object,
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
        },
      }),
    ])

    return NextResponse.json({ success: true, offline: false, fbrResponse: response })

  } catch (err) {
    if (err instanceof FBRApiError && err.statusCode >= 500) {
      await enqueueInvoiceSubmission(tenant.id, invoiceId)
      return NextResponse.json({
        success: true,
        offline: true,
        reason: 'fbr_server_error',
        message: 'FBR server error. Invoice queued for retry.',
      })
    }

    // 4xx = bad data — do not retry
    await prisma.invoice.update({
      where: { id: invoiceId, tenantId: tenant.id },
      data: { status: 'FAILED', submissionError: String(err) },
    })

    return NextResponse.json(
      { success: false, error: 'FBR rejected the invoice', details: String(err) },
      { status: 422 }
    )
  }
}
```

---

## 11. Onboarding Flow (Multi-Step)

```
Step 1: Account Creation
  → email, password, business name, phone

Step 2: Business Details
  → full address, business type, logo upload

Step 3: FBR Credentials  ← most important
  → NTN, STRN, FBR API Key, POS ID
  → "Test Connection" button calls /api/tenant/fbr-credentials/verify
  → Must pass before proceeding

Step 4: POS Setup
  → Name first POS terminal (e.g. "Main Counter")
  → Add initial products with HS codes (optional, can do later)

Step 5: Done — redirect to POS terminal
```

```tsx
// components/onboarding/FBRCredentialsForm.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  ntn:          z.string().regex(/^\d{7}$/, 'Enter 7-digit NTN'),
  strn:         z.string().optional(),
  apiKey:       z.string().min(10, 'Enter your FBR API key'),
  posId:        z.string().min(3, 'Enter your FBR POS ID'),
  businessName: z.string().min(2),
})

export function FBRCredentialsForm({ onComplete }: { onComplete: () => void }) {
  const [testStatus, setTestStatus] = useState<'idle'|'testing'|'success'|'error'>('idle')
  const [testError, setTestError] = useState('')

  const form = useForm({ resolver: zodResolver(schema) })

  async function saveAndTest(data: z.infer<typeof schema>) {
    // 1. Save credentials
    await fetch('/api/tenant/fbr-credentials', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    })

    // 2. Test connection
    setTestStatus('testing')
    const res = await fetch('/api/tenant/fbr-credentials/verify', { method: 'POST' })
    const result = await res.json()

    if (result.success) {
      setTestStatus('success')
      setTimeout(onComplete, 1500)
    } else {
      setTestStatus('error')
      setTestError(result.error)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(saveAndTest)} className="space-y-4">
      {/* Form fields for NTN, STRN, API Key, POS ID */}
      {/* ... */}

      {testStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
          Connection failed: {testError}
        </div>
      )}

      {testStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded p-3 text-green-700 text-sm">
          ✓ FBR connection verified successfully
        </div>
      )}

      <button
        type="submit"
        disabled={testStatus === 'testing'}
        className="w-full bg-blue-600 text-white py-2 rounded font-medium"
      >
        {testStatus === 'testing' ? 'Testing connection...' : 'Save & Verify FBR Credentials'}
      </button>
    </form>
  )
}
```

---

## 12. Sequential Invoice Numbering (Per-Tenant, Atomic)

```typescript
// lib/invoices/numbering.ts
// Uses PostgreSQL advisory locks for atomic per-tenant sequence

export async function getNextInvoiceNumber(tenantId: string): Promise<string> {
  const result = await prisma.$transaction(async (tx) => {
    // Upsert counter row and atomically increment
    const counter = await tx.$executeRaw`
      INSERT INTO "InvoiceCounter" ("tenantId", "currentValue")
      VALUES (${tenantId}, 1)
      ON CONFLICT ("tenantId")
      DO UPDATE SET "currentValue" = "InvoiceCounter"."currentValue" + 1
      RETURNING "currentValue"
    `

    const row = await tx.invoiceCounter.findUniqueOrThrow({
      where: { tenantId },
    })

    const year = new Date().getFullYear()
    const seq  = String(row.currentValue).padStart(6, '0')
    return `INV-${year}-${seq}`
  })

  return result
}
```

---

## 13. Settings Page — FBR Credentials Management

The settings page at `/settings/fbr` must show:

1. **Current status**: Verified ✓ / Not configured / Failed
2. **Credential fields** (masked): NTN, STRN, API Key (last 4 chars only), POS ID (last 4 chars)
3. **"Update Credentials"** button → opens form, requires password confirmation
4. **"Re-test Connection"** button → re-runs verification
5. **Last verified at** timestamp
6. **Last used at** timestamp
7. **FBR API health** — current live status of the FBR endpoint

```typescript
// Security rules for the settings page:
// - NEVER display the full API key after it's saved
// - Show only last 4 characters: "••••••••••••abcd"
// - Require current password to update credentials
// - Log credential changes to an audit trail
// - Send email to tenant admin on credential change
```

---

## 14. Environment Variables

```bash
# .env.local

# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/fbr_saas"

# Redis
REDIS_HOST="localhost"
REDIS_PORT="6379"

# CRITICAL: 32-byte key for AES-256-GCM (generate with: openssl rand -hex 32)
CREDENTIALS_ENCRYPTION_KEY="your-64-hex-char-key-here"

# Auth
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"

# Email (Resend)
RESEND_API_KEY="re_..."
FROM_EMAIL="noreply@yourplatform.com"

# App
NEXT_PUBLIC_APP_NAME="FBR POS Platform"
NEXT_PUBLIC_CURRENCY="PKR"

# Stripe (optional)
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

---

## 15. Super Admin Panel

The super admin (platform owner) panel provides:

- **Tenant list**: all businesses, signup date, plan, FBR verified status
- **Cross-tenant FBR health**: how many tenants are online/offline/queued
- **Circuit breaker states**: which tenants' FBR connections are currently open
- **Platform queue monitor**: total jobs waiting/active/failed across all tenants
- **Tenant detail**: impersonate, view invoices, reset credentials, suspend tenant
- **FBR endpoint config**: update the global FBR base URL if FBR changes their API

---

## 16. AI Agent Implementation Rules

1. **`tenantId` on EVERY query** — no database query may touch `Invoice`, `Product`, `FBRSubmissionLog`, or any tenant model without `where: { tenantId }`. This is non-negotiable.

2. **Never log or cache decrypted credentials** — `decryptCredential()` result must only live in the request/job scope. Never store in Redis, logs, or response bodies.

3. **FBR credentials must be verified before first use** — check `isVerified: true` on `FBRCredentials` before calling the FBR API.

4. **One circuit breaker per tenant** — use `FBRCircuitBreakerRegistry.getInstance().get(tenantId)`. Tenant A's FBR failures must never affect Tenant B.

5. **Invoice number is per-tenant sequential** — use the atomic `getNextInvoiceNumber(tenantId)` function. Never generate invoice numbers in application code without the DB lock.

6. **Onboarding gate** — if a tenant has no verified FBR credentials, middleware redirects all POS/invoice routes to the FBR setup page.

7. **Tenant isolation in queue** — every BullMQ job must carry `tenantId` in its data. The worker must re-verify `tenantId` matches the invoice before submitting to FBR.

8. **Credential change audit** — every time FBR credentials are updated, write an audit log entry with timestamp, userId, and IP address.

9. **Masked display only** — the frontend must never receive the full API key. API routes that return credential info must mask to last 4 characters.

10. **Plan enforcement** — check tenant's `planStatus` and `plan` in middleware. Suspended tenants get a "Account suspended" page, not a silent 403.

11. **Cross-tenant report isolation** — reports, dashboards, and analytics must always filter by `tenantId`. Aggregate platform stats are only for super admins.

12. **Idempotent FBR submissions** — use `jobId: 'tenant:${tenantId}:inv:${invoiceId}'` in BullMQ to prevent duplicate queue entries on network retry.

---

## 17. Security Checklist

- [ ] AES-256-GCM encryption for all FBR API keys at rest
- [ ] `tenantId` filter on every database query (row-level isolation)
- [ ] Password re-confirmation before credential updates
- [ ] Credential change audit logging with IP + userId
- [ ] Masked API key display (last 4 chars only)
- [ ] Rate limiting on `/api/tenant/fbr-credentials/verify` (prevent brute force)
- [ ] NextAuth session tied to `tenantId` and `role`
- [ ] Super admin routes protected by `role === 'SUPER_ADMIN'` server-side check
- [ ] HTTPS enforced in production
- [ ] `CREDENTIALS_ENCRYPTION_KEY` stored in secret manager (not .env in production)
- [ ] BullMQ worker validates `tenantId` before every FBR call

---

## 18. Development Setup

```bash
# Bootstrap
npx create-next-app@latest fbr-saas --typescript --tailwind --app
cd fbr-saas

# Core deps
npm install prisma @prisma/client bullmq ioredis zod
npm install @react-pdf/renderer qrcode zustand react-hook-form @hookform/resolvers
npm install next-auth@beta resend
npm install @node-rs/argon2

# Dev deps
npm install -D @types/qrcode vitest @playwright/test

# Generate encryption key
openssl rand -hex 32   # → paste into CREDENTIALS_ENCRYPTION_KEY

# DB setup
npx prisma init
npx prisma migrate dev --name multi_tenant_init

# Dev
npm run dev                                    # Next.js app
npx tsx workers/fbr-worker.ts                 # BullMQ worker (separate terminal)
```

---

*Document version 2.0 — Multi-Tenant SaaS — FBR PRAL/IRIS — Pakistan GST Compliance*
*Each tenant's FBR credentials are isolated, encrypted, and never shared across businesses.*

---

# FBR SaaS Platform — Super Admin Panel + Subscription Management
## AI Agent Build Instructions v3.0
### Super Admin · HS Code Library · Subscription Plans · Tenant Controls · Billing

---

## 0. What This Document Covers

This extends v2.0 (multi-tenant FBR POS) with:

1. **Super Admin Panel** — full platform control dashboard
2. **Subscription Plan Management** — create/edit plans with feature limits
3. **HS Code Master Library** — platform-managed HS code catalogue businesses pick from
4. **Tenant Management** — suspend, upgrade, impersonate, view details
5. **Billing & Invoicing** — platform's own subscription billing to tenants
6. **Feature Flags** — per-plan and per-tenant feature toggles
7. **Platform Analytics** — MRR, churn, FBR health across all tenants

---

## 1. Updated Repository Structure (additions only)

```
fbr-saas/
├── app/
│   ├── (super-admin)/                     ← EXPAND THIS ENTIRELY
│   │   ├── layout.tsx                     # Super-admin shell + nav
│   │   ├── page.tsx                       # Platform overview dashboard
│   │   │
│   │   ├── tenants/
│   │   │   ├── page.tsx                   # All tenants table
│   │   │   └── [tenantId]/
│   │   │       ├── page.tsx               # Tenant detail
│   │   │       ├── invoices/page.tsx      # Read-only invoice view
│   │   │       ├── subscription/page.tsx  # Change plan, billing
│   │   │       └── impersonate/page.tsx   # Impersonation redirect
│   │   │
│   │   ├── subscriptions/
│   │   │   ├── page.tsx                   # All plans list
│   │   │   ├── new/page.tsx               # Create plan
│   │   │   └── [planId]/
│   │   │       ├── page.tsx               # Edit plan
│   │   │       └── features/page.tsx      # Feature limits editor
│   │   │
│   │   ├── hs-codes/
│   │   │   ├── page.tsx                   # HS Code library browser
│   │   │   ├── new/page.tsx               # Add HS code
│   │   │   ├── import/page.tsx            # Bulk CSV import
│   │   │   └── [hsCodeId]/page.tsx        # Edit HS code
│   │   │
│   │   ├── billing/
│   │   │   ├── page.tsx                   # Platform billing overview
│   │   │   ├── invoices/page.tsx          # All tenant billing invoices
│   │   │   └── payouts/page.tsx           # Revenue summary
│   │   │
│   │   ├── fbr-health/
│   │   │   ├── page.tsx                   # Cross-tenant FBR status
│   │   │   └── logs/page.tsx              # Submission logs viewer
│   │   │
│   │   ├── feature-flags/page.tsx         # Global + per-tenant flags
│   │   ├── announcements/page.tsx         # Platform-wide notices
│   │   └── audit-log/page.tsx             # All admin actions
│   │
│   └── api/
│       └── admin/                         ← ALL SUPER-ADMIN API ROUTES
│           ├── tenants/
│           │   ├── route.ts               # GET list, POST create
│           │   └── [tenantId]/
│           │       ├── route.ts           # GET, PATCH, DELETE
│           │       ├── suspend/route.ts
│           │       ├── activate/route.ts
│           │       ├── impersonate/route.ts
│           │       └── subscription/route.ts
│           ├── subscriptions/
│           │   ├── route.ts               # CRUD plans
│           │   └── [planId]/route.ts
│           ├── hs-codes/
│           │   ├── route.ts               # CRUD + search
│           │   ├── [hsCodeId]/route.ts
│           │   └── import/route.ts        # Bulk import
│           ├── feature-flags/route.ts
│           ├── analytics/
│           │   ├── mrr/route.ts
│           │   ├── tenants/route.ts
│           │   └── fbr-health/route.ts
│           └── audit/route.ts
```

---

## 2. Full Database Schema Additions

```prisma
// ─── SUBSCRIPTION PLANS ───────────────────────────────────────────────────────

model SubscriptionPlan {
  id            String    @id @default(cuid())
  name          String    @unique       // "Free", "Starter", "Pro", "Enterprise"
  slug          String    @unique       // "free", "starter", "pro", "enterprise"
  description   String
  isActive      Boolean   @default(true)
  isPublic      Boolean   @default(true)   // false = hidden (internal/custom plans)
  sortOrder     Int       @default(0)      // Display order on pricing page
  trialDays     Int       @default(0)

  // Pricing
  priceMonthly  Decimal   @db.Decimal(10, 2)  // PKR per month
  priceYearly   Decimal   @db.Decimal(10, 2)  // PKR per year (discounted)
  currency      String    @default("PKR")

  // Feature Limits (null = unlimited)
  maxPosTerminals   Int?       // Max POS terminals allowed
  maxUsers          Int?       // Max staff accounts
  maxProducts       Int?       // Max products in catalogue
  maxInvoicesMonth  Int?       // Monthly invoice cap
  maxHsCodesAccess  Int?       // How many HS codes they can map
  dataRetentionDays Int        @default(365)  // Invoice history retention

  // Feature Flags on the plan level
  features      PlanFeature[]

  // Relations
  tenantSubscriptions TenantSubscription[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model PlanFeature {
  id       String           @id @default(cuid())
  plan     SubscriptionPlan @relation(fields: [planId], references: [id])
  planId   String
  key      String           // e.g. "multi_pos", "advanced_reports", "api_access"
  value    String           // "true", "false", or a numeric string
  label    String           // Human-readable: "Multiple POS Terminals"

  @@unique([planId, key])
}

// Active subscription per tenant
model TenantSubscription {
  id              String           @id @default(cuid())
  tenant          Tenant           @relation(fields: [tenantId], references: [id])
  tenantId        String           @unique
  plan            SubscriptionPlan @relation(fields: [planId], references: [id])
  planId          String

  status          SubStatus        @default(TRIALING)
  billingCycle    BillingCycle     @default(MONTHLY)

  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  trialEndsAt        DateTime?
  cancelledAt        DateTime?
  cancelAtPeriodEnd  Boolean      @default(false)

  // Stripe integration (optional)
  stripeCustomerId     String?
  stripeSubscriptionId String?

  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  billingHistory  BillingRecord[]
}

model BillingRecord {
  id               String             @id @default(cuid())
  subscription     TenantSubscription @relation(fields: [subscriptionId], references: [id])
  subscriptionId   String
  tenantId         String             // Denormalized for easy querying

  amount           Decimal            @db.Decimal(10, 2)
  currency         String             @default("PKR")
  status           BillingStatus      @default(PENDING)
  description      String
  periodStart      DateTime
  periodEnd        DateTime

  // Payment details
  paidAt           DateTime?
  paymentMethod    String?            // "bank_transfer", "card", "easypaisa"
  paymentRef       String?            // Bank transaction ref

  // Stripe
  stripeInvoiceId  String?
  stripePaymentIntentId String?

  invoicePdfUrl    String?
  createdAt        DateTime           @default(now())

  @@index([tenantId])
}

// ─── HS CODE MASTER LIBRARY ───────────────────────────────────────────────────

model HSCode {
  id            String    @id @default(cuid())
  code          String    @unique     // e.g. "8471.30" or "84713000"
  description   String                // Official FBR description
  shortName     String?               // Friendly name for UI
  category      String                // Top-level category e.g. "Electronics"
  subCategory   String?               // Sub-category
  unit          String    @default("PCS")  // Default unit of measure
  defaultTaxRate Decimal  @db.Decimal(5,2) // Default GST rate (e.g. 17.00)
  isFBRActive   Boolean   @default(true)   // If FBR still accepts this code
  notes         String?               // Compliance notes
  effectiveFrom DateTime?
  effectiveTo   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Tenants who have mapped this HS code to their products
  productMappings ProductHSCode[]

  @@index([code])
  @@index([category])
}

// Junction: tenant product ↔ HS code (tenant can override defaults)
model ProductHSCode {
  id          String   @id @default(cuid())
  product     Product  @relation(fields: [productId], references: [id])
  productId   String   @unique
  hsCode      HSCode   @relation(fields: [hsCodeId], references: [id])
  hsCodeId    String
  tenantId    String   // Denormalized for RLS
  taxRate     Decimal  @db.Decimal(5,2)  // Tenant can override default tax rate
  createdAt   DateTime @default(now())

  @@index([tenantId])
}

// ─── FEATURE FLAGS ────────────────────────────────────────────────────────────

model FeatureFlag {
  id          String    @id @default(cuid())
  key         String    @unique    // e.g. "new_dashboard_ui", "beta_reports"
  description String
  isGlobal    Boolean   @default(false)  // true = on for everyone
  isActive    Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Per-tenant overrides
  tenantOverrides TenantFeatureFlag[]
}

model TenantFeatureFlag {
  id        String      @id @default(cuid())
  flag      FeatureFlag @relation(fields: [flagId], references: [id])
  flagId    String
  tenantId  String
  enabled   Boolean
  createdAt DateTime    @default(now())

  @@unique([flagId, tenantId])
  @@index([tenantId])
}

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String   // userId who performed the action
  actorEmail String
  actorRole  String   // "SUPER_ADMIN", "TENANT_ADMIN", etc.
  tenantId   String?  // Affected tenant (null = platform-level action)
  action     String   // e.g. "TENANT_SUSPENDED", "PLAN_CHANGED", "IMPERSONATION_START"
  entity     String?  // e.g. "Tenant", "SubscriptionPlan", "HSCode"
  entityId   String?
  before     Json?    // State before change
  after      Json?    // State after change
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())

  @@index([tenantId])
  @@index([actorId])
  @@index([action])
  @@index([createdAt])
}

// ─── PLATFORM ANNOUNCEMENTS ───────────────────────────────────────────────────

model Announcement {
  id          String            @id @default(cuid())
  title       String
  body        String            @db.Text
  type        AnnouncementType  @default(INFO)
  targetPlans String[]          // [] = all plans, or ["pro","enterprise"]
  startsAt    DateTime
  endsAt      DateTime?
  isDismissable Boolean         @default(true)
  createdAt   DateTime          @default(now())
}

// ─── UPDATED TENANT MODEL (add relations) ────────────────────────────────────

// Add to existing Tenant model:
// subscription     TenantSubscription?
// featureFlags     TenantFeatureFlag[]
// billingRecords   BillingRecord[]      (via subscriptionId)

// ─── ENUMS ────────────────────────────────────────────────────────────────────

enum SubStatus     { TRIALING ACTIVE PAST_DUE SUSPENDED CANCELLED }
enum BillingCycle  { MONTHLY YEARLY }
enum BillingStatus { PENDING PAID FAILED REFUNDED WAIVED }
enum AnnouncementType { INFO WARNING MAINTENANCE FEATURE }
```

---

## 3. Subscription Plan Management

### 3.1 Plan Schema (Zod)

```typescript
// lib/admin/subscription.schema.ts
import { z } from 'zod'

export const PlanFeatureKeys = z.enum([
  'multi_pos',           // Multiple POS terminals
  'advanced_reports',    // Analytics & export
  'api_access',          // REST API access
  'custom_branding',     // Logo on receipts
  'email_invoices',      // Auto-email invoices to buyers
  'bulk_import',         // CSV product import
  'priority_support',    // SLA-backed support
  'white_label',         // Remove platform branding
  'multi_branch',        // Multiple business locations
  'accountant_access',   // Read-only accountant role
])

export const CreatePlanSchema = z.object({
  name:             z.string().min(2).max(50),
  slug:             z.string().regex(/^[a-z0-9-]+$/),
  description:      z.string().max(500),
  isActive:         z.boolean().default(true),
  isPublic:         z.boolean().default(true),
  sortOrder:        z.number().int().default(0),
  trialDays:        z.number().int().min(0).max(90).default(0),
  priceMonthly:     z.number().min(0),
  priceYearly:      z.number().min(0),
  currency:         z.string().default('PKR'),

  // Limits — null means unlimited
  maxPosTerminals:   z.number().int().positive().nullable(),
  maxUsers:          z.number().int().positive().nullable(),
  maxProducts:       z.number().int().positive().nullable(),
  maxInvoicesMonth:  z.number().int().positive().nullable(),
  maxHsCodesAccess:  z.number().int().positive().nullable(),
  dataRetentionDays: z.number().int().min(30).default(365),

  features: z.array(z.object({
    key:   PlanFeatureKeys,
    value: z.string(),
    label: z.string(),
  })),
})

export type CreatePlanInput = z.infer<typeof CreatePlanSchema>
```

### 3.2 Plan CRUD API Routes

```typescript
// app/api/admin/subscriptions/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { CreatePlanSchema } from '@/lib/admin/subscription.schema'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/admin/audit'

// GET /api/admin/subscriptions — list all plans
export async function GET(req: NextRequest) {
  await assertSuperAdmin(req)

  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      features: true,
      _count: { select: { tenantSubscriptions: true } },
    },
  })

  return NextResponse.json(plans)
}

// POST /api/admin/subscriptions — create plan
export async function POST(req: NextRequest) {
  const { actor } = await assertSuperAdmin(req)
  const body = CreatePlanSchema.parse(await req.json())

  const { features, ...planData } = body

  const plan = await prisma.subscriptionPlan.create({
    data: {
      ...planData,
      features: { create: features },
    },
    include: { features: true },
  })

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: 'SUPER_ADMIN',
    action: 'PLAN_CREATED',
    entity: 'SubscriptionPlan',
    entityId: plan.id,
    after: plan,
  })

  return NextResponse.json(plan, { status: 201 })
}
```

```typescript
// app/api/admin/subscriptions/[planId]/route.ts

// PATCH — update plan (does NOT affect existing subscribers immediately)
export async function PATCH(req: NextRequest, { params }: { params: { planId: string } }) {
  const { actor } = await assertSuperAdmin(req)
  const body = CreatePlanSchema.partial().parse(await req.json())

  const before = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { id: params.planId },
    include: { features: true },
  })

  const { features, ...planData } = body

  const updated = await prisma.$transaction(async (tx) => {
    const plan = await tx.subscriptionPlan.update({
      where: { id: params.planId },
      data: planData,
    })

    if (features) {
      // Replace all features
      await tx.planFeature.deleteMany({ where: { planId: params.planId } })
      await tx.planFeature.createMany({
        data: features.map(f => ({ ...f, planId: params.planId })),
      })
    }

    return plan
  })

  await writeAuditLog({
    actorId: actor.id, actorEmail: actor.email, actorRole: 'SUPER_ADMIN',
    action: 'PLAN_UPDATED', entity: 'SubscriptionPlan',
    entityId: params.planId, before, after: updated,
  })

  return NextResponse.json(updated)
}

// DELETE — soft delete (deactivate, keep for existing subscribers)
export async function DELETE(req: NextRequest, { params }: { params: { planId: string } }) {
  const { actor } = await assertSuperAdmin(req)

  const activeCount = await prisma.tenantSubscription.count({
    where: { planId: params.planId, status: { in: ['ACTIVE', 'TRIALING'] } },
  })

  if (activeCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${activeCount} active tenant(s) on this plan. Deactivate instead.` },
      { status: 422 }
    )
  }

  await prisma.subscriptionPlan.update({
    where: { id: params.planId },
    data: { isActive: false, isPublic: false },
  })

  await writeAuditLog({
    actorId: actor.id, actorEmail: actor.email, actorRole: 'SUPER_ADMIN',
    action: 'PLAN_DEACTIVATED', entity: 'SubscriptionPlan', entityId: params.planId,
  })

  return NextResponse.json({ success: true })
}
```

---

## 4. HS Code Master Library

### 4.1 HS Code Schema (Zod)

```typescript
// lib/admin/hscode.schema.ts
import { z } from 'zod'

export const HSCodeSchema = z.object({
  code:           z.string()
                   .regex(/^\d{4,10}(\.\d{2})?$/, 'Format: 8471.30 or 84713000'),
  description:    z.string().min(5).max(500),
  shortName:      z.string().max(100).optional(),
  category:       z.string().min(2).max(100),
  subCategory:    z.string().max(100).optional(),
  unit:           z.enum(['PCS', 'KG', 'LTR', 'MTR', 'SQM', 'SET', 'PAIR', 'BOX', 'CTN', 'DZN']),
  defaultTaxRate: z.number().min(0).max(100),
  isFBRActive:    z.boolean().default(true),
  notes:          z.string().max(1000).optional(),
  effectiveFrom:  z.string().datetime().optional(),
  effectiveTo:    z.string().datetime().optional(),
})

export const HSCodeImportRowSchema = z.object({
  code:           z.string(),
  description:    z.string(),
  category:       z.string(),
  defaultTaxRate: z.coerce.number(),
  unit:           z.string().default('PCS'),
  shortName:      z.string().optional(),
})

export const HSCodeImportSchema = z.array(HSCodeImportRowSchema)
```

### 4.2 HS Code API Routes

```typescript
// app/api/admin/hs-codes/route.ts

// GET — search/list with filters
export async function GET(req: NextRequest) {
  await assertSuperAdmin(req)

  const { searchParams } = new URL(req.url)
  const q        = searchParams.get('q') ?? ''
  const category = searchParams.get('category')
  const page     = Number(searchParams.get('page') ?? 1)
  const limit    = Number(searchParams.get('limit') ?? 50)

  const where: Prisma.HSCodeWhereInput = {
    AND: [
      q ? {
        OR: [
          { code:        { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { shortName:   { contains: q, mode: 'insensitive' } },
        ]
      } : {},
      category ? { category } : {},
    ],
  }

  const [hsCodes, total, categories] = await Promise.all([
    prisma.hSCode.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { code: 'asc' },
    }),
    prisma.hSCode.count({ where }),
    prisma.hSCode.groupBy({
      by: ['category'],
      orderBy: { category: 'asc' },
    }),
  ])

  return NextResponse.json({
    data: hsCodes,
    total,
    page,
    pages: Math.ceil(total / limit),
    categories: categories.map(c => c.category),
  })
}

// POST — create single HS code
export async function POST(req: NextRequest) {
  const { actor } = await assertSuperAdmin(req)
  const body = HSCodeSchema.parse(await req.json())

  const hsCode = await prisma.hSCode.create({ data: body })

  await writeAuditLog({
    actorId: actor.id, actorEmail: actor.email, actorRole: 'SUPER_ADMIN',
    action: 'HSCODE_CREATED', entity: 'HSCode', entityId: hsCode.id, after: hsCode,
  })

  return NextResponse.json(hsCode, { status: 201 })
}
```

```typescript
// app/api/admin/hs-codes/import/route.ts
// Bulk CSV import — accepts multipart/form-data

import { parse } from 'csv-parse/sync'

export async function POST(req: NextRequest) {
  const { actor } = await assertSuperAdmin(req)
  const formData = await req.formData()
  const file = formData.get('file') as File

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const text = await file.text()
  const rows = parse(text, { columns: true, skip_empty_lines: true, trim: true })

  const parsed = HSCodeImportSchema.safeParse(rows)
  if (!parsed.success) {
    return NextResponse.json({
      error: 'CSV validation failed',
      details: parsed.error.errors.slice(0, 10),
    }, { status: 422 })
  }

  // Upsert all rows — update existing codes, insert new ones
  const results = await prisma.$transaction(
    parsed.data.map(row =>
      prisma.hSCode.upsert({
        where: { code: row.code },
        create: row,
        update: {
          description:    row.description,
          category:       row.category,
          defaultTaxRate: row.defaultTaxRate,
          unit:           row.unit as any,
        },
      })
    )
  )

  await writeAuditLog({
    actorId: actor.id, actorEmail: actor.email, actorRole: 'SUPER_ADMIN',
    action: 'HSCODE_BULK_IMPORT',
    after: { count: results.length },
  })

  return NextResponse.json({
    success: true,
    imported: results.length,
  })
}
```

### 4.3 Tenant-side HS Code Lookup (read-only)

```typescript
// app/api/hs-codes/search/route.ts
// Tenants can search the platform HS code library (read-only)

export async function GET(req: NextRequest) {
  const { tenant } = await getTenantFromSession()

  // Check plan limit: how many HS codes can this tenant access?
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId: tenant.id },
    include: { plan: true },
  })

  const q = new URL(req.url).searchParams.get('q') ?? ''

  const hsCodes = await prisma.hSCode.findMany({
    where: {
      isFBRActive: true,
      OR: [
        { code: { contains: q } },
        { description: { contains: q, mode: 'insensitive' } },
        { shortName: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 20,
    select: {
      id: true, code: true, description: true,
      shortName: true, defaultTaxRate: true, unit: true,
      category: true,
    },
  })

  return NextResponse.json(hsCodes)
}
```

---

## 5. Tenant Management (Super Admin)

### 5.1 Tenant List & Search

```typescript
// app/api/admin/tenants/route.ts

export async function GET(req: NextRequest) {
  await assertSuperAdmin(req)
  const { searchParams } = new URL(req.url)

  const q       = searchParams.get('q') ?? ''
  const plan    = searchParams.get('plan')
  const status  = searchParams.get('status')    // 'ACTIVE','SUSPENDED', etc.
  const page    = Number(searchParams.get('page') ?? 1)
  const limit   = 25

  const tenants = await prisma.tenant.findMany({
    where: {
      AND: [
        q ? {
          OR: [
            { name:  { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { slug:  { contains: q, mode: 'insensitive' } },
          ]
        } : {},
        plan   ? { subscription: { plan: { slug: plan } } } : {},
        status ? { subscription: { status: status as any } } : {},
      ],
    },
    include: {
      subscription: { include: { plan: { select: { name: true, slug: true } } } },
      fbrCredentials: { select: { isVerified: true, lastUsedAt: true } },
      _count: { select: { invoices: true, users: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  })

  const total = await prisma.tenant.count()

  return NextResponse.json({ data: tenants, total, page, pages: Math.ceil(total / limit) })
}
```

### 5.2 Change Tenant Subscription

```typescript
// app/api/admin/tenants/[tenantId]/subscription/route.ts

export async function PATCH(req: NextRequest, { params }: { params: { tenantId: string } }) {
  const { actor } = await assertSuperAdmin(req)

  const body = z.object({
    planId:          z.string(),
    billingCycle:    z.enum(['MONTHLY', 'YEARLY']).optional(),
    status:          z.enum(['ACTIVE', 'TRIALING', 'SUSPENDED', 'CANCELLED']).optional(),
    trialEndsAt:     z.string().datetime().optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
    reason:          z.string().optional(),   // Admin note
  }).parse(await req.json())

  const before = await prisma.tenantSubscription.findUniqueOrThrow({
    where: { tenantId: params.tenantId },
  })

  const updated = await prisma.tenantSubscription.update({
    where: { tenantId: params.tenantId },
    data: {
      planId:           body.planId,
      billingCycle:     body.billingCycle,
      status:           body.status,
      trialEndsAt:      body.trialEndsAt ? new Date(body.trialEndsAt) : undefined,
      cancelAtPeriodEnd: body.cancelAtPeriodEnd,
    },
    include: { plan: true },
  })

  await writeAuditLog({
    actorId: actor.id, actorEmail: actor.email, actorRole: 'SUPER_ADMIN',
    tenantId: params.tenantId,
    action: 'SUBSCRIPTION_CHANGED',
    entity: 'TenantSubscription',
    entityId: updated.id,
    before, after: updated,
  })

  // TODO: Send email to tenant admin about plan change
  return NextResponse.json(updated)
}
```

### 5.3 Suspend / Activate Tenant

```typescript
// app/api/admin/tenants/[tenantId]/suspend/route.ts

export async function POST(req: NextRequest, { params }: { params: { tenantId: string } }) {
  const { actor } = await assertSuperAdmin(req)
  const { reason } = z.object({ reason: z.string().min(5) }).parse(await req.json())

  await prisma.$transaction([
    prisma.tenant.update({
      where: { id: params.tenantId },
      data: { isActive: false },
    }),
    prisma.tenantSubscription.update({
      where: { tenantId: params.tenantId },
      data: { status: 'SUSPENDED' },
    }),
  ])

  await writeAuditLog({
    actorId: actor.id, actorEmail: actor.email, actorRole: 'SUPER_ADMIN',
    tenantId: params.tenantId,
    action: 'TENANT_SUSPENDED',
    after: { reason },
  })

  // Send suspension email via Resend
  // await sendTenantSuspensionEmail(params.tenantId, reason)

  return NextResponse.json({ success: true })
}
```

### 5.4 Admin Impersonation

```typescript
// app/api/admin/tenants/[tenantId]/impersonate/route.ts
// Creates a short-lived impersonation token

import { SignJWT } from 'jose'

export async function POST(req: NextRequest, { params }: { params: { tenantId: string } }) {
  const { actor } = await assertSuperAdmin(req)

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: params.tenantId },
    include: { users: { where: { role: 'TENANT_ADMIN' }, take: 1 } },
  })

  const tenantAdmin = tenant.users[0]
  if (!tenantAdmin) {
    return NextResponse.json({ error: 'No admin user found for this tenant' }, { status: 404 })
  }

  // Create a short-lived JWT (15 minutes)
  const token = await new SignJWT({
    sub: tenantAdmin.id,
    tenantId: tenant.id,
    impersonatedBy: actor.id,
    isImpersonation: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(process.env.NEXTAUTH_SECRET!))

  await writeAuditLog({
    actorId: actor.id, actorEmail: actor.email, actorRole: 'SUPER_ADMIN',
    tenantId: params.tenantId,
    action: 'IMPERSONATION_START',
    after: { targetUserId: tenantAdmin.id },
  })

  // Return a redirect URL with the token as a query param
  // The tenant's /auth/impersonate?token=... route verifies and creates a session
  return NextResponse.json({
    redirectUrl: `/auth/impersonate?token=${token}`,
    expiresIn: '15 minutes',
  })
}
```

---

## 6. Feature Flags System

```typescript
// lib/features/flags.ts

import { prisma } from '@/lib/db/prisma'
import { cache } from 'react'   // Next.js request-level cache

// Check if a feature is enabled for a tenant
// Priority: TenantFeatureFlag override > PlanFeature > FeatureFlag global
export const isFeatureEnabled = cache(async (
  tenantId: string,
  flagKey: string
): Promise<boolean> => {
  // 1. Check per-tenant override
  const tenantOverride = await prisma.tenantFeatureFlag.findFirst({
    where: {
      tenantId,
      flag: { key: flagKey },
    },
    include: { flag: true },
  })

  if (tenantOverride) return tenantOverride.enabled

  // 2. Check plan feature
  const planFeature = await prisma.planFeature.findFirst({
    where: {
      key: flagKey,
      plan: { tenantSubscriptions: { some: { tenantId } } },
    },
  })

  if (planFeature) return planFeature.value === 'true'

  // 3. Check global flag
  const globalFlag = await prisma.featureFlag.findUnique({
    where: { key: flagKey },
  })

  return globalFlag?.isGlobal ?? false
})

// Check plan limits
export const checkPlanLimit = cache(async (
  tenantId: string,
  limitKey: keyof SubscriptionPlan
): Promise<{ allowed: boolean; current: number; max: number | null }> => {
  const sub = await prisma.tenantSubscription.findUniqueOrThrow({
    where: { tenantId },
    include: { plan: true },
  })

  const max = sub.plan[limitKey] as number | null

  // Count current usage
  const current = await getUsageCount(tenantId, limitKey)

  return {
    allowed: max === null || current < max,
    current,
    max,
  }
})

async function getUsageCount(tenantId: string, limitKey: string): Promise<number> {
  switch (limitKey) {
    case 'maxPosTerminals':
      return prisma.pOSTerminal.count({ where: { tenantId, isActive: true } })
    case 'maxUsers':
      return prisma.user.count({ where: { tenantId, isActive: true } })
    case 'maxProducts':
      return prisma.product.count({ where: { tenantId, isActive: true } })
    case 'maxInvoicesMonth': {
      const start = new Date(); start.setDate(1); start.setHours(0,0,0,0)
      return prisma.invoice.count({
        where: { tenantId, createdAt: { gte: start } }
      })
    }
    default: return 0
  }
}
```

### Usage in API routes

```typescript
// Before allowing a tenant to add a new POS terminal:
const limit = await checkPlanLimit(tenant.id, 'maxPosTerminals')
if (!limit.allowed) {
  return NextResponse.json({
    error: `Your plan allows ${limit.max} POS terminal(s). You have ${limit.current}. Upgrade to add more.`,
    upgradeRequired: true,
  }, { status: 403 })
}

// Before showing advanced reports:
const canUseReports = await isFeatureEnabled(tenant.id, 'advanced_reports')
if (!canUseReports) {
  return NextResponse.json({ error: 'Upgrade to Pro for advanced reports.', upgradeRequired: true }, { status: 403 })
}
```

---

## 7. Platform Analytics (Super Admin Dashboard)

```typescript
// app/api/admin/analytics/mrr/route.ts

export async function GET(req: NextRequest) {
  await assertSuperAdmin(req)

  const now = new Date()
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const [
    activeSubscriptions,
    mrrByPlan,
    newTenantsThisMonth,
    churnedThisMonth,
    totalInvoicesAllTenants,
    fbrQueueStats,
  ] = await Promise.all([
    // Active subs
    prisma.tenantSubscription.count({
      where: { status: { in: ['ACTIVE', 'TRIALING'] } }
    }),

    // MRR grouped by plan
    prisma.tenantSubscription.groupBy({
      by: ['planId'],
      where: { status: 'ACTIVE' },
      _count: { planId: true },
    }),

    // New tenants this month
    prisma.tenant.count({
      where: { createdAt: { gte: thisMonth } }
    }),

    // Churned this month
    prisma.tenantSubscription.count({
      where: {
        status: 'CANCELLED',
        cancelledAt: { gte: lastMonth, lt: thisMonth },
      }
    }),

    // Total invoices submitted to FBR platform-wide (today)
    prisma.invoice.count({
      where: {
        submittedToFbr: true,
        createdAt: { gte: new Date(now.setHours(0,0,0,0)) },
      }
    }),

    // Queue stats from Redis/BullMQ
    fbrQueue.getJobCounts('waiting', 'active', 'failed', 'delayed'),
  ])

  // Calculate MRR — join with plan prices
  const plans = await prisma.subscriptionPlan.findMany()
  const planMap = Object.fromEntries(plans.map(p => [p.id, p]))

  const mrr = mrrByPlan.reduce((sum, row) => {
    const plan = planMap[row.planId]
    return sum + (plan ? Number(plan.priceMonthly) * row._count.planId : 0)
  }, 0)

  return NextResponse.json({
    mrr,
    activeSubscriptions,
    newTenantsThisMonth,
    churnedThisMonth,
    totalInvoicesToday: totalInvoicesAllTenants,
    fbrQueue: fbrQueueStats,
    breakdown: mrrByPlan.map(row => ({
      plan: planMap[row.planId]?.name,
      tenants: row._count.planId,
      contribution: Number(planMap[row.planId]?.priceMonthly ?? 0) * row._count.planId,
    })),
  })
}
```

---

## 8. Super Admin Layout & Navigation

```tsx
// app/(super-admin)/layout.tsx

import { assertSuperAdmin } from '@/lib/admin/guard'
import { redirect } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/super-admin',                  icon: '📊', label: 'Overview' },
  { href: '/super-admin/tenants',          icon: '🏢', label: 'Tenants' },
  { href: '/super-admin/subscriptions',    icon: '💳', label: 'Plans & Billing' },
  { href: '/super-admin/hs-codes',         icon: '🔢', label: 'HS Code Library' },
  { href: '/super-admin/feature-flags',    icon: '🚩', label: 'Feature Flags' },
  { href: '/super-admin/fbr-health',       icon: '📡', label: 'FBR Health' },
  { href: '/super-admin/announcements',    icon: '📢', label: 'Announcements' },
  { href: '/super-admin/audit-log',        icon: '🔍', label: 'Audit Log' },
]

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side guard — throws if not super admin
  const session = await auth()
  if (session?.user?.role !== 'SUPER_ADMIN') redirect('/dashboard')

  return (
    <div className="flex h-screen bg-slate-950 text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Super Admin
          </div>
          <div className="text-sm font-semibold text-white mt-1">
            Platform Control
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <AdminNavLink key={item.href} {...item} />
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <div className="text-xs text-slate-500">{session.user.email}</div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
```

---

## 9. Super Admin Dashboard Page (Overview)

```tsx
// app/(super-admin)/page.tsx  — key metrics

// Sections to render:
// ┌────────────────────────────────────────────────────────┐
// │  PLATFORM OVERVIEW                                      │
// ├──────────┬──────────┬──────────┬──────────┬────────────┤
// │  MRR     │ Active   │ New      │ Churned  │ Invoices   │
// │ PKR 450K │ Tenants  │ (month)  │ (month)  │ Today      │
// │          │   142    │   +18    │   -3     │   3,241    │
// ├──────────┴──────────┴──────────┴──────────┴────────────┤
// │  FBR PLATFORM HEALTH                                    │
// │  [Online: 138] [Circuit Open: 2] [Queued: 47]          │
// ├──────────────────────────────────────────────────────── ┤
// │  PLAN BREAKDOWN         │  RECENT SIGNUPS              │
// │  Free:       48         │  • Acme Traders (Pro)        │
// │  Starter:    61         │  • Khan Electronics (Free)   │
// │  Pro:        28         │  • ...                       │
// │  Enterprise:  5         │                              │
// ├─────────────────────────┴──────────────────────────────┤
// │  PENDING ACTIONS                                        │
// │  [12 invoices failed FBR] [3 tenants past due]         │
// └────────────────────────────────────────────────────────┘
```

---

## 10. Subscription Plan UI (Admin)

### Plan List Page

```
/super-admin/subscriptions
─────────────────────────────────────────────────────────
[+ Create Plan]                              [Search plans]

NAME        PRICE/mo  TENANTS  STATUS    ACTIONS
Free        PKR 0       48     Active    [Edit] [View]
Starter     PKR 2,500   61     Active    [Edit] [View]
Pro         PKR 6,500   28     Active    [Edit] [View]
Enterprise  PKR 15,000   5     Active    [Edit] [View]
Legacy-2023 PKR 1,500    2    Inactive   [View]
```

### Plan Detail / Edit Page

```
/super-admin/subscriptions/[planId]

PLAN SETTINGS
─────────────────────────────────────────
Name:          [Pro                    ]
Slug:          [pro                    ]
Monthly Price: [PKR  6,500             ]
Yearly Price:  [PKR 65,000             ]
Trial Days:    [14                     ]
Visible:       [✓ Show on pricing page ]

LIMITS
─────────────────────────────────────────
POS Terminals:    [  5  ]   (blank = unlimited)
Staff Users:      [ 20  ]
Products:         [500  ]
Invoices/Month:   [blank]   ← unlimited
HS Code Access:   [blank]   ← unlimited
Data Retention:   [ 730 ] days

FEATURES INCLUDED
─────────────────────────────────────────
[✓] Multiple POS Terminals
[✓] Advanced Reports & Export
[✓] API Access
[✓] Custom Receipt Branding
[✓] Auto Email Invoices to Buyers
[✓] Bulk Product CSV Import
[✓] Priority Support
[ ] White Label
[ ] Accountant Read-Only Access

[Save Changes]   [Cancel]
```

---

## 11. HS Code Library UI (Admin)

```
/super-admin/hs-codes
─────────────────────────────────────────────────────────
[+ Add HS Code]   [📥 Import CSV]             [Search...]
Filter: [All Categories ▾]  [Active Only ✓]

HS CODE     DESCRIPTION              CAT.        TAX%  UNIT   STATUS
8471.30     Portable computers       Electronics  17%   PCS    ✓ Active
8517.12     Mobile phones            Electronics  17%   PCS    ✓ Active
2710.19     Petroleum oils           Energy        0%   LTR    ✓ Active
6104.43     Dresses, knitted         Textiles     17%   PCS    ✓ Active
...

Showing 1-50 of 6,842 HS Codes   [< 1 2 3 ... 137 >]
```

### CSV Import Format

```csv
code,description,category,subCategory,defaultTaxRate,unit,shortName
8471.30,Portable automatic data processing machines,Electronics,Computers,17,PCS,Laptops
8517.12,Telephones for cellular networks,Electronics,Phones,17,PCS,Mobile Phones
2710.19,Other petroleum oils and preparations,Energy,Fuel,0,LTR,Petrol/Diesel
```

---

## 12. Super Admin Guard

```typescript
// lib/admin/guard.ts

import { auth } from '@/lib/auth'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from './audit'

export async function assertSuperAdmin(req: NextRequest) {
  const session = await auth()

  if (!session?.user) {
    throw new Response('Unauthorized', { status: 401 })
  }

  if (session.user.role !== 'SUPER_ADMIN') {
    // Log unauthorized access attempt
    await writeAuditLog({
      actorId:    session.user.id,
      actorEmail: session.user.email ?? '',
      actorRole:  session.user.role,
      action:     'UNAUTHORIZED_ADMIN_ACCESS',
      after:      { path: req.nextUrl.pathname },
    })
    throw new Response('Forbidden', { status: 403 })
  }

  return { actor: session.user }
}
```

---

## 13. Audit Log

```typescript
// lib/admin/audit.ts

import { prisma } from '@/lib/db/prisma'
import { headers } from 'next/headers'

interface AuditEntry {
  actorId:    string
  actorEmail: string
  actorRole:  string
  tenantId?:  string
  action:     string
  entity?:    string
  entityId?:  string
  before?:    object
  after?:     object
}

export async function writeAuditLog(entry: AuditEntry) {
  const h = headers()
  await prisma.auditLog.create({
    data: {
      ...entry,
      ipAddress: h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? undefined,
      userAgent: h.get('user-agent') ?? undefined,
    },
  }).catch(console.error)  // Never throw — audit failures must not break requests
}
```

---

## 14. Billing Records API

```typescript
// app/api/admin/billing/route.ts

// POST — Record a manual payment from a tenant
export async function POST(req: NextRequest) {
  const { actor } = await assertSuperAdmin(req)

  const body = z.object({
    tenantId:      z.string(),
    amount:        z.number().positive(),
    description:   z.string(),
    periodStart:   z.string().datetime(),
    periodEnd:     z.string().datetime(),
    paymentMethod: z.string(),
    paymentRef:    z.string().optional(),
  }).parse(await req.json())

  const sub = await prisma.tenantSubscription.findUniqueOrThrow({
    where: { tenantId: body.tenantId },
  })

  const record = await prisma.billingRecord.create({
    data: {
      subscriptionId: sub.id,
      tenantId: body.tenantId,
      amount: body.amount,
      currency: 'PKR',
      status: 'PAID',
      paidAt: new Date(),
      description: body.description,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
      paymentMethod: body.paymentMethod,
      paymentRef: body.paymentRef,
    },
  })

  await writeAuditLog({
    actorId: actor.id, actorEmail: actor.email, actorRole: 'SUPER_ADMIN',
    tenantId: body.tenantId,
    action: 'BILLING_RECORD_ADDED',
    entityId: record.id,
    after: record,
  })

  return NextResponse.json(record, { status: 201 })
}
```

---

## 15. Tenant-Side Subscription Page

```tsx
// app/(tenant)/settings/subscription/page.tsx
// What the tenant sees: their current plan, usage, upgrade options

// Sections:
// 1. Current Plan Summary
//    - Plan name, price, renewal date
//    - "Cancel" or "Change Plan" buttons
//
// 2. Usage This Month
//    - POS Terminals:    2 / 5
//    - Staff Users:      4 / 20
//    - Products:        122 / 500
//    - Invoices:        841 / unlimited
//
// 3. Available Plans (upgrade path)
//    - Pricing cards for each public plan
//    - Highlight current plan, CTA for others
//
// 4. Billing History
//    - Table of past payments with download PDF links
```

---

## 16. Environment Variables (additions)

```bash
# Stripe (for automated billing)
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_FREE_PRICE_ID=""
STRIPE_STARTER_PRICE_ID="price_..."
STRIPE_PRO_PRICE_ID="price_..."
STRIPE_ENTERPRISE_PRICE_ID="price_..."

# Impersonation JWT
IMPERSONATION_TOKEN_SECRET="separate-secret-for-impersonation"

# Email (Resend)
RESEND_API_KEY="re_..."
ADMIN_ALERT_EMAIL="admin@yourplatform.com"
```

---

## 17. AI Agent Implementation Rules (additions to v2.0)

**Subscription Enforcement:**
1. Every API route that creates a resource (POS terminal, product, user, invoice) must call `checkPlanLimit()` first and return a `403` with `upgradeRequired: true` if over limit.
2. On plan downgrade, do not delete data — instead set `isActive: false` on resources that exceed the new plan's limits and inform the tenant.
3. `SUPER_ADMIN` role bypasses all plan limits (for testing and support).

**HS Code Management:**
4. The HS code library is platform-managed (super admin only). Tenants can only READ from it, never write to it.
5. When a tenant maps a product to an HS code, create a `ProductHSCode` record — tenants can override `taxRate` but not the `code` or `description`.
6. HS code search is available to all tenants regardless of plan (it's a regulatory requirement).

**Subscription Changes:**
7. Plan upgrades take effect immediately. Plan downgrades take effect at the end of the current billing period (`cancelAtPeriodEnd` pattern).
8. Write a `BillingRecord` for every plan change (upgrade, downgrade, trial start).
9. When a tenant's subscription lapses to `PAST_DUE`, show a warning banner in their dashboard. Do not immediately suspend — give a 7-day grace period.

**Impersonation:**
10. Impersonation tokens expire in 15 minutes. Log `IMPERSONATION_START` and `IMPERSONATION_END` (when the token is used) to the audit log.
11. When impersonating, show a persistent yellow banner: "⚠️ You are viewing as [Business Name] — Admin session" that cannot be dismissed.
12. Impersonation creates a read-only session by default. Destructive actions (delete, suspend) must be re-confirmed with the super admin's own password.

**Audit Log:**
13. Every admin action (plan change, suspension, impersonation, HS code edit, credential reset) must write an audit log entry. Never skip this.
14. Audit log entries are immutable — no UPDATE or DELETE on `AuditLog` ever.

---

## 18. Super Admin Quick Reference

| Action | Route | Method |
|---|---|---|
| List all tenants | `/api/admin/tenants` | GET |
| View tenant detail | `/api/admin/tenants/:id` | GET |
| Change tenant plan | `/api/admin/tenants/:id/subscription` | PATCH |
| Suspend tenant | `/api/admin/tenants/:id/suspend` | POST |
| Activate tenant | `/api/admin/tenants/:id/activate` | POST |
| Impersonate | `/api/admin/tenants/:id/impersonate` | POST |
| List plans | `/api/admin/subscriptions` | GET |
| Create plan | `/api/admin/subscriptions` | POST |
| Edit plan | `/api/admin/subscriptions/:id` | PATCH |
| List HS codes | `/api/admin/hs-codes` | GET |
| Add HS code | `/api/admin/hs-codes` | POST |
| Edit HS code | `/api/admin/hs-codes/:id` | PATCH |
| Import HS codes | `/api/admin/hs-codes/import` | POST |
| List feature flags | `/api/admin/feature-flags` | GET |
| Toggle flag | `/api/admin/feature-flags/:key` | PATCH |
| Platform MRR stats | `/api/admin/analytics/mrr` | GET |
| Add billing record | `/api/admin/billing` | POST |
| View audit log | `/api/admin/audit` | GET |

---

*Document version 3.0 — Super Admin + Subscription Management + HS Code Library*
*Builds on v2.0 (multi-tenant FBR POS). All three documents together form the complete system.*
