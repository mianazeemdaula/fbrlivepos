import Link from 'next/link'
import { BrandLogo } from './site-header'

export default function SiteFooter() {
    return (
        <footer className="border-t border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-slate-500 sm:px-6 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                    <BrandLogo />
                    <p>FBR digital invoicing for Pakistani businesses.</p>
                </div>
                <div className="flex flex-col gap-2 md:items-end">
                    <div className="flex gap-5">
                        <Link href="/pricing" className="hover:text-slate-900">Pricing</Link>
                        <Link href="/login" className="hover:text-slate-900">Sign in</Link>
                        <Link href="/signup" className="hover:text-slate-900">Create account</Link>
                    </div>
                    <p>
                        Support:{' '}
                        <a href="tel:+923007395147" className="text-slate-700 hover:text-slate-900">+92 300 7395147</a>
                        {' · '}
                        <a href="tel:+923334103160" className="text-slate-700 hover:text-slate-900">+92 333 4103160</a>
                    </p>
                    <p className="text-xs text-slate-400">© {new Date().getFullYear()} FBR Live POS. All rights reserved.</p>
                </div>
            </div>
        </footer>
    )
}
