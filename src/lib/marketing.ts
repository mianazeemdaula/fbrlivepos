export type MarketingPlan = {
    id: string
    name: string
    tagline: string
    monthlyPrice: number | null
    annualPrice: number | null
    invoicesPerMonth: number | 'unlimited'
    users: number | 'unlimited'
    badge?: string
    highlight?: boolean
    features: string[]
}

export const defaultMarketingPlans: MarketingPlan[] = [
    {
        id: 'starter',
        name: 'Starter',
        tagline: 'For compliant startups and low-volume sellers.',
        monthlyPrice: 2500,
        annualPrice: 25000,
        invoicesPerMonth: 25,
        users: 2,
        features: ['FBR sandbox + production access', 'IRN and QR generation', 'Urdu and English support'],
    },
    {
        id: 'basic',
        name: 'Basic',
        tagline: 'For wholesalers and growing teams.',
        monthlyPrice: 4500,
        annualPrice: 45000,
        invoicesPerMonth: 50,
        users: 3,
        features: ['Priority onboarding', 'Credit and debit note support', 'Submission retry protection'],
    },
    {
        id: 'growth',
        name: 'Growth',
        tagline: 'The most balanced package for active businesses.',
        monthlyPrice: 7500,
        annualPrice: 75000,
        invoicesPerMonth: 100,
        users: 5,
        badge: 'Most Popular',
        highlight: true,
        features: ['Batch invoice upload', 'Analytics dashboard', 'Multi-user workflows'],
    },
    {
        id: 'professional',
        name: 'Professional',
        tagline: 'For consultant-led or multi-company operations.',
        monthlyPrice: 15000,
        annualPrice: 150000,
        invoicesPerMonth: 300,
        users: 8,
        badge: 'Best Value',
        features: ['Multi-tenant management', 'Audit trail', 'ERP and advisory add-ons'],
    },
    {
        id: 'business',
        name: 'Business',
        tagline: 'For larger trading operations with heavier throughput.',
        monthlyPrice: 25000,
        annualPrice: 250000,
        invoicesPerMonth: 500,
        users: 15,
        features: ['Priority support', 'Operational review support', 'Advanced reporting'],
    },
    {
        id: 'scale',
        name: 'Scale',
        tagline: 'For enterprise-grade invoice volume and team scale.',
        monthlyPrice: 40000,
        annualPrice: 400000,
        invoicesPerMonth: 1000,
        users: 25,
        features: ['Dedicated enablement', 'Custom integrations', 'Compliance escalation support'],
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        tagline: 'Custom commercial model for complex rollouts.',
        monthlyPrice: null,
        annualPrice: null,
        invoicesPerMonth: 'unlimited',
        users: 'unlimited',
        features: ['Custom pricing', 'White-label options', 'Account manager and SLA'],
    },
]

export const trustStats = [
    '500+ businesses onboarded',
    '99.8% FBR approval rate',
    '<2s DI response target',
    '10,000+ invoices processed',
]

export const featureHighlights = [
    {
        title: 'Real-time FBR compliance',
        description: 'Submit invoices directly to the DI API and track approval, queue state, and validation from one system.',
    },
    {
        title: 'Consultant-grade tenancy',
        description: 'Run multiple businesses, teams, and environments from one platform without mixing operational data.',
    },
    {
        title: 'Operational resilience',
        description: 'Retry handling, sandbox-first workflows, and encrypted credentials protect live invoice operations.',
    },
    {
        title: 'Advisory-led positioning',
        description: 'Packages and UX are aligned with compliance, audit readiness, and rollout support instead of generic POS messaging.',
    },
]

export const testimonials = [
    {
        quote: 'Saved 15 hours each week and gave our buyers more trust because every invoice had a proper QR and submission trail.',
        author: 'CEO, Raza Trading Co., Karachi',
    },
    {
        quote: 'The accountant creates invoices, management reviews them, and the platform keeps the whole trail ready for audit.',
        author: 'Finance Manager, Lahore',
    },
    {
        quote: 'Managing multiple client businesses from one place is the difference between a software tool and an actual practice platform.',
        author: 'Chartered Accountant, Islamabad',
    },
]
