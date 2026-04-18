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
