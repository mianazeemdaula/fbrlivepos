'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { User, Menu, X } from 'lucide-react'

function useTenantEnvironment() {
    const [environment, setEnvironment] = useState<string | null>(null)
    useEffect(() => {
        fetch('/api/tenant/fbr-credentials')
            .then(r => r.ok ? r.json() : null)
            .then(data => setEnvironment(data?.environment || null))
            .catch(() => setEnvironment(null))
    }, [])
    return environment
}

const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/pos', label: 'POS Terminal' },
    { href: '/invoices', label: 'Invoices' },
    { href: '/products', label: 'Products' },
    { href: '/customers', label: 'Customers' },
    { href: '/hs-codes', label: 'HS Codes' },
    { href: '/sandbox-scenarios', label: 'Sandbox' },
    { href: '/onboarding', label: 'FBR Setup' },
    { href: '/settings', label: 'Settings' },
]

export default function TenantLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { data: session } = useSession()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const environment = useTenantEnvironment()

    useEffect(() => { setMobileMenuOpen(false) }, [pathname])

    return (
        <div className="min-h-screen bg-canvas">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-30 bg-surface border-b border-border shadow-nav">
                <div className="flex items-center justify-between px-6 h-16">
                    {/* Logo + Nav */}
                    <div className="flex items-center gap-4">
                        <div className="border border-border-strong rounded-full px-4 py-1.5 shrink-0">
                            <span className="font-semibold text-ui-sm text-ink">AAZIFY FBR</span>
                        </div>
                        <nav className="hidden lg:flex items-center gap-1">
                            {navItems.map((item) => {
                                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`px-3 py-1.5 rounded-full text-ui-xs font-medium transition-colors duration-150 ${active
                                            ? 'bg-primary text-white'
                                            : 'text-ink-secondary hover:text-ink hover:bg-surface'
                                            }`}
                                    >
                                        {item.label}
                                    </Link>
                                )
                            })}
                        </nav>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-2">
                        <span className="hidden sm:block text-ui-xs text-muted mr-1">
                            {session?.user?.name || ''}
                        </span>
                        <button
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="hidden sm:flex items-center gap-1.5 border border-border rounded-full px-3 py-1.5 text-ui-xs text-ink bg-white hover:bg-surface transition-colors"
                        >
                            Sign Out
                        </button>
                        <div className="w-8 h-8 rounded-full bg-subtle/50 flex items-center justify-center">
                            <User size={15} className="text-muted" />
                        </div>
                        <button
                            className="flex lg:hidden h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-canvas transition-colors"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Nav Dropdown */}
                {mobileMenuOpen && (
                    <div className="lg:hidden border-t border-border bg-surface px-4 py-3">
                        <nav className="flex flex-col gap-1">
                            {navItems.map((item) => {
                                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${active
                                            ? 'bg-primary text-white'
                                            : 'text-ink-secondary hover:bg-surface hover:text-ink'
                                            }`}
                                    >
                                        {item.label}
                                    </Link>
                                )
                            })}
                            <button
                                onClick={() => signOut({ callbackUrl: '/login' })}
                                className="mt-2 px-4 py-2.5 rounded-xl text-sm font-medium text-ink-secondary hover:bg-canvas hover:text-ink text-left transition-colors"
                            >
                                Sign Out
                            </button>
                        </nav>
                    </div>
                )}
            </header>

            {/* Environment banner */}
            {environment && (
                <div
                    className={`text-xs font-semibold text-center py-2 ${environment === 'SANDBOX'
                        ? 'bg-accent-light text-warning'
                        : 'bg-success-bg text-success'
                        }`}
                    style={{ letterSpacing: '0.10em' }}
                >
                    {environment === 'SANDBOX' ? 'SANDBOX MODE — Test submissions only' : 'LIVE MODE — Production submissions enabled'}
                </div>
            )}

            {/* Page content */}
            <main className="min-h-[calc(100vh-64px)]">
                {children}
            </main>
        </div>
    )
}
