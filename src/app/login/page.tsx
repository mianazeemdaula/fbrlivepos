'use client'

import { Suspense, useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { LockKeyhole, ShieldCheck } from 'lucide-react'

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const registered = searchParams.get('registered')

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError('')

        const form = new FormData(e.currentTarget)

        const result = await signIn('credentials', {
            email: form.get('email') as string,
            password: form.get('password') as string,
            redirect: false,
        })

        setLoading(false)

        if (result?.error) {
            setError('Invalid email or password')
            return
        }

        const session = await getSession()
        if (session?.user?.role === 'SUPER_ADMIN') {
            router.push('/super-admin')
        } else {
            router.push('/dashboard')
        }
        router.refresh()
    }

    return (
        <div className="min-h-screen px-6 py-10 lg:px-10">
            <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-[var(--border)] bg-white/70 shadow-[var(--shadow-card)] backdrop-blur-xl lg:grid-cols-[0.95fr_1.05fr]">
                <div className="brand-gradient hidden p-10 text-white lg:flex lg:flex-col lg:justify-between">
                    <div>
                        <p className="brand-heading text-3xl font-bold">Welcome back to your compliance workspace.</p>
                        <p className="mt-4 max-w-md text-sm leading-7 text-white/78">
                            Tenant and super-admin users now land in the same visual system as the public site, with the same trust and compliance framing carried through the app.
                        </p>
                    </div>
                    <div className="space-y-4">
                        <div className="rounded-[1.6rem] border border-white/12 bg-white/10 p-5">
                            <p className="text-xs uppercase tracking-[0.24em] text-white/65">Security</p>
                            <p className="mt-2 text-lg font-semibold">Protected by encrypted credentials and role-based access.</p>
                        </div>
                        <div className="flex gap-3 text-xs text-white/75">
                            <span className="rounded-full border border-white/15 px-3 py-1.5">SRO 709 aligned</span>
                            <span className="rounded-full border border-white/15 px-3 py-1.5">AES-256 ready</span>
                            <span className="rounded-full border border-white/15 px-3 py-1.5">Multi-tenant</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-center p-6 lg:p-10">
                    <div className="w-full max-w-md">
                        <div className="mb-8 text-center">
                            <Link href="/" className="brand-heading text-3xl font-bold text-[var(--primary)]">
                                FBR Live POS
                            </Link>
                            <p className="mt-2 text-[var(--muted)]">Sign in to continue to your dashboard</p>
                        </div>

                        <form onSubmit={handleSubmit} className="brand-panel space-y-4 rounded-[1.75rem] p-6">
                            {registered && (
                                <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/8 p-3 text-sm text-emerald-700">
                                    Account created! Please sign in.
                                </div>
                            )}

                            {error && (
                                <div className="rounded-2xl border border-red-500/25 bg-red-500/8 p-3 text-sm text-red-700">
                                    {error}
                                </div>
                            )}

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
                                <div className="mb-1 flex items-center justify-between">
                                    <label className="block text-sm font-medium text-[var(--primary)]">Password</label>
                                    <span className="text-xs text-[var(--muted)]">Forgot password?</span>
                                </div>
                                <input
                                    name="password"
                                    type="password"
                                    required
                                    className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                                    placeholder="Your password"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] py-3 font-medium text-white transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                <LockKeyhole size={16} />
                                {loading ? 'Signing in...' : 'Sign In'}
                            </button>

                            <div className="flex items-center gap-2 rounded-2xl bg-[var(--primary-soft)] px-4 py-3 text-sm text-[var(--primary)]">
                                <ShieldCheck size={16} />
                                Protected by encrypted credentials and session-based access control.
                            </div>

                            <p className="text-center text-sm text-[var(--muted)]">
                                Don&apos;t have an account?{' '}
                                <Link href="/signup" className="font-semibold text-[var(--primary)] hover:text-[var(--primary-strong)]">
                                    Sign up
                                </Link>
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    )
}
