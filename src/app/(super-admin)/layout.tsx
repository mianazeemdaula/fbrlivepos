'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { User, Menu, X, Shield } from 'lucide-react'

const navItems = [
    { href: '/super-admin', label: 'Overview', exact: true },
    { href: '/super-admin/tenants', label: 'Tenants' },
    { href: '/super-admin/subscriptions', label: 'Subscriptions' },
    { href: '/super-admin/billing', label: 'Billing' },
    { href: '/super-admin/hs-codes', label: 'HS Codes' },
    { href: '/super-admin/feature-flags', label: 'Feature Flags' },
    { href: '/super-admin/announcements', label: 'Announcements' },
    { href: '/super-admin/audit', label: 'Audit Log' },
]

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { data: session } = useSession()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    useEffect(() => { setMobileMenuOpen(false) }, [pathname])

    return (
        <div className="min-h-screen bg-canvas">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-30 bg-surface border-b border-border shadow-nav">
                <div className="flex items-center justify-between px-6 h-16">
                    {/* Logo + Nav */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 border border-border-strong rounded-full px-4 py-1.5 shrink-0">
                            <Shield size={14} className="text-ink" />
                            <span className="font-semibold text-ui-sm text-ink">Platform Admin</span>
                        </div>
                        <nav className="hidden xl:flex items-center gap-1">
                            {navItems.map((item) => {
                                const active = item.exact
                                    ? pathname === item.href
                                    : pathname.startsWith(item.href)
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
                            {session?.user?.email || ''}
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
                            className="flex xl:hidden h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-canvas transition-colors"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                        </button>
                    </div>
                </div>

                {/* Mobile / tablet Nav Dropdown */}
                {mobileMenuOpen && (
                    <div className="xl:hidden border-t border-border bg-surface px-4 py-3">
                        <nav className="flex flex-col gap-1">
                            {navItems.map((item) => {
                                const active = item.exact
                                    ? pathname === item.href
                                    : pathname.startsWith(item.href)
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

            {/* Page content */}
            <main className="min-h-[calc(100vh-64px)]">
                {children}
            </main>
        </div>
    )
}
