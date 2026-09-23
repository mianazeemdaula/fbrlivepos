type Limit = number | 'unlimited'

export type MarketingPlan = {
    id: string
    name: string
    tagline: string
    currency: string
    monthlyPrice: number | null
    annualPrice: number | null
    trialDays: number
    invoicesPerMonth: Limit
    users: Limit
    products: Limit
    posTerminals: Limit
    badge?: string
    highlight?: boolean
    features: string[]
}

export const trustStats = [
    { value: '500+', label: 'Businesses onboarded' },
    { value: '99.8%', label: 'FBR approval rate' },
    { value: '<2s', label: 'DI response target' },
    { value: '10,000+', label: 'Invoices processed' },
]

export const featureHighlights = [
    {
        title: 'Direct FBR submission',
        description: 'Invoices go straight to the FBR DI API with IRN and QR code on every receipt.',
    },
    {
        title: 'Multi-business workspace',
        description: 'Manage several businesses and teams with fully separated data.',
    },
    {
        title: 'Sandbox before live',
        description: 'Validate every scenario in FBR sandbox, then switch to production.',
    },
    {
        title: 'Audit-ready records',
        description: 'Every submission, response and change is logged for review.',
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
