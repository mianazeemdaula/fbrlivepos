import Link from 'next/link'
import { ReceiptText } from 'lucide-react'

export function BrandLogo({ className = '' }: { className?: string }) {
    return (
        <Link href="/" className={`inline-flex items-center gap-2 ${className}`}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                <ReceiptText size={16} />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-slate-900">FBR Live POS</span>
        </Link>
    )
}

export default function SiteHeader() {
    return (
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
                <BrandLogo />
                <nav className="flex items-center gap-1 text-sm sm:gap-2">
                    <Link href="/pricing" className="hidden rounded-md px-3 py-2 font-medium text-slate-600 transition hover:text-slate-900 sm:block">
                        Pricing
                    </Link>
                    <Link href="/login" className="rounded-md px-3 py-2 font-medium text-slate-600 transition hover:text-slate-900">
                        Sign in
                    </Link>
                    <Link href="/signup" className="rounded-lg bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark">
                        Get started
                    </Link>
                </nav>
            </div>
        </header>
    )
}
