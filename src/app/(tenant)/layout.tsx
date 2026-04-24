'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'

// Helper to fetch DI config
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
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/pos', label: 'POS Terminal', icon: '🖥️' },
    { href: '/invoices', label: 'Invoices', icon: '📄' },
    { href: '/products', label: 'Products', icon: '📦' },
    { href: '/customers', label: 'Customers', icon: '👥' },
    { href: '/hs-codes', label: 'HS Codes', icon: '🏷️' },
    { href: '/sandbox-scenarios', label: 'Sandbox Scenarios', icon: '🧪' },
    { href: '/onboarding', label: 'FBR Setup', icon: '🔑' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
]


export default function TenantLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { data: session } = useSession()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const environment = useTenantEnvironment()

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setSidebarOpen(false)
    }, [pathname])

    const sidebar = (
        <aside className={`app-sidebar flex w-72 shrink-0 flex-col`}>
            <div className="border-b border-white/10 p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="brand-heading text-xl font-bold text-[#f6f0e4]">FBR Live POS</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[#f0d9a0]">Tenant Workspace</p>
                    </div>
                    {/* Mobile close button */}
                    <button
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#c1bcaf] hover:bg-white/10 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    >
                        ✕
                    </button>
                </div>
                <p className="mt-2 truncate text-xs text-[#c1bcaf]">
                    {session?.user?.name || 'Loading...'}
                </p>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${isActive
                                ? 'app-nav-active'
                                : 'text-[#c1bcaf] hover:bg-white/6 hover:text-white'
                                }`}
                        >
                            <span>{item.icon}</span>
                            {item.label}
                        </Link>
                    )
                })}
            </nav>

            <div className="border-t border-white/10 p-3">
                <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#c1bcaf] transition-colors hover:bg-white/6 hover:text-[#f0d9a0]"
                >
                    <span>🚪</span>
                    Sign Out
                </button>
            </div>
        </aside>
    )

    return (
        <div className="app-shell flex h-screen overflow-hidden">
            {/* Desktop sidebar - sticky full height */}
            <div className="hidden lg:flex lg:h-screen lg:w-72 lg:shrink-0 lg:flex-col lg:sticky lg:top-0">
                {sidebar}
            </div>

            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setSidebarOpen(false)}
                    />
                    <div className="absolute left-0 top-0 flex h-full w-72 flex-col">
                        {sidebar}
                    </div>
                </div>
            )}

            {/* Main content */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {/* Mobile header */}
                <div className="flex h-14 items-center gap-3 border-b border-white/10 bg-[rgba(10,18,13,0.95)] px-4 lg:hidden">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-[#c1bcaf] hover:bg-white/10"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>
                    <span className="brand-heading text-lg font-bold text-[#f6f0e4]">FBR Live POS</span>
                </div>

                {/* Environment hint banner */}
                {environment && (
                    <div
                        className={`text-xs font-semibold text-center py-2 ${environment === 'SANDBOX' ? 'bg-yellow-500/20 text-yellow-700' : 'bg-green-500/20 text-green-700'}`}
                        style={{ letterSpacing: '0.12em' }}
                    >
                        {environment === 'SANDBOX' ? 'SANDBOX MODE — Test submissions only' : 'LIVE MODE — Production submissions enabled'}
                    </div>
                )}

                <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(200,164,90,0.08),transparent_24%)]">
                    {children}
                </main>
            </div>
        </div>
    )
}
