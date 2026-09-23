'use client'

import { Suspense, useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import AuthShell, { authButtonClass, authInputClass, authLabelClass } from '@/components/marketing/auth-shell'

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
        <AuthShell
            title="Sign in"
            subtitle="Welcome back. Enter your details to continue."
            points={[
                'Real-time submission to the FBR DI API',
                'IRN and QR code on every invoice',
                'Encrypted credentials and role-based access',
            ]}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {registered && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
                        Account created. Please sign in.
                    </div>
                )}

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div>
                    <label htmlFor="email" className={authLabelClass}>Email</label>
                    <input id="email" name="email" type="email" autoComplete="email" required className={authInputClass} placeholder="you@business.com" />
                </div>

                <div>
                    <label htmlFor="password" className={authLabelClass}>Password</label>
                    <input id="password" name="password" type="password" autoComplete="current-password" required className={authInputClass} placeholder="Enter your password" />
                </div>

                <button type="submit" disabled={loading} className={authButtonClass}>
                    {loading ? 'Signing in...' : 'Sign in'}
                </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="font-medium text-primary hover:text-primary-dark">
                    Create one
                </Link>
            </p>
        </AuthShell>
    )
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    )
}
