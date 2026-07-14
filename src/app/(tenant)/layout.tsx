'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { User, Menu, X } from 'lucide-react'

const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/pos', label: 'POS Terminal' },
    { href: '/invoices', label: 'Invoices' },
    { href: '/invoices/report', label: 'Report' },
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
    const [config, setConfig] = useState<{ configured: boolean; environment: 'SANDBOX' | 'PRODUCTION' | null; hasProductionToken: boolean } | null>(null)
    const [switchingEnv, setSwitchingEnv] = useState(false)
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const loadConfig = () => {
        fetch('/api/tenant/fbr-credentials')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) {
                    setConfig({
                        configured: data.configured ?? false,
                        environment: data.environment ?? null,
                        hasProductionToken: data.hasProductionToken ?? false
                    })
                }
            })
            .catch(() => {})
    }

    useEffect(() => {
        loadConfig()
    }, [])

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000)
            return () => clearTimeout(timer)
        }
    }, [notification])

    const handleToggleEnvironment = async () => {
        if (!config || !config.configured || !config.environment) return
        
        const newEnv = config.environment === 'SANDBOX' ? 'PRODUCTION' : 'SANDBOX'
        
        if (newEnv === 'PRODUCTION' && !config.hasProductionToken) {
            setNotification({
                type: 'error',
                text: 'Add a production token in Settings before switching to Live mode.'
            })
            return
        }

        setSwitchingEnv(true)
        try {
            const res = await fetch('/api/tenant/fbr-credentials', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ environment: newEnv }),
            })
            
            if (res.ok) {
                setNotification({
                    type: 'success',
                    text: `Switched to ${newEnv === 'PRODUCTION' ? 'Live' : 'Sandbox'} mode.`
                })
                setConfig(prev => prev ? { ...prev, environment: newEnv } : null)
                
                // Reload the page to refresh all active queries/data/state in the page components
                setTimeout(() => {
                    window.location.reload()
                }, 800)
            } else {
                const data = await res.json()
                setNotification({
                    type: 'error',
                    text: data.error || 'Failed to switch environment.'
                })
            }
        } catch {
            setNotification({ type: 'error', text: 'Network error' })
        } finally {
            setSwitchingEnv(false)
        }
    }

    useEffect(() => { setMobileMenuOpen(false) }, [pathname])

    return (
        <div className="min-h-screen bg-canvas">
            {/* Notification Toast */}
            {notification && (
                <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className={`rounded-xl border px-4 py-3 text-xs font-medium shadow-lg max-w-sm flex items-center justify-between gap-3 ${
                        notification.type === 'success'
                            ? 'border-success-border bg-success-bg text-success'
                            : 'border-error-border bg-error-bg text-error'
                    }`}>
                        <span>{notification.text}</span>
                        <button onClick={() => setNotification(null)} className="hover:opacity-75">
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

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
                                const active = pathname === item.href ||
                                    (item.href !== '/invoices' && pathname.startsWith(item.href + '/'))
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
                        {/* Global Environment Switch */}
                        {config?.configured && config.environment && (
                            <div className="flex items-center gap-2 rounded-full border border-border bg-canvas px-3 py-1 shadow-sm mr-2 shrink-0">
                                <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${config.environment !== 'PRODUCTION' ? 'text-gold' : 'text-muted'}`}>
                                    Sandbox
                                </span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={config.environment === 'PRODUCTION'}
                                    disabled={switchingEnv}
                                    onClick={handleToggleEnvironment}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none disabled:opacity-50 ${config.environment === 'PRODUCTION' ? 'bg-primary' : 'bg-border-strong'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${config.environment === 'PRODUCTION' ? 'translate-x-4' : 'translate-x-0'}`} />
                                </button>
                                <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${config.environment === 'PRODUCTION' ? 'text-primary' : 'text-muted'}`}>
                                    Live
                                </span>
                            </div>
                        )}

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
                                const active = pathname === item.href ||
                                    (item.href !== '/invoices' && pathname.startsWith(item.href + '/'))
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
            {config?.environment && (
                <div
                    className={`text-xs font-semibold text-center py-2 ${config.environment === 'SANDBOX'
                        ? 'bg-accent-light text-warning'
                        : 'bg-success-bg text-success'
                        }`}
                    style={{ letterSpacing: '0.10em' }}
                >
                    {config.environment === 'SANDBOX' ? 'SANDBOX MODE — Test submissions only' : 'LIVE MODE — Production submissions enabled'}
                </div>
            )}

            {/* Page content */}
            <main className="min-h-[calc(100vh-64px)]">
                {children}
            </main>
        </div>
    )
}
