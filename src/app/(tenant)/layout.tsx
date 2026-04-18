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
    { href: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function TenantLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { data: session } = useSession()

    return (
        <div className="min-h-screen bg-slate-950 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
                <div className="p-4 border-b border-slate-800">
                    <h1 className="text-lg font-bold text-white">PRAL DI POS</h1>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {session?.user?.name || 'Loading...'}
                    </p>
                </div>

                <nav className="flex-1 p-3 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                    ? 'bg-blue-600/20 text-blue-400'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                    }`}
                            >
                                <span>{item.icon}</span>
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>

                <div className="p-3 border-t border-slate-800">
                    <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                    >
                        <span>🚪</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    )
}
