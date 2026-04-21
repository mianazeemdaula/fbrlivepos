import Link from 'next/link'
import { ArrowRight, BadgeCheck, Building2, ChartColumnBig, FileCheck2, ShieldCheck, Sparkles } from 'lucide-react'
import { featureHighlights, testimonials, trustStats, defaultMarketingPlans } from '@/lib/marketing'

export default function HomePage() {
  const featuredPlans = defaultMarketingPlans.slice(0, 4)

  return (
    <div className="min-h-screen text-[var(--foreground)]">
      <nav className="sticky top-0 z-20 border-b border-[var(--border)] bg-[rgba(247,246,242,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="brand-heading text-xl font-bold text-[var(--primary)]">FBR Live POS</p>
            <p className="text-xs text-[var(--muted)]">Digital invoicing, compliance, and advisory</p>
          </div>
          <div className="hidden items-center gap-6 text-sm md:flex">
            <Link href="/pricing" className="text-[var(--muted)] transition hover:text-[var(--primary)]">Pricing</Link>
            <Link href="/login" className="text-[var(--muted)] transition hover:text-[var(--primary)]">Sign in</Link>
            <Link href="/signup" className="rounded-full bg-[var(--primary)] px-5 py-2.5 font-medium text-white transition hover:bg-[var(--primary-strong)]">Start Free</Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm brand-chip">
              <Sparkles size={16} />
              SRO 709 aligned, FBR DI API ready, no setup fee
            </div>

            <div className="space-y-5">
              <h1 className="brand-heading max-w-4xl text-5xl font-extrabold leading-none md:text-7xl">
                Pakistan&apos;s smartest FBR digital invoicing and advisory workspace.
              </h1>
              <p className="max-w-2xl text-lg leading-8 brand-muted md:text-xl">
                Run invoicing, sandbox validation, live submission, subscription packages, and admin operations from one system built for compliance-first businesses in Pakistan.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-6 py-3.5 font-semibold text-white transition hover:bg-[var(--primary-strong)]">
                Start Free - No Credit Card
                <ArrowRight size={18} />
              </Link>
              <Link href="/pricing" className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-6 py-3.5 font-semibold text-[var(--primary)] transition hover:border-[var(--accent)] hover:bg-white">
                View Packages
              </Link>
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              {trustStats.map((item) => (
                <div key={item} className="brand-panel rounded-2xl px-4 py-3 font-medium text-[var(--primary)]">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="brand-card-dark rounded-[2rem] p-6 text-[#f6f0e4]">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="brand-heading text-2xl font-bold">Live Compliance Desk</p>
                <p className="mt-1 text-sm text-[#c1bcaf]">Same theme across public, user, and admin surfaces.</p>
              </div>
              <div className="rounded-full bg-[#f0d9a014] px-3 py-1 text-xs text-[#f0d9a0]">Unified Ops</div>
            </div>

            <div className="space-y-4">
              <div className="app-panel-soft rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <BadgeCheck className="text-[#f0d9a0]" size={18} />
                  <div>
                    <p className="text-sm font-semibold">DI submissions monitored</p>
                    <p className="text-xs text-[#c1bcaf]">Queue visibility, tenant isolation, and audit-ready status history.</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="app-panel-soft rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-[#c1bcaf]">Plans</p>
                  <p className="mt-2 text-3xl font-bold text-[#f0d9a0]">7</p>
                  <p className="mt-1 text-sm text-[#c1bcaf]">Package bands from starter to enterprise</p>
                </div>
                <div className="app-panel-soft rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-[#c1bcaf]">Turnaround</p>
                  <p className="mt-2 text-3xl font-bold text-[#f0d9a0]">&lt; 2s</p>
                  <p className="mt-1 text-sm text-[#c1bcaf]">Target response for live DI submission</p>
                </div>
              </div>
              <div className="rounded-2xl border border-[#f0d9a01f] bg-[#0f1d14] p-4">
                <p className="text-sm font-semibold text-[#f6f0e4]">Compliance banner</p>
                <p className="mt-2 text-sm leading-7 text-[#c1bcaf]">
                  FBR mandates digital invoicing under SRO 709. The platform packages compliance workflows, package controls, and operational visibility into one coordinated product surface.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-8">
          <div className="rounded-[2rem] border border-[var(--accent-soft)]/40 bg-[linear-gradient(135deg,rgba(200,164,90,0.16),rgba(1,65,28,0.08))] px-6 py-5 text-sm font-medium text-[var(--primary)] md:flex md:items-center md:justify-between">
            <span>FBR mandates digital invoicing under SRO 709(I)/2024. Non-compliance risks penalties and operational friction.</span>
            <Link href="/pricing" className="mt-3 inline-flex items-center gap-2 font-semibold text-[var(--primary)] md:mt-0">
              Get compliant today
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-12 lg:py-16">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-[var(--accent)]">Why teams switch</p>
              <h2 className="brand-heading mt-3 text-4xl font-bold text-[var(--primary)]">Built for compliance operations, not just billing screens.</h2>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {featureHighlights.map((feature, index) => {
              const Icon = [FileCheck2, Building2, ShieldCheck, ChartColumnBig][index]
              return (
                <div key={feature.title} className="brand-panel rounded-[1.6rem] p-6">
                  <div className="mb-5 inline-flex rounded-2xl bg-[var(--primary-soft)] p-3 text-[var(--primary)]">
                    <Icon size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--primary)]">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 brand-muted">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-12 lg:py-16">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-[var(--accent)]">Packages</p>
              <h2 className="brand-heading mt-3 text-4xl font-bold text-[var(--primary)]">Subscription plans aligned with the admin package model.</h2>
            </div>
            <Link href="/pricing" className="hidden text-sm font-semibold text-[var(--primary)] md:block">See full pricing</Link>
          </div>
          <div className="grid gap-5 lg:grid-cols-4">
            {featuredPlans.map((plan) => (
              <div key={plan.id} className={`rounded-[1.75rem] p-6 ${plan.highlight ? 'brand-gradient text-white shadow-[var(--shadow-hover)]' : 'brand-panel'}`}>
                {plan.badge && (
                  <div className={`mb-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${plan.highlight ? 'bg-white/15 text-white' : 'brand-chip'}`}>
                    {plan.badge}
                  </div>
                )}
                <h3 className={`text-2xl font-semibold ${plan.highlight ? 'text-white' : 'text-[var(--primary)]'}`}>{plan.name}</h3>
                <p className={`mt-2 text-sm leading-7 ${plan.highlight ? 'text-white/80' : 'brand-muted'}`}>{plan.tagline}</p>
                <p className={`mt-5 text-4xl font-bold ${plan.highlight ? 'text-white' : 'text-[var(--primary)]'}`}>
                  {plan.monthlyPrice ? `PKR ${plan.monthlyPrice.toLocaleString()}` : 'Custom'}
                </p>
                <p className={`mt-1 text-sm ${plan.highlight ? 'text-white/70' : 'brand-muted'}`}>
                  {plan.monthlyPrice ? `PKR ${plan.annualPrice?.toLocaleString()} yearly` : 'Talk to sales'}
                </p>
                <div className={`mt-5 space-y-2 text-sm ${plan.highlight ? 'text-white/90' : 'text-[var(--foreground)]'}`}>
                  <p>Invoices: {plan.invoicesPerMonth === 'unlimited' ? 'Unlimited' : plan.invoicesPerMonth}</p>
                  <p>Users: {plan.users === 'unlimited' ? 'Unlimited' : plan.users}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-12 lg:py-16">
          <div className="grid gap-5 lg:grid-cols-3">
            {testimonials.map((item) => (
              <div key={item.author} className="brand-panel rounded-[1.6rem] p-6">
                <p className="text-lg leading-8 text-[var(--primary)]">&ldquo;{item.quote}&rdquo;</p>
                <p className="mt-5 text-sm font-semibold text-[var(--muted)]">{item.author}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] bg-white/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-[var(--muted)] md:flex-row md:items-center md:justify-between">
          <p>FBR Live POS - Pakistan GST compliance, digital invoicing, and package-led operations.</p>
          <div className="flex gap-5">
            <Link href="/pricing">Pricing</Link>
            <Link href="/login">Login</Link>
            <Link href="/signup">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
