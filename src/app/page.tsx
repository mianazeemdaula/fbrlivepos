import Link from 'next/link'
import { ArrowRight, Building2, Check, FileCheck2, FlaskConical, ScrollText } from 'lucide-react'
import { featureHighlights, trustStats } from '@/lib/marketing'
import { getPublicMarketingPlans } from '@/lib/marketing-plans.server'
import SiteHeader from '@/components/marketing/site-header'
import SiteFooter from '@/components/marketing/site-footer'

const featureIcons = [FileCheck2, Building2, FlaskConical, ScrollText]

const steps = [
    { title: 'Create your account', description: 'Add your business details and NTN.' },
    { title: 'Test in FBR sandbox', description: 'Validate your invoice scenarios with FBR.' },
    { title: 'Go live', description: 'Issue invoices with IRN and QR from day one.' },
]

const sampleInvoices = [
    { no: 'INV-1042', buyer: 'Raza Trading Co.', amount: 'PKR 118,000' },
    { no: 'INV-1041', buyer: 'Al-Noor Stores', amount: 'PKR 42,480' },
    { no: 'INV-1040', buyer: 'Metro Wholesale', amount: 'PKR 260,540' },
]

// Plans shown here come from the database on every request.
export const dynamic = 'force-dynamic'

function formatLimit(value: number | 'unlimited') {
    return value === 'unlimited' ? 'Unlimited' : value.toLocaleString()
}

