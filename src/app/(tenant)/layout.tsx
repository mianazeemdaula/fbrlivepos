'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useState, useEffect, useRef } from 'react'
import { ChevronDown, LogOut, Menu, ReceiptText, User, X } from 'lucide-react'

const navItems: Array<{ href: string; label: string; feature?: 'ledgerImport' }> = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/pos', label: 'POS Terminal' },
    { href: '/invoices', label: 'Invoices' },
    { href: '/invoices/report', label: 'Report' },
    { href: '/ledger-import', label: 'Ledger Import', feature: 'ledgerImport' as const },
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
    const [userMenuOpen, setUserMenuOpen] = useState(false)
    const userMenuRef = useRef<HTMLDivElement>(null)
    const [config, setConfig] = useState<{ configured: boolean; environment: 'SANDBOX' | 'PRODUCTION' | null; hasProductionToken: boolean; sandboxCompleted: boolean } | null>(null)
    const [switchingEnv, setSwitchingEnv] = useState(false)
    const [features, setFeatures] = useState<{ ledgerImport: boolean }>({ ledgerImport: false })
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [subscription, setSubscription] = useState<{
        allowed: boolean
        reason: string | null
        planName: string | null
        expiresAt: string | null
        daysLeft: number | null
        expiringSoon: boolean
    } | null>(null)

    const loadConfig = () => {
        fetch('/api/tenant/fbr-credentials')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) {
                    setConfig({
                        configured: data.configured ?? false,
                        environment: data.environment ?? null,
                        hasProductionToken: data.hasProductionToken ?? false,
                        sandboxCompleted: data.sandboxCompleted ?? false
                    })
                }
            })
            .catch(() => {})
    }

    useEffect(() => {
        loadConfig()
        fetch('/api/tenant/features')
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data) setFeatures({ ledgerImport: Boolean(data.ledgerImport) }) })
            .catch(() => {})
        fetch('/api/tenant/subscription')
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data) setSubscription(data) })
            .catch(() => {})
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

    const visibleNavItems = navItems.filter((item) => {
        if (item.href === '/onboarding' && config?.configured) {
            return false
        }
        if (item.href === '/sandbox-scenarios' && config?.sandboxCompleted) {
            return false
        }
        if (item.feature && !features[item.feature]) {
            return false
        }
        return true
    })

    useEffect(() => {
        setMobileMenuOpen(false)
        setUserMenuOpen(false)
    }, [pathname])

    // Close the user menu on outside click or Escape
    useEffect(() => {
        if (!userMenuOpen) return
        const onPointerDown = (e: MouseEvent) => {
            if (!userMenuRef.current?.contains(e.target as Node)) setUserMenuOpen(false)
        }
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setUserMenuOpen(false) }
        document.addEventListener('mousedown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('mousedown', onPointerDown)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [userMenuOpen])

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
            <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
                    {/* Logo + Nav */}
                    <div className="flex min-w-0 items-center gap-4 xl:gap-6">
                        <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white">
                                <ReceiptText size={15} />
                            </span>
                            <span className="hidden text-sm font-semibold tracking-tight text-ink min-[400px]:inline">AAZIFY FBR</span>
                        </Link>
                        <nav className="hidden min-w-0 items-center gap-0.5 xl:flex">
                            {visibleNavItems.map((item) => {
                                const active = pathname === item.href ||
                                    (item.href !== '/invoices' && pathname.startsWith(item.href + '/'))
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-ui-xs font-medium transition-colors duration-150 ${active
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
                    <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
                        {/* Global Environment Switch */}
                        {config?.configured && config.environment && (
                            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-subtle px-2 py-1 sm:gap-2 sm:px-2.5">
                                <span className={`text-[11px] font-medium transition-colors ${config.environment !== 'PRODUCTION' ? 'text-warning' : 'text-muted'}`}>
                                    Sandbox
                                </span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={config.environment === 'PRODUCTION'}
                                    aria-label="Toggle live mode"
                                    disabled={switchingEnv}
                                    onClick={handleToggleEnvironment}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none disabled:opacity-50 ${config.environment === 'PRODUCTION' ? 'bg-primary' : 'bg-border-strong'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${config.environment === 'PRODUCTION' ? 'translate-x-4' : 'translate-x-0'}`} />
                                </button>
                                <span className={`text-[11px] font-medium transition-colors ${config.environment === 'PRODUCTION' ? 'text-primary' : 'text-muted'}`}>
                                    Live
                                </span>
                            </div>
                        )}

                        {/* User menu */}
                        <div className="relative" ref={userMenuRef}>
                            <button
                                type="button"
                                onClick={() => setUserMenuOpen((open) => !open)}
                                aria-haspopup="menu"
                                aria-expanded={userMenuOpen}
                                aria-label="Account menu"
                                className="flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-surface sm:px-1.5"
                            >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface">
                                    <User size={14} className="text-muted" />
                                </span>
                                <span className="hidden max-w-40 truncate text-ui-xs font-medium text-ink sm:inline">
                                    {session?.user?.name || ''}
                                </span>
                                <ChevronDown size={14} className={`hidden text-muted transition-transform sm:block ${userMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {userMenuOpen && (
                                <div role="menu" className="absolute right-0 top-full z-40 mt-1.5 w-56 overflow-hidden rounded-xl border border-border bg-white py-1 shadow-lg">
                                    <div className="border-b border-border px-3.5 py-2.5">
                                        <p className="truncate text-xs font-semibold text-ink">{session?.user?.name || 'Account'}</p>
                                        {session?.user?.email && (
                                            <p className="truncate text-[11px] text-muted">{session.user.email}</p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => signOut({ callbackUrl: '/login' })}
                                        className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-ink-secondary transition-colors hover:bg-surface hover:text-ink"
                                    >
                                        <LogOut size={14} />
                                        Sign out
                                    </button>
                                </div>
                            )}
                        </div>
                        <button
                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface xl:hidden"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            aria-label="Toggle menu"
                        >
                            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Nav Dropdown */}
                {mobileMenuOpen && (
                    <div className="max-h-[calc(100vh-56px)] overflow-y-auto border-t border-border bg-white px-4 py-3 xl:hidden">
                        <nav className="grid gap-0.5 sm:grid-cols-2">
                            {visibleNavItems.map((item) => {
                                const active = pathname === item.href ||
                                    (item.href !== '/invoices' && pathname.startsWith(item.href + '/'))
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
                        </nav>
                    </div>
                )}
            </header>

            {/* Environment banner */}
            {config?.environment && (
                <div
                    className={`border-b px-4 py-1.5 text-center text-xs font-medium ${config.environment === 'SANDBOX'
                        ? 'border-amber-200 bg-warning-bg text-warning'
                        : 'border-success-border bg-success-bg text-success'
                        }`}
                >
                    {config.environment === 'SANDBOX' ? 'Sandbox mode — test submissions only' : 'Live mode — invoices are submitted to FBR'}
                </div>
            )}

            {/* Subscription banner */}
            {subscription && !subscription.allowed && (
                <div className="border-b border-error-border bg-error-bg px-4 py-2 text-center text-xs font-medium text-error">
                    {subscription.reason} New invoices and FBR submissions are paused. Call +92 300 7395147 to renew.
                </div>
            )}
            {subscription?.allowed && subscription.expiringSoon && subscription.expiresAt && (
                <div className="border-b border-amber-200 bg-warning-bg px-4 py-2 text-center text-xs font-medium text-warning">
                    Your {subscription.planName} plan expires {subscription.daysLeft && subscription.daysLeft > 1 ? `in ${subscription.daysLeft} days` : 'soon'} ({new Date(subscription.expiresAt).toLocaleDateString()}). Call +92 300 7395147 to renew.
                </div>
            )}

            {/* Page content */}
            <main className="mx-auto max-w-[1600px]">
                {children}
            </main>
        </div>
    )
}
