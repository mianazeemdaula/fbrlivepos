import Link from 'next/link'
import { Check, Sparkles } from 'lucide-react'
import { getPublicMarketingPlans } from '@/lib/marketing-plans.server'

async function getPublicPlans() {
    return getPublicMarketingPlans()
}

export default async function PricingPage() {
    const plans = await getPublicPlans()

    return (
        <div className="min-h-screen text-ink">
            <nav className="border-b border-border bg-nav-blur backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                    <Link href="/" className="text-xl font-bold text-primary">
                        FBR Live POS
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link href="/login" className="text-sm text-muted hover:text-primary">
                            Login
                        </Link>
                        <Link
                            href="/signup"
                            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="mx-auto max-w-7xl px-6 py-16">
                <div className="mx-auto mb-14 max-w-3xl text-center">
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm brand-chip">
                        <Sparkles size={16} />
                        No setup fee, sandbox-first onboarding, admin-managed packages
                    </div>
                    <h1 className="text-5xl font-bold text-ink">Pricing designed for compliance rollout, not guesswork.</h1>
                    <p className="mt-5 text-lg leading-8 brand-muted">
                        Public pricing now reflects the same package structure your super-admin team manages in the platform. If plans already exist in the database, those are shown here automatically.
                    </p>
                </div>

                {plans.length > 0 ? (
                    <div className="grid gap-6 lg:grid-cols-3 xl:grid-cols-4">
                        {plans.map((plan) => (
                            <div
                                key={plan.id}
                                className={`rounded-modal p-6 ${plan.highlight ? 'brand-gradient text-white shadow-brand' : 'brand-panel'}`}
                            >
                                <div className="mb-4 flex items-start justify-between gap-4">
                                    <div>
                                        <h2 className={`text-2xl font-bold ${plan.highlight ? 'text-white' : 'text-ink'}`}>{plan.name}</h2>
                                        <p className={`mt-2 text-sm leading-7 ${plan.highlight ? 'text-white/80' : 'brand-muted'}`}>{plan.tagline}</p>
                                    </div>
                                    {plan.badge && (
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${plan.highlight ? 'bg-white/16 text-white' : 'brand-chip'}`}>
                                            {plan.badge}
                                        </span>
                                    )}
                                </div>

                                <div className="mb-5">
                                    <span className={`text-4xl font-bold ${plan.highlight ? 'text-white' : 'text-ink'}`}>
                                        {plan.monthlyPrice === null ? 'Custom' : `PKR ${plan.monthlyPrice.toLocaleString()}`}
                                    </span>
                                    <span className={`ml-2 text-sm ${plan.highlight ? 'text-white/70' : 'brand-muted'}`}>
                                        {plan.monthlyPrice === null ? 'pricing' : '/month'}
                                    </span>
                                    <p className={`mt-2 text-sm ${plan.highlight ? 'text-white/72' : 'brand-muted'}`}>
                                        {plan.annualPrice === null ? 'Annual plan available on request' : `PKR ${plan.annualPrice.toLocaleString()} yearly`}
                                    </p>
                                </div>

                                <div className={`mb-5 grid grid-cols-2 gap-3 rounded-2xl border p-3 text-sm ${plan.highlight ? 'border-white/10 bg-white/10' : 'border-border bg-surface'}`}>
                                    <div>
                                        <p className={plan.highlight ? 'text-white/65' : 'brand-muted'}>Invoices</p>
                                        <p className="font-semibold">{plan.invoicesPerMonth === 'unlimited' ? 'Unlimited' : plan.invoicesPerMonth}</p>
                                    </div>
                                    <div>
                                        <p className={plan.highlight ? 'text-white/65' : 'brand-muted'}>Users</p>
                                        <p className="font-semibold">{plan.users === 'unlimited' ? 'Unlimited' : plan.users}</p>
                                    </div>
                                </div>

                                <Link
                                    href="/signup"
                                    className={`mb-5 inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition ${plan.highlight ? 'bg-white text-primary hover:bg-primary-light' : 'bg-primary text-white hover:bg-primary-dark'}`}
                                >
                                    Get Compliant Today
                                </Link>

                                <ul className="space-y-3">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className={`flex items-start gap-3 text-sm ${plan.highlight ? 'text-white/86' : 'text-ink'}`}>
                                            <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="brand-panel rounded-3xl p-6 text-center text-sm brand-muted">
                        No public plans are available yet. Ask your super-admin to mark plans as active and public.
                    </div>
                )}
            </main>
        </div>
    )
}
