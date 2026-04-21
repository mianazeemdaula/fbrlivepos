'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

const navItems = [
    {
        href: '/super-admin',
        label: 'Overview',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
        ),
    },
    {
        href: '/super-admin/tenants',
        label: 'Tenants',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
        ),
    },
    {
        href: '/super-admin/subscriptions',
        label: 'Subscriptions',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
        ),
    },
    {
        href: '/super-admin/billing',
        label: 'Billing',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
        ),
    },
    {
        href: '/super-admin/hs-codes',
        label: 'HS Codes',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
        ),
    },
    {
        href: '/super-admin/feature-flags',
        label: 'Feature Flags',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
        ),
    },
    {
        href: '/super-admin/announcements',
        label: 'Announcements',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0" />
            </svg>
        ),
    },
    {
        href: '/super-admin/audit',
        label: 'Audit Log',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
        ),
    },
]

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { data: session } = useSession()

    return (
        <div className="app-shell flex min-h-screen">
            {/* Sidebar */}
            <aside className="app-sidebar flex w-64 shrink-0 flex-col">
                {/* Brand */}
                <div className="border-b border-white/10 px-5 py-5">
                    <div className="flex items-center gap-2.5 mb-0.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                        </div>
                        <span className="brand-heading text-sm font-semibold text-white">Platform Admin</span>
                    </div>
                    <p className="truncate pl-10 text-xs text-[#c1bcaf]">{session?.user?.email}</p>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
                    <p className="px-2 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-widest text-[#8d897d]">Management</p>
                    {navItems.slice(0, 4).map((item) => {
                        const isActive =
                            item.href === '/super-admin'
                                ? pathname === '/super-admin'
                                : pathname.startsWith(item.href)
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                                    ? 'app-nav-active'
                                    : 'text-[#c1bcaf] hover:bg-white/6 hover:text-white'
                                    }`}
                            >
                                <span className={isActive ? 'text-[#f0d9a0]' : 'text-[#8d897d]'}>{item.icon}</span>
                                {item.label}
                            </Link>
                        )
                    })}

                    <p className="px-2 pb-1.5 pt-3 text-xs font-semibold uppercase tracking-widest text-[#8d897d]">Platform</p>
                    {navItems.slice(4).map((item) => {
                        const isActive = pathname.startsWith(item.href)
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                                    ? 'app-nav-active'
                                    : 'text-[#c1bcaf] hover:bg-white/6 hover:text-white'
                                    }`}
                            >
                                <span className={isActive ? 'text-[#f0d9a0]' : 'text-[#8d897d]'}>{item.icon}</span>
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>

                {/* Footer */}
                <div className="space-y-0.5 border-t border-white/10 px-3 py-3">
                    <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#c1bcaf] transition-all hover:bg-white/6 hover:text-[#f0d9a0]"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="min-w-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_top_right,rgba(200,164,90,0.08),transparent_24%)]">
                {children}
            </main>
        </div>
    )
}

