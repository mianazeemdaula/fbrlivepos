# 🧾 FBR Digital Advising — Next.js Landing Page Skill

> **Purpose:** Complete instruction set for building a world-class, animated Next.js multi-page website for an FBR Digital Tax Advising SaaS. Outperforms competitors like `cha-cha tax.com`, `e-invoicing.pk`, `fbreinvoicing.com`, and `digitalinvoicingforfbr.com` through superior UI/UX, animation, and conversion design.

---

## 📌 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Competitive Intelligence](#2-competitive-intelligence)
3. [Tech Stack](#3-tech-stack)
4. [Design System](#4-design-system)
5. [Site Architecture & Pages](#5-site-architecture--pages)
6. [Component Blueprints](#6-component-blueprints)
7. [Animation System](#7-animation-system)
8. [Pricing & Packages Schema](#8-pricing--packages-schema)
9. [Auth Pages — Sign Up & Sign In](#9-auth-pages--sign-up--sign-in)
10. [SEO & Performance](#10-seo--performance)
11. [Copy & Messaging Strategy](#11-copy--messaging-strategy)
12. [Step-by-Step Build Order](#12-step-by-step-build-order)

---

## 1. Project Overview

Build a **Next.js 14 (App Router)** marketing + auth website for a Pakistan-based FBR Digital Invoicing & Tax Advisory SaaS. The goal is to:

- Communicate **trust**, **compliance authority**, and **ease of use**
- Convert visitors into paying subscribers using tiered pricing
- Outshine competitors with **animated, premium UI** that feels like a global SaaS product, not a local IT vendor site
- Support **B2B businesses**, **tax consultants**, and **enterprise clients**

**Brand Personality:** Modern · Authoritative · Trustworthy · Distinctly Pakistani (flag colours, Urdu support option)

---

## 2. Competitive Intelligence

### Competitor Feature Matrix

| Feature | cha-cha tax | e-invoicing.pk | fbreinvoicing.com | invoicefbr.com | **Your App (Target)**|
|---|---|---|---|---|---|
| FBR DI API Integration | ✅ | ✅ | ✅ | ✅ | ✅ |
| Real-time IRN + USIN | ❓ | ✅ | ✅ | ✅ | ✅ |
| QR Code (v2.0, 300×300) | ❓ | ✅ | ✅ | ✅ | ✅ |
| AI Invoice Extraction | ❓ | ✅ | ❌ | ❌ | ✅ (LLM-powered) |
| Batch / CSV Upload | ❌ | ✅ | ❌ | ❌ | ✅ |
| Multi-Tenant (Tax Consultants) | ❌ | ✅ | ✅ | ❌ | ✅ |
| Multi-User RBAC | ❌ | ❌ | ✅ | ❌ | ✅ |
| Credit / Debit Notes | ❌ | ❌ | ✅ | ❌ | ✅ |
| WhatsApp Invoice Delivery | ❌ | ❌ | ❌ | ✅ | ✅ |
| Urdu Language Support | ❌ | ✅ | ❌ | ❌ | ✅ |
| ERP / QuickBooks Integration | ❌ | ✅ | ❌ | ❌ | ✅ |
| Sandbox → Production 1-Click | ❌ | ❌ | ✅ | ❌ | ✅ |
| Mobile Responsive Dashboard | ❌ | ❌ | ✅ | ✅ | ✅ |
| SRO 709 Compliance Badge | ❌ | ❌ | ✅ | ✅ | ✅ |
| Free Registration & Testing | ❌ | ❌ | ✅ | ✅ | ✅ |
| Tax Advisory / Consultant Chat | ❌ | ❌ | ❌ | ❌ | ✅ **(Differentiator)** |
| Penalty Risk Checker | ❌ | ❌ | ❌ | ❌ | ✅ **(Differentiator)** |
| Invoice Analytics Dashboard | ❌ | ❌ | ✅ | ❌ | ✅ |

### Competitor Weaknesses to Exploit

- **e-invoicing.pk**: Outdated design, no animations, confusing pricing page
- **fbreinvoicing.com**: Good feature set but generic SaaS look — no personality
- **invoicefbr.com**: Limited feature depth, no consultant tools
- **cha-cha tax**: Informal branding — lacks enterprise trust signals
- **All competitors**: No integrated tax advisory layer (consult + software in one)

### Your Unique Positioning

> *"Pakistan's only FBR Digital Invoicing platform that combines real-time e-invoicing software with on-demand tax advisory — so you stay compliant and informed, always."*

---

## 3. Tech Stack

```
Framework:       Next.js 14+ (App Router, TypeScript)
Styling:         Tailwind CSS v3 + custom CSS variables
Animation:       Framer Motion v11
Icons:           Lucide React
Fonts:           Google Fonts — Syne (display) + Plus Jakarta Sans (body)
Forms:           React Hook Form + Zod
Auth:            NextAuth.js v5 (or Clerk)
UI Components:   shadcn/ui (base components)
Charts:          Recharts (for pricing/stats)
Deployment:      Vercel
i18n:            next-intl (EN + UR)
```

---

## 4. Design System

### Color Palette

```css
:root {
  /* Brand */
  --color-primary:     #01411C;  /* Deep Pakistan Green */
  --color-primary-600: #016B30;
  --color-accent:      #C8A45A;  /* Gold — trust, authority */
  --color-accent-light:#F0D9A0;

  /* Neutrals */
  --color-bg:          #F7F6F2;  /* Warm off-white */
  --color-surface:     #FFFFFF;
  --color-border:      #E4E1D8;
  --color-text:        #1A1A18;
  --color-muted:       #6B6860;

  /* Status */
  --color-success:     #16A34A;
  --color-warning:     #D97706;
  --color-error:       #DC2626;

  /* Dark mode surface */
  --color-dark-bg:     #0D1A12;
  --color-dark-surface:#132018;
}
```

### Typography

```css
/* Display — Headings */
font-family: 'Syne', sans-serif;
/* Weights: 700, 800 for H1-H2; 600 for H3-H4 */

/* Body — All prose, labels, UI */
font-family: 'Plus Jakarta Sans', sans-serif;
/* Weights: 400 (body), 500 (labels), 600 (emphasis) */

/* Urdu fallback */
font-family: 'Noto Nastaliq Urdu', serif;
```

### Spacing Scale (Tailwind custom)

```js
// tailwind.config.ts
spacing: {
  '18': '4.5rem',
  '22': '5.5rem',
  '26': '6.5rem',
  '30': '7.5rem',
  '34': '8.5rem',
}
```

### Shadow & Depth

```css
--shadow-card:   0 2px 16px rgba(1, 65, 28, 0.08);
--shadow-hover:  0 8px 32px rgba(1, 65, 28, 0.16);
--shadow-modal:  0 24px 64px rgba(0, 0, 0, 0.20);
```

---

## 5. Site Architecture & Pages

```
/                     → Landing (Home)
/features             → Full Features Page
/pricing              → Pricing & Packages
/how-it-works         → Step-by-step guide + video
/for-consultants      → Dedicated Tax Consultant landing
/for-enterprise       → Enterprise solutions page
/integrations         → ERP / QuickBooks / API docs teaser
/about                → Company, team, FBR licensing status
/blog                 → Tax news, SRO updates, guides
/contact              → Sales + support form
/auth/signup          → Registration page
/auth/signin          → Login page
/auth/verify-email    → Email verification
/auth/forgot-password → Password reset
/dashboard            → (Protected) App dashboard
```

---

## 6. Component Blueprints

### 6.1 — Navbar (`/components/layout/Navbar.tsx`)

**Behaviour:**
- Transparent on hero, solid (white + shadow) on scroll (use `useScroll` from Framer Motion)
- Logo: brand mark (stylised invoice icon) + wordmark
- Links: Features · Pricing · How It Works · For Consultants
- CTA buttons: `Sign In` (ghost) + `Start Free` (filled, green)
- Mobile: hamburger → full-screen slide-down menu with staggered link reveal
- Language toggle: 🇬🇧 EN / 🇵🇰 UR

```tsx
// Scroll-aware background
const { scrollY } = useScroll();
const navBg = useTransform(scrollY, [0, 80], ['rgba(247,246,242,0)', 'rgba(247,246,242,1)']);
```

---

### 6.2 — Hero Section (`/components/sections/Hero.tsx`)

**Layout:** Full-viewport, centered, with layered background

**Background:**
- Dark green mesh gradient (`#01411C` → `#0D1A12`)
- Subtle topographic grid lines (SVG pattern, 5% opacity)
- Floating blurred green/gold orbs (CSS `backdrop-filter`)

**Content (staggered Framer Motion entrance):**
1. Compliance badge: `✦ SRO 709 · FBR DI API v1.12 Compliant` (pill, gold border)
2. H1: `Pakistan's Smartest FBR Digital Invoicing & Tax Advisory Platform`
3. Subtitle: One line value prop
4. CTA row: `[Start Free — No Credit Card] [Watch Demo ▶]`
5. Trust bar: `500+ Businesses · 99.8% FBR Approval Rate · <2s Response · 10,000+ Invoices`
6. Hero UI mockup: floating dashboard screenshot with animated invoice status badges

**Animation sequence (Framer Motion):**
```tsx
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } }
};
const item = {
  hidden: { opacity: 0, y: 30 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
};
```

---

### 6.3 — Compliance Urgency Banner (`/components/sections/ComplianceBanner.tsx`)

Sticky (below nav) or inline section. Amber/gold background.

```
⚠  FBR mandates digital invoicing under SRO 709(I)/2024.
   Non-compliance = STRN deactivation + PKR 500,000 fine.
   [Get Compliant Today →]
```

---

### 6.4 — Features Section (`/components/sections/Features.tsx`)

**Layout:** 3-column card grid (responsive → 1-col mobile)

**Animation:** Cards animate in on scroll with `whileInView` + stagger

**Feature Categories:**

#### ⚡ Core Invoicing
| Feature | Description |
|---|---|
| One-Click Invoice Generation | FBR-compliant B2B & B2C invoices with auto GST, FED, WHT |
| Real-Time FBR Submission | DI API integration → instant IRN, USIN approval via PRAL |
| QR Code Generation | FBR-spec v2.0, 300×300px scannable QR on every invoice |
| Credit & Debit Notes | Issue within 180-day FBR window, auto-tracked |
| Batch CSV/Excel Upload | Bulk-submit hundreds of invoices from a single spreadsheet |

#### 🤖 AI-Powered
| Feature | Description |
|---|---|
| Smart Invoice Extraction | LLM trained on 3,000+ invoice formats — upload PDF/image, auto-fill |
| Penalty Risk Checker | AI analyzes your STRN status, invoice gaps & flags risks |
| Tax Advisory Chat | Ask tax questions, get SRO-specific guidance from AI + human experts |

#### 👥 Team & Multi-Tenant
| Feature | Description |
|---|---|
| Multi-User RBAC | Admin / Accountant / Viewer roles with granular permissions |
| Multi-Tenant Dashboard | Manage 50+ clients from one panel (for tax consultants) |
| Audit Trail | Every action logged: user, timestamp, IP, before/after state |

#### 🔒 Security & Reliability
| Feature | Description |
|---|---|
| AES-256 Encryption | All invoice data encrypted at rest and in transit |
| Sandbox → Production | Test all FBR scenarios first; go live with one click |
| Retry & Idempotency | Failed submissions auto-retry; no duplicate invoices |
| 99.9% Uptime SLA | Enterprise-grade infrastructure on Vercel + AWS |

#### 📊 Reporting
| Feature | Description |
|---|---|
| Sales & Tax Analytics | Revenue trends, GST breakdown, submission logs, exportable |
| WhatsApp Delivery | Send invoices to buyers via WhatsApp instantly |
| ERP Integration | QuickBooks, IRIS Bridge, SAP adapter, REST API |
| Urdu Interface | Full Urdu language support for local teams |

---

### 6.5 — How It Works (`/components/sections/HowItWorks.tsx`)

4-step horizontal timeline on desktop, vertical on mobile.

```
STEP 1: Register Free
→ Sign up with NTN + STRN. Email verified in <2 min.

STEP 2: Test in Sandbox
→ Enter your PRAL token. Run all FBR DI scenarios. Zero cost.

STEP 3: Choose a Plan
→ Pick a package by invoice volume. Upgrade anytime.

STEP 4: Go Live
→ Create invoices. Submit to FBR. Get IRN + QR in <2 seconds.
```

**Animation:** Each step activates as user scrolls into view. Connecting line animates via `pathLength` SVG + Framer Motion.

---

### 6.6 — Pricing Section (`/components/sections/Pricing.tsx`)

See full schema in Section 8 below.

**UI Features:**
- Monthly / Annual toggle (annual = ~17% off, `Save PKR X/yr` badge)
- Highlighted "Most Popular" card (Package 3 / Growth)
- Animated plan cards on hover: subtle lift + shadow
- Tax Consultant special row below the grid
- Enterprise CTA: "Custom pricing — talk to sales"

---

### 6.7 — Social Proof (`/components/sections/Testimonials.tsx`)

**Layout:** Scrolling ticker row (logo marquee) + 3 testimonial cards

**Testimonials:**
1. *"Saved 15 hours/week. QR code feature alone improved buyer trust."* — CEO, Raza Trading Co., Karachi
2. *"Multi-user access is a game-changer. Accountants create, I review and submit."* — Finance Manager, Lahore
3. *"Managing 12 clients from one panel. Audit trail makes my CA firm incredibly efficient."* — Chartered Accountant, Islamabad
4. *"Best Urdu support we found. Our team was onboarded in one day."* — Operations Head, Faisalabad

---

### 6.8 — For Consultants CTA Section

Dedicated section (and `/for-consultants` page):

> **Are you a Tax Consultant or Accounting Firm?**
> Get exclusive multi-client dashboard access, volume discounts, white-label options, and a dedicated account manager.

CTA: `[Apply for Consultant Partner Program →]`

---

### 6.9 — Footer (`/components/layout/Footer.tsx`)

Columns:
- **Product**: Features · Pricing · How It Works · Integrations · API Docs
- **Solutions**: For Businesses · For Consultants · For Enterprise · For FMCG
- **Resources**: Blog · FBR Updates · SRO 709 Guide · Sandbox Docs
- **Company**: About · Careers · Contact · Privacy · Terms
- **Contact**: WhatsApp button · Email · Address (Islamabad/Karachi)

Bottom bar: `© 2025 [Brand]. Licensed FBR Digital Invoicing Integrator. SRO 709 Compliant.`

Social: LinkedIn · Twitter/X · YouTube (tutorial videos)

---

## 7. Animation System

Use **Framer Motion** throughout. Follow these patterns:

### Page Transitions
```tsx
// app/layout.tsx wrapper
<AnimatePresence mode="wait">
  <motion.main
    key={pathname}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -12 }}
    transition={{ duration: 0.35, ease: 'easeInOut' }}
  >
    {children}
  </motion.main>
</AnimatePresence>
```

### Scroll-Triggered Sections
```tsx
<motion.div
  initial={{ opacity: 0, y: 48 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-80px' }}
  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
>
```

### Staggered Card Grids
```tsx
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } }
};
const cardVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 24 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5 } }
};
```

### Counter Animations (trust stats)
```tsx
// Animate numbers from 0 to target when in view
// Use useMotionValue + useTransform or a custom hook
// "10,000+" invoices · "99.8%" approval · "500+" businesses
```

### Floating Hero UI Mock
```tsx
// Dashboard mockup floats and bobs
<motion.div
  animate={{ y: [0, -10, 0] }}
  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
>
  <DashboardMockup />
</motion.div>
```

### Pricing Card Hover
```tsx
<motion.div
  whileHover={{ y: -6, boxShadow: 'var(--shadow-hover)' }}
  transition={{ duration: 0.25 }}
>
```

---

## 8. Pricing & Packages Schema

### Package Structure (competitive & superior to e-invoicing.pk and fbreinvoicing.com)

```ts
type Package = {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number;   // PKR
  annualPrice: number;    // PKR/yr (≈17% discount)
  invoicesPerMonth: number | 'unlimited';
  users: number | 'unlimited';
  features: string[];
  highlight?: boolean;    // "Most Popular" badge
  badge?: string;         // e.g. "Best Value"
};
```

### Recommended Packages

| # | Name | Monthly (PKR) | Annual (PKR) | Invoices/mo | Users | Highlight |
|---|---|---|---|---|---|---|
| 1 | **Starter** | 2,500 | 25,000 | 25 | 2 | — |
| 2 | **Basic** | 4,500 | 45,000 | 50 | 3 | — |
| 3 | **Growth** | 7,500 | 75,000 | 100 | 5 | ⭐ Most Popular |
| 4 | **Professional** | 15,000 | 150,000 | 300 | 8 | Best Value |
| 5 | **Business** | 25,000 | 250,000 | 500 | 15 | — |
| 6 | **Scale** | 40,000 | 400,000 | 1,000 | 25 | — |
| 7 | **Enterprise** | Custom | Custom | Unlimited | Unlimited | — |
| — | **Non-Trading** | — | 20,000/yr | 12 total | 1 | Special |

### All Packages Include (no hidden fees)
- ✅ Full FBR DI API integration (sandbox + production)
- ✅ Free updates for every FBR API version change
- ✅ IRN, USIN, QR Code generation
- ✅ Credit / Debit notes (within 180-day window)
- ✅ 24/7 support in Urdu & English
- ✅ Onboarding + sandbox scenario clearance
- ✅ AES-256 data security
- ✅ Mobile-responsive web interface
- ✅ SRO 709 & Rule 150Q compliance
- ✅ No setup fee (competitive advantage over e-invoicing.pk's Rs. 15,000 setup)

### Growth+ Additional Features
- ✅ AI-powered smart invoice extraction (PDF/image upload)
- ✅ Batch CSV/Excel upload module
- ✅ Reports & analytics dashboard
- ✅ Multi-user RBAC
- ✅ WhatsApp invoice delivery

### Professional+ Additional Features
- ✅ Multi-tenant dashboard (manage multiple companies)
- ✅ Complete audit trail
- ✅ ERP / QuickBooks integration
- ✅ Penalty risk checker (AI)
- ✅ Tax advisory chat access
- ✅ Priority 6-hour SLA

### One-time Setup Fee
> **Rs. 0** — Unlike competitors charging Rs. 15,000 setup fees, you include full onboarding at no extra cost. Make this a conversion headline.

---

## 9. Auth Pages — Sign Up & Sign In

### Sign Up Page (`/auth/signup`)

**Layout:** Split screen — left: animated brand panel, right: form

**Left Panel (brand):**
- Dark green background (`#01411C`)
- Large quote or benefit: *"Join 500+ Pakistani businesses that invoice smarter"*
- Animated floating invoice card mockup
- Trust badges: FBR Licensed · SRO 709 · AES-256

**Right Panel (form):**
```
[Business Name]
[NTN Number]          [STRN Number]
[Full Name]
[Email Address]
[Phone (WhatsApp)]
[Password]            [Confirm Password]
[Business Type dropdown] — Manufacturer / Wholesaler / Retailer / Consultant / Other
[   Create Free Account   ]
Already have an account? Sign In
By registering you agree to our Terms and Privacy Policy.
```

**Validation (Zod):**
- NTN: 7-digit numeric
- STRN: alphanumeric, Pakistani format
- Password: min 8 chars, 1 uppercase, 1 number
- Email: standard format

**After submit:** Email verification screen with animated envelope icon + OTP or link instructions.

---

### Sign In Page (`/auth/signin`)

**Layout:** Centered card, minimal, clean

```
[Logo + Wordmark]
Welcome back
[Email]
[Password]     [Forgot password?]
[   Sign In   ]
──── or ────
[Continue with Google]
Don't have an account? Register Free
```

**Security note:** "Protected by AES-256 encryption" with shield icon.

---

## 10. SEO & Performance

### Meta Tags (per page)

```tsx
// app/layout.tsx
export const metadata = {
  title: 'FBR Digital Invoicing Software Pakistan | [Brand]',
  description: 'Pakistan\'s #1 FBR Digital Invoicing & Tax Advisory platform. SRO 709 compliant. Generate invoices, get IRN & QR codes in real-time. Free registration.',
  keywords: ['FBR digital invoicing', 'e-invoicing Pakistan', 'SRO 709', 'STRN compliance', 'tax advisory Pakistan'],
  openGraph: { ... }
}
```

### Target Keywords
- `fbr digital invoicing software pakistan`
- `e-invoicing pakistan sro 709`
- `fbr di api integration`
- `tax consultant fbr software`
- `strn compliance software`

### Performance Targets
- LCP < 2.5s
- Use `next/image` for all images
- Font loading: `display: swap`
- Lazy load non-critical sections
- Prefetch `/pricing` and `/auth/signup` on hover

---

## 11. Copy & Messaging Strategy

### Hero Headlines (A/B test these)
1. *"Pakistan's Smartest FBR Digital Invoicing + Tax Advisory Platform"*
2. *"Stay FBR Compliant. Zero Headaches."*
3. *"From Invoice to IRN in Under 2 Seconds."*

### Sub-headline
> *Stop worrying about STRN deactivation and PKR 500,000 penalties. Our platform connects directly to FBR's DI API, auto-generates IRN + QR codes, and gives you on-demand tax advisory — all in one place.*

### CTA Copy
- Primary: **"Start Free — No Credit Card"**
- Secondary: **"Watch 2-Minute Demo"**
- Pricing page CTA: **"Get Compliant Today"**
- Consultant CTA: **"Join Our Partner Program"**

### Fear + Relief framework (used on compliance section)
```
❌ Without us:        ✅ With [Brand]:
Manual invoices       Auto-generated, FBR-ready
STRN deactivation     Always compliant
PKR 500K fines        Zero penalty risk
Hours of admin        2-second submission
Multiple logins       One unified platform
No audit trail        Complete action history
```

### Urgency Messaging
- *"SRO 709 is mandatory NOW — non-compliance has immediate consequences."*
- *"Our sandbox is free. Test today, go live tomorrow."*

---

## 12. Step-by-Step Build Order

Follow this sequence to build the full application:

```
PHASE 1 — Foundation
□ 1. Init Next.js 14 project (TypeScript, App Router, Tailwind)
□ 2. Install: framer-motion, lucide-react, shadcn/ui, next-intl
□ 3. Set up design tokens (CSS vars, Tailwind config, fonts)
□ 4. Build Navbar component (scroll-aware, mobile menu)
□ 5. Build Footer component

PHASE 2 — Landing Page
□ 6. Hero section (animated, dark-green, dashboard mockup)
□ 7. Compliance urgency banner
□ 8. Features grid (all 5 categories, animated cards)
□ 9. How It Works (animated timeline)
□ 10. Pricing section (toggle monthly/annual, package cards)
□ 11. Testimonials + social proof
□ 12. For Consultants CTA section
□ 13. Final CTA section (full-width, green background)

PHASE 3 — Inner Pages
□ 14. /features — full feature breakdown, comparison table vs competitors
□ 15. /pricing — dedicated pricing page with FAQ accordion
□ 16. /how-it-works — detailed guide, embedded YouTube demo
□ 17. /for-consultants — multi-tenant features + partner program form
□ 18. /for-enterprise — enterprise features + contact sales

PHASE 4 — Auth Pages
□ 19. /auth/signup — split-screen with form validation
□ 20. /auth/signin — clean card layout
□ 21. /auth/verify-email — OTP or link confirmation screen
□ 22. /auth/forgot-password — email form + confirmation
□ 23. Wire up NextAuth.js or Clerk

PHASE 5 — Supporting Pages
□ 24. /about — company story, FBR licensing status, team
□ 25. /contact — form + WhatsApp button + map
□ 26. /blog — MDX-powered blog for SEO (SRO updates, guides)
□ 27. 404 page (custom, on-brand)

PHASE 6 — Polish & Launch
□ 28. Page transition animations (AnimatePresence)
□ 29. Scroll-progress indicator
□ 30. SEO metadata for all pages
□ 31. Sitemap + robots.txt
□ 32. Lighthouse audit (target: 90+ all scores)
□ 33. Urdu language toggle (next-intl)
□ 34. Deploy to Vercel with custom domain
```

---

## Appendix A — File Structure

```
app/
  layout.tsx              ← Root layout, Navbar, Footer, AnimatePresence
  page.tsx                ← Landing home
  features/page.tsx
  pricing/page.tsx
  how-it-works/page.tsx
  for-consultants/page.tsx
  for-enterprise/page.tsx
  about/page.tsx
  contact/page.tsx
  blog/
    page.tsx
    [slug]/page.tsx
  auth/
    signup/page.tsx
    signin/page.tsx
    verify-email/page.tsx
    forgot-password/page.tsx

components/
  layout/
    Navbar.tsx
    Footer.tsx
    PageTransition.tsx
  sections/
    Hero.tsx
    ComplianceBanner.tsx
    Features.tsx
    HowItWorks.tsx
    Pricing.tsx
    Testimonials.tsx
    ForConsultants.tsx
    FinalCTA.tsx
  ui/
    Button.tsx
    Badge.tsx
    PriceCard.tsx
    FeatureCard.tsx
    StepCard.tsx
    TestimonialCard.tsx
    LanguageToggle.tsx
  auth/
    SignUpForm.tsx
    SignInForm.tsx

lib/
  pricing.ts              ← Package data
  features.ts             ← Features data
  animations.ts           ← Shared Framer Motion variants
  i18n.ts

public/
  images/
  fonts/
```

---

## Appendix B — Key Differentiators Summary

When building copy and UI, always highlight these **vs. all competitors**:

1. **No setup fee** (competitors charge Rs. 15,000)
2. **AI invoice extraction** (unique — no competitor has this)
3. **Integrated tax advisory** (software + human expertise — no competitor offers this)
4. **Penalty risk checker** (proactive compliance alert — unique)
5. **WhatsApp delivery** (only shared with invoicefbr.com)
6. **Urdu support** (only shared with e-invoicing.pk)
7. **Multi-tenant for consultants** (only shared with fbreinvoicing.com + e-invoicing.pk)
8. **Batch CSV upload** (only e-invoicing.pk has this among smaller players)
9. **Premium animated UI** (no competitor has high-quality animated UX)
10. **Free sandbox testing** (same as fbreinvoicing.com — maintain parity)

---

*Skill version: 1.0 · Last updated: April 2026 · Domain: FBR Digital Tax Advisory SaaS · Framework: Next.js 14*
