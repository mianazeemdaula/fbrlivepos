import Link from 'next/link'
import { Check } from 'lucide-react'
import { getPublicMarketingPlans } from '@/lib/marketing-plans.server'
import type { MarketingPlan } from '@/lib/marketing'
import SiteHeader from '@/components/marketing/site-header'
import SiteFooter from '@/components/marketing/site-footer'

const faqs = [
    { q: 'Is there a setup fee?', a: 'No. You only pay for your plan.' },
    { q: 'Can I test before going live?', a: 'Yes. Every account starts in FBR sandbox so you can validate your invoices first.' },
    { q: 'Can I change my plan later?', a: 'Yes. Upgrade as your invoice volume or team grows.' },
]

// Plans, prices and features are read from the database on every request,
// so changes made in Super Admin → Subscriptions show up immediately.
export const dynamic = 'force-dynamic'

function formatLimit(value: number | 'unlimited') {
    return value === 'unlimited' ? 'Unlimited' : value.toLocaleString()
}

function planLimits(plan: MarketingPlan) {
    return [
        `${formatLimit(plan.invoicesPerMonth)} invoices / month`,
        `${formatLimit(plan.users)} users`,
        `${formatLimit(plan.products)} products`,
        `${formatLimit(plan.posTerminals)} POS terminal${plan.posTerminals === 1 ? '' : 's'}`,
    ]
}

export default async function PricingPage() {
    const plans = await getPublicMarketingPlans()

    return (
        <div className="min-h-screen bg-white text-slate-900">
            <SiteHeader />

            <main>
                <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
                    <div className="mx-auto max-w-2xl px-4 py-14 text-center sm:px-6 lg:py-20">
                        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Simple, transparent pricing</h1>
                        <p className="mt-3 text-slate-600">
                            Choose a plan by monthly invoice volume. No setup fee.
                        </p>
                    </div>
                </section>

                <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-16">
                    {plans.length > 0 ? (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {plans.map((plan) => {
                                const isCustom = plan.monthlyPrice === null
                                const isFree = plan.monthlyPrice === 0
                                return (
                                    <div
                                        key={plan.id}
                                        className={`relative flex flex-col rounded-xl border p-6 ${plan.highlight ? 'border-primary ring-1 ring-primary' : 'border-slate-200'}`}
                                    >
                                        {plan.badge && (
                                            <span className="absolute -top-2.5 left-6 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-white">
                                                {plan.badge}
                                            </span>
                                        )}

                                        <h2 className="text-sm font-semibold">{plan.name}</h2>
                                        <p className="mt-1 min-h-10 text-sm text-slate-500">{plan.tagline}</p>

                                        <div className="mt-5">
                                            {isCustom || isFree ? (
                                                <span className="text-3xl font-semibold tracking-tight">{isFree ? 'Free' : 'Custom'}</span>
                                            ) : (
                                                <>
                                                    <span className="text-3xl font-semibold tracking-tight">{plan.currency} {plan.monthlyPrice!.toLocaleString()}</span>
                                                    <span className="text-sm text-slate-500"> /month</span>
                                                </>
                                            )}
                                            <p className="mt-1 text-xs text-slate-500">
                                                {isFree
                                                    ? 'No credit card required'
                                                    : isCustom || !plan.annualPrice
                                                    ? 'Annual billing on request'
                                                    : `or ${plan.currency} ${plan.annualPrice.toLocaleString()} billed yearly`}
                                                {plan.trialDays > 0 && ` · ${plan.trialDays}-day free trial`}
                                            </p>
                                        </div>

                                        <Link
                                            href={isCustom ? 'tel:+923007395147' : '/signup'}
                                            className={`mt-6 inline-flex h-10 items-center justify-center rounded-lg text-sm font-medium transition ${plan.highlight ? 'bg-primary text-white hover:bg-primary-dark' : 'border border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900'}`}
                                        >
                                            {isCustom ? 'Contact sales' : 'Get started'}
                                        </Link>

                                        <ul className="mt-6 space-y-2.5 border-t border-slate-100 pt-6 text-sm text-slate-600">
                                            {[...planLimits(plan), ...plan.features].map((feature) => (
                                                <li key={feature} className="flex items-start gap-2">
                                                    <Check size={16} className="mt-0.5 shrink-0 text-primary" />
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <p className="rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500">
                            Plans will be available soon. Call <a href="tel:+923007395147" className="font-medium text-slate-700">+92 300 7395147</a> for pricing.
                        </p>
                    )}
                </section>

                <section className="border-t border-slate-200 bg-slate-50">
                    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-16">
                        <h2 className="text-2xl font-semibold tracking-tight">Common questions</h2>
                        <dl className="mt-8 divide-y divide-slate-200">
                            {faqs.map((faq) => (
                                <div key={faq.q} className="py-4">
                                    <dt className="text-sm font-semibold">{faq.q}</dt>
                                    <dd className="mt-1 text-sm text-slate-600">{faq.a}</dd>
                                </div>
                            ))}
                        </dl>
                        <p className="mt-8 text-sm text-slate-600">
                            Still have questions? Call{' '}
                            <a href="tel:+923007395147" className="font-medium text-primary hover:text-primary-dark">+92 300 7395147</a>
                            {' '}or{' '}
                            <a href="tel:+923334103160" className="font-medium text-primary hover:text-primary-dark">+92 333 4103160</a>.
                        </p>
                    </div>
                </section>
            </main>

            <SiteFooter />
        </div>
    )
}
