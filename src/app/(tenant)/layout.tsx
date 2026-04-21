'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/pos', label: 'POS Terminal', icon: '🖥️' },
    { href: '/invoices', label: 'Invoices', icon: '📄' },
    { href: '/products', label: 'Products', icon: '📦' },
    { href: '/customers', label: 'Customers', icon: '👥' },
    { href: '/hs-codes', label: 'HS Codes', icon: '🏷️' },
    { href: '/sandbox-scenarios', label: 'Sandbox Scenarios', icon: '🧪' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function TenantLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { data: session } = useSession()

    return (
        <div className="app-shell flex min-h-screen">
            {/* Sidebar */}
            <aside className="app-sidebar flex w-72 flex-col">
                <div className="border-b border-white/10 p-5">
                    <p className="brand-heading text-xl font-bold text-[#f6f0e4]">FBR Live POS</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[#f0d9a0]">Tenant Workspace</p>
                    <p className="mt-2 truncate text-xs text-[#c1bcaf]">
                        {session?.user?.name || 'Loading...'}
                    </p>
                </div>

                <nav className="flex-1 space-y-1 p-3">
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

            {/* Main content */}
            <main className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top_right,rgba(200,164,90,0.08),transparent_24%)]">
                {children}
            </main>
        </div>
    )
}
