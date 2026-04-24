'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BadgeCheck, Building2, ShieldCheck } from 'lucide-react'

export default function SignupPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError('')

        const form = new FormData(e.currentTarget)
        const data = {
            name: form.get('name') as string,
            email: form.get('email') as string,
            password: form.get('password') as string,
            businessName: form.get('businessName') as string,
            phone: form.get('phone') as string,
        }

        try {
            const res = await fetch('/api/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })

            const result = await res.json()

            if (!res.ok) {
                setError(result.error || 'Something went wrong')
                return
            }

            router.push('/onboarding')
        } catch {
            setError('Network error. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen px-6 py-10 lg:px-10">
            <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-[var(--border)] bg-white/70 shadow-[var(--shadow-card)] backdrop-blur-xl lg:grid-cols-[0.92fr_1.08fr]">
                <div className="brand-gradient flex flex-col justify-between p-8 text-white lg:p-10">
                    <div>
                        <p className="brand-heading text-4xl font-bold">Join 500+ Pakistani businesses that invoice smarter.</p>
                        <p className="mt-4 max-w-md text-sm leading-7 text-white/78">
                            Set up your tenant, connect your team, and move from sandbox validation to live invoicing in the same platform theme your admins already manage.
                        </p>
                    </div>
                    <div className="space-y-4">
                        <div className="rounded-[1.7rem] border border-white/12 bg-white/10 p-5">
                            <p className="text-xs uppercase tracking-[0.24em] text-white/65">What you get</p>
                            <div className="mt-3 space-y-3 text-sm text-white/84">
                                <div className="flex items-center gap-3"><BadgeCheck size={16} /> FBR DI ready onboarding</div>
                                <div className="flex items-center gap-3"><ShieldCheck size={16} /> Encrypted credential storage</div>
                                <div className="flex items-center gap-3"><Building2 size={16} /> Multi-user tenant workspace</div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-white/75">
                            <span className="rounded-full border border-white/15 px-3 py-1.5">No setup fee</span>
                            <span className="rounded-full border border-white/15 px-3 py-1.5">Sandbox-first</span>
                            <span className="rounded-full border border-white/15 px-3 py-1.5">Package upgrades later</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-center p-6 lg:p-10">
                    <div className="w-full max-w-xl">
                        <div className="mb-8 text-center lg:text-left">
                            <Link href="/" className="brand-heading text-3xl font-bold text-[var(--primary)]">
                                FBR Live POS
                            </Link>
                            <p className="mt-2 text-[var(--muted)]">Create your business account</p>
                        </div>

                        <form onSubmit={handleSubmit} className="brand-panel space-y-4 rounded-[1.8rem] p-6">
                            {error && (
                                <div className="rounded-2xl border border-red-500/25 bg-red-500/8 p-3 text-sm text-red-700">
                                    {error}
                                </div>
                            )}

                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[var(--primary)]">Your Name</label>
                                    <input
                                        name="name"
                                        type="text"
                                        required
                                        minLength={2}
                                        className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                                        placeholder="John Doe"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[var(--primary)]">Business Name</label>
                                    <input
                                        name="businessName"
                                        type="text"
                                        required
                                        minLength={2}
                                        className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                                        placeholder="Acme Traders"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[var(--primary)]">Email</label>
                                    <input
                                        name="email"
                                        type="email"
                                        required
                                        className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                                        placeholder="you@business.com"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-primary">Phone</label>
                                    <input
                                        name="phone"
                                        type="tel"
                                        className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                                        placeholder="+92 300 1234567"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-primary">Password</label>
                                <input
                                    name="password"
                                    type="password"
                                    required
                                    minLength={8}
                                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                                    placeholder="Min 8 characters"
                                />
                            </div>

                            <div className="rounded-2xl bg-primary-soft px-4 py-3 text-sm text-primary">
                                The system will create your tenant and, if available, automatically attach the active free plan from the existing subscription table.
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full rounded-full bg-primary py-3 font-medium text-white transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {loading ? 'Creating account...' : 'Create Account'}
                            </button>

                            <p className="text-center text-sm text-muted">
                                Already have an account?{' '}
                                <Link href="/login" className="font-semibold text-primary hover:text-primary-strong">
                                    Sign in
                                </Link>
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
