'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

            router.push('/login?registered=true')
        } catch {
            setError('Network error. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <Link href="/" className="text-2xl font-bold">
                        PRAL DI POS Platform
                    </Link>
                    <p className="text-slate-400 mt-2">Create your business account</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 bg-slate-900 border border-slate-800 rounded-xl p-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm rounded-lg p-3">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Your Name</label>
                        <input
                            name="name"
                            type="text"
                            required
                            minLength={2}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="John Doe"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Business Name</label>
                        <input
                            name="businessName"
                            type="text"
                            required
                            minLength={2}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Acme Traders"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                        <input
                            name="email"
                            type="email"
                            required
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="you@business.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Phone (optional)</label>
                        <input
                            name="phone"
                            type="tel"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="+92 300 1234567"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                        <input
                            name="password"
                            type="password"
                            required
                            minLength={8}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Min 8 characters"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium"
                    >
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>

                    <p className="text-center text-sm text-slate-400">
                        Already have an account?{' '}
                        <Link href="/login" className="text-blue-400 hover:text-blue-300">
                            Sign in
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    )
}
