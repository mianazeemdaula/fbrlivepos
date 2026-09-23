import { CheckCircle2 } from 'lucide-react'
import { BrandLogo } from './site-header'

export const authInputClass =
    'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15'

export const authLabelClass = 'mb-1.5 block text-sm font-medium text-slate-700'

export const authButtonClass =
    'flex h-10 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60'

interface AuthShellProps {
    title: string
    subtitle: string
    points: string[]
    children: React.ReactNode
}

export default function AuthShell({ title, subtitle, points, children }: AuthShellProps) {
    return (
        <div className="grid min-h-screen bg-white lg:grid-cols-2">
            <div className="flex flex-col px-4 py-8 sm:px-10">
                <BrandLogo />
                <div className="flex flex-1 items-center justify-center py-10">
                    <div className="w-full max-w-sm">
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
                        <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
                        <div className="mt-8">{children}</div>
                    </div>
                </div>
            </div>

            <div className="hidden flex-col justify-center bg-slate-900 px-14 text-white lg:flex">
                <div className="max-w-md">
                    <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">FBR Digital Invoicing</p>
                    <h2 className="mt-3 text-2xl font-semibold leading-snug tracking-tight">
                        Submit compliant invoices to FBR in seconds.
                    </h2>
                    <ul className="mt-8 space-y-4">
                        {points.map((point) => (
                            <li key={point} className="flex items-start gap-3 text-sm text-slate-300">
                                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-400" />
                                {point}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    )
}
