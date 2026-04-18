import Link from 'next/link'

const plans = [
    {
        name: 'Free',
        price: 0,
        period: '/mo',
        description: 'For small businesses getting started',
        features: [
            '1 POS Terminal',
            '2 Staff accounts',
            '100 Products',
            '500 Invoices/month',
            'Basic PRAL DI integration',
            'Email support',
        ],
        cta: 'Start Free',
        popular: false,
    },
    {
        name: 'Starter',
        price: 2500,
        period: '/mo',
        description: 'Growing businesses with moderate volume',
        features: [
            '3 POS Terminals',
            '10 Staff accounts',
            '1,000 Products',
            '2,500 Invoices/month',
            'Advanced reports',
            'Custom branding',
            'CSV product import',
        ],
        cta: 'Start Free Trial',
        popular: false,
    },
    {
        name: 'Pro',
        price: 6500,
        period: '/mo',
        description: 'High-volume businesses with advanced needs',
        features: [
            '5 POS Terminals',
            '20 Staff accounts',
            'Unlimited Products',
            'Unlimited Invoices',
            'API Access',
            'Priority support',
            'Email invoices to buyers',
            'Advanced analytics',
        ],
        cta: 'Start Free Trial',
        popular: true,
    },
    {
        name: 'Enterprise',
        price: 15000,
        period: '/mo',
        description: 'Large operations with multiple locations',
        features: [
            'Unlimited POS Terminals',
            'Unlimited Staff',
            'Unlimited Everything',
            'White label',
            'Multi-branch support',
            'Accountant access',
            'Dedicated support',
            'Custom integrations',
        ],
        cta: 'Contact Sales',
        popular: false,
    },
]

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
                <Link href="/" className="text-xl font-bold">
                    PRAL DI POS Platform
                </Link>
                <div className="flex items-center gap-4">
                    <Link href="/login" className="text-sm text-slate-300 hover:text-white">
                        Login
                    </Link>
                    <Link
                        href="/signup"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                        Get Started
                    </Link>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-16">
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
                    <p className="text-slate-400 text-lg">
                        Choose the plan that fits your business. All plans include PRAL DI integration.
                    </p>
                </div>

                <div className="grid md:grid-cols-4 gap-6">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={`rounded-xl p-6 ${plan.popular
                                ? 'bg-blue-600/10 border-2 border-blue-500 relative'
                                : 'bg-slate-900 border border-slate-800'
                                }`}
                        >
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-xs font-bold px-3 py-1 rounded-full">
                                    MOST POPULAR
                                </div>
                            )}
                            <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                            <p className="text-sm text-slate-400 mb-4">{plan.description}</p>
                            <div className="mb-6">
                                <span className="text-3xl font-bold">PKR {plan.price.toLocaleString()}</span>
                                <span className="text-slate-400">{plan.period}</span>
                            </div>
                            <Link
                                href="/signup"
                                className={`block text-center py-2.5 rounded-lg font-medium text-sm mb-6 ${plan.popular
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : 'bg-slate-800 hover:bg-slate-700 text-white'
                                    }`}
                            >
                                {plan.cta}
                            </Link>
                            <ul className="space-y-2">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="text-sm text-slate-300 flex items-start gap-2">
                                        <span className="text-green-400 mt-0.5">✓</span>
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    )
}