export default async function HomePage() {
    const featuredPlans = (await getPublicMarketingPlans()).slice(0, 4)

    return (
        <div className="min-h-screen bg-white text-slate-900">
            <SiteHeader />

            <main>
                {/* Hero */}
                <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
                    <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
                        <div>
                            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Compliant with SRO 709(I)/2024
                            </span>
                            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                                FBR digital invoicing, made simple.
                            </h1>
                            <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
                                Create invoices, submit them to FBR in real time and keep audit-ready records in one place.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-3">
                                <Link href="/signup" className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-white transition hover:bg-primary-dark">
                                    Start free
                                    <ArrowRight size={16} />
                                </Link>
                                <Link href="/pricing" className="inline-flex h-11 items-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900">
                                    View pricing
                                </Link>
                            </div>
                            <p className="mt-4 text-xs text-slate-500">No setup fee. No credit card required.</p>
                        </div>

                        {/* Product preview */}
                        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                                <p className="text-sm font-semibold">Recent invoices</p>
                                <span className="text-xs text-slate-500">Today</span>
                            </div>
                            <ul className="divide-y divide-slate-100">
                                {sampleInvoices.map((invoice) => (
                                    <li key={invoice.no} className="flex items-center justify-between gap-4 px-5 py-4">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium">{invoice.buyer}</p>
                                            <p className="text-xs text-slate-500">{invoice.no}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium tabular-nums">{invoice.amount}</p>
                                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                                <Check size={12} />
                                                Accepted by FBR
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
                                <span>IRN and QR code issued</span>
                                <span className="font-medium text-slate-700">3 of 3</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Stats */}
                <section className="border-b border-slate-200">
                    <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-8 px-4 py-10 sm:px-6 md:grid-cols-4">
                        {trustStats.map((stat) => (
                            <div key={stat.label} className="text-center">
                                <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
                                <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Features */}
                <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
                    <div className="max-w-xl">
                        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Everything you need to stay compliant</h2>
                        <p className="mt-3 text-slate-600">Built around FBR&apos;s Digital Invoicing requirements.</p>
                    </div>
                    <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {featureHighlights.map((feature, index) => {
                            const Icon = featureIcons[index] ?? FileCheck2
                            return (
                                <div key={feature.title} className="rounded-xl border border-slate-200 p-5">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                        <Icon size={18} />
                                    </span>
                                    <h3 className="mt-4 text-sm font-semibold">{feature.title}</h3>
                                    <p className="mt-1.5 text-sm leading-6 text-slate-600">{feature.description}</p>
                                </div>
                            )
                        })}
                    </div>
                </section>

                {/* How it works */}
                <section className="border-y border-slate-200 bg-slate-50">
                    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
                        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Live in three steps</h2>
                        <ol className="mt-10 grid gap-6 md:grid-cols-3">
                            {steps.map((step, index) => (
                                <li key={step.title} className="flex gap-4">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                                        {index + 1}
                                    </span>
                                    <div>
                                        <h3 className="text-sm font-semibold">{step.title}</h3>
                                        <p className="mt-1 text-sm text-slate-600">{step.description}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                {/* Plans */}
                <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Simple, transparent pricing</h2>
                            <p className="mt-3 text-slate-600">Pick a plan that fits your invoice volume.</p>
                        </div>
                        <Link href="/pricing" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark">
                            Compare all plans
                            <ArrowRight size={14} />
                        </Link>
                    </div>

                    {featuredPlans.length > 0 ? (
                        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                            {featuredPlans.map((plan) => (
                                <div
                                    key={plan.id}
                                    className={`relative flex flex-col rounded-xl border p-6 ${plan.highlight ? 'border-primary ring-1 ring-primary' : 'border-slate-200'}`}
                                >
                                    {plan.badge && (
                                        <span className="absolute -top-2.5 left-6 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-white">
                                            {plan.badge}
                                        </span>
                                    )}
                                    <h3 className="text-sm font-semibold">{plan.name}</h3>
                                    <p className="mt-1 text-sm text-slate-500">{plan.tagline}</p>
                                    <p className="mt-5">
                                        {plan.monthlyPrice === null ? (
                                            <span className="text-2xl font-semibold tracking-tight">Custom</span>
                                        ) : plan.monthlyPrice === 0 ? (
                                            <span className="text-2xl font-semibold tracking-tight">Free</span>
                                        ) : (
                                            <>
                                                <span className="text-2xl font-semibold tracking-tight">{plan.currency} {plan.monthlyPrice.toLocaleString()}</span>
                                                <span className="text-sm text-slate-500"> /month</span>
                                            </>
                                        )}
                                    </p>
                                    <ul className="mt-5 space-y-2 text-sm text-slate-600">
                                        <li className="flex items-center gap-2"><Check size={14} className="text-primary" />{formatLimit(plan.invoicesPerMonth)} invoices / month</li>
                                        <li className="flex items-center gap-2"><Check size={14} className="text-primary" />{formatLimit(plan.users)} users</li>
                                        {plan.trialDays > 0 && (
                                            <li className="flex items-center gap-2"><Check size={14} className="text-primary" />{plan.trialDays}-day free trial</li>
                                        )}
                                    </ul>
                                    <Link
                                        href={plan.monthlyPrice === null ? '/pricing' : '/signup'}
                                        className={`mt-6 inline-flex h-9 items-center justify-center rounded-lg text-sm font-medium transition ${plan.highlight ? 'bg-primary text-white hover:bg-primary-dark' : 'border border-slate-300 text-slate-700 hover:border-slate-400'}`}
                                    >
                                        {plan.monthlyPrice === null ? 'Contact sales' : 'Get started'}
                                    </Link>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-10 rounded-xl border border-slate-200 p-6 text-sm text-slate-500">
                            Plans will be available soon.
                        </p>
                    )}
                </section>

                {/* CTA */}
                <section className="px-4 pb-16 sm:px-6 lg:pb-20">
                    <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-2xl bg-slate-900 px-8 py-10 text-white md:flex-row md:items-center">
                        <div>
                            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Ready to invoice with FBR?</h2>
                            <p className="mt-2 text-sm text-slate-300">
                                Need help with setup? Call <a href="tel:+923007395147" className="font-medium text-white hover:underline">+92 300 7395147</a>
                            </p>
                        </div>
                        <Link href="/signup" className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-medium text-slate-900 transition hover:bg-slate-100">
                            Create free account
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                </section>
            </main>

            <SiteFooter />
        </div>
    )
}
