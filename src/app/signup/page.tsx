'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import AuthShell, { authButtonClass, authInputClass, authLabelClass } from '@/components/marketing/auth-shell'

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

            // Automatically sign the user in so session-protected onboarding
            // API routes (/api/tenant/di/scenarios, /api/tenant/di/setup) work.
            const signInResult = await signIn('credentials', {
                email: data.email,
                password: data.password,
                redirect: false,
            })

            if (signInResult?.error) {
                // Account created but sign-in failed – send to login
                router.push('/login')
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
        <AuthShell
            title="Create your account"
            subtitle="Start invoicing with FBR in a few minutes."
            points={[
                'No setup fee, no credit card required',
                'Test in FBR sandbox before going live',
                'Add your team and manage multiple businesses',
            ]}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label htmlFor="name" className={authLabelClass}>Full name</label>
                        <input id="name" name="name" type="text" autoComplete="name" required minLength={2} className={authInputClass} placeholder="Ali Khan" />
                    </div>
                    <div>
                        <label htmlFor="businessName" className={authLabelClass}>Business name</label>
                        <input id="businessName" name="businessName" type="text" autoComplete="organization" required minLength={2} className={authInputClass} placeholder="Acme Traders" />
                    </div>
                </div>

                <div>
                    <label htmlFor="email" className={authLabelClass}>Work email</label>
                    <input id="email" name="email" type="email" autoComplete="email" required className={authInputClass} placeholder="you@business.com" />
                </div>

                <div>
                    <label htmlFor="phone" className={authLabelClass}>
                        Phone <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <input id="phone" name="phone" type="tel" autoComplete="tel" className={authInputClass} placeholder="+92 300 1234567" />
                </div>

                <div>
                    <label htmlFor="password" className={authLabelClass}>Password</label>
                    <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={authInputClass} placeholder="At least 8 characters" />
                </div>

                <button type="submit" disabled={loading} className={authButtonClass}>
                    {loading ? 'Creating account...' : 'Create account'}
                </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-primary hover:text-primary-dark">
                    Sign in
                </Link>
            </p>
        </AuthShell>
    )
}
