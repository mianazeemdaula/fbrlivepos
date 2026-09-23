'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { LogOut, Menu, Shield, User, X } from 'lucide-react'

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
            <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
                    {/* Logo + Nav */}
                    <div className="flex min-w-0 items-center gap-6">
                        <Link href="/super-admin" className="flex shrink-0 items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink text-white">
                                <Shield size={14} />
                            </span>
                            <span className="text-sm font-semibold tracking-tight text-ink">Platform Admin</span>
                        </Link>
                        <nav className="hidden items-center gap-0.5 xl:flex">
                            {navItems.map((item) => {
                                const active = item.exact
                                    ? pathname === item.href
                                    : pathname.startsWith(item.href)
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`rounded-md px-3 py-1.5 text-ui-xs font-medium transition-colors duration-150 ${active
                                            ? 'bg-primary-light text-primary-dark'
                                            : 'text-ink-secondary hover:bg-surface hover:text-ink'
                                            }`}
                                    >
                                        {item.label}
                                    </Link>
                                )
                            })}
                        </nav>
                    </div>

                    {/* Right side */}
                    <div className="flex shrink-0 items-center gap-3">
                        <div className="hidden items-center gap-2 sm:flex">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface">
                                <User size={14} className="text-muted" />
                            </span>
                            <span className="max-w-48 truncate text-ui-xs font-medium text-ink">
                                {session?.user?.email || ''}
                            </span>
                        </div>
                        <button
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-ui-xs font-medium text-muted transition-colors hover:bg-surface hover:text-ink sm:flex"
                        >
                            <LogOut size={14} />
                            Sign out
                        </button>
                        <button
                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface xl:hidden"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            aria-label="Toggle menu"
                        >
                            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                        </button>
                    </div>
                </div>

                {/* Mobile / tablet Nav Dropdown */}
                {mobileMenuOpen && (
                    <div className="border-t border-border bg-white px-4 py-3 xl:hidden">
                        <nav className="flex flex-col gap-0.5">
                            {navItems.map((item) => {
                                const active = item.exact
                                    ? pathname === item.href
                                    : pathname.startsWith(item.href)
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${active
                                            ? 'bg-primary-light text-primary-dark'
                                            : 'text-ink-secondary hover:bg-surface hover:text-ink'
                                            }`}
                                    >
                                        {item.label}
                                    </Link>
                                )
                            })}
                            <button
                                onClick={() => signOut({ callbackUrl: '/login' })}
                                className="mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-ink-secondary transition-colors hover:bg-surface hover:text-ink"
                            >
                                <LogOut size={15} />
                                Sign out
                            </button>
                        </nav>
                    </div>
                )}
            </header>

            {/* Page content */}
            <main className="mx-auto min-h-[calc(100vh-56px)] max-w-[1600px]">
                {children}
            </main>
        </div>
    )
}
