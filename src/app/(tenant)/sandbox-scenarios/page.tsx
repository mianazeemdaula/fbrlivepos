'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SandboxScenariosModal } from '../settings/SandboxScenariosModal'

interface DIConfig {
    configured: boolean
    businessActivity?: string
    sector?: string
    sellerProvince?: string
    environment?: string
    sandboxScenarios?: Array<{
        scenarioId: string
        description: string | null
        status: string
    }>
}

export default function SandboxScenariosPage() {
    const [config, setConfig] = useState<DIConfig | null>(null)
    const [loading, setLoading] = useState(true)

    async function loadConfig(options?: { showLoading?: boolean }) {
        if (options?.showLoading ?? true) {
            setLoading(true)
        }

        try {
            const res = await fetch('/api/tenant/fbr-credentials')
            if (res.ok) {
                const data = await res.json()
                setConfig(data)
            }
        } catch {
            // Ignore
        } finally {
            if (options?.showLoading ?? true) {
                setLoading(false)
            }
        }
    }

    useEffect(() => {
        void loadConfig({ showLoading: true })
    }, [])

    return (
        <div className="p-6 lg:p-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Testing</p>
                    <h1 className="brand-heading mt-2 text-3xl font-bold text-white">Sandbox Scenarios</h1>
                    <p className="mt-1 text-sm text-[#c1bcaf]">
                        Run PRAL DI sandbox cases outside Settings so testing has a dedicated page.
                    </p>
                </div>
                <Link
                    href="/settings"
                    className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-[#d8d0bf] transition-colors hover:bg-white/6 hover:text-white"
                >
                    Back to Settings
                </Link>
            </div>

            {loading ? (
                <div className="app-panel rounded-2xl p-6 text-sm text-[#c1bcaf]">
                    Loading sandbox configuration...
                </div>
            ) : !config?.configured ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm text-amber-300">
                    Configure PRAL DI credentials in Settings before running sandbox scenarios.
                </div>
            ) : config.environment !== 'SANDBOX' ? (
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-6 text-sm text-sky-300">
                    This tenant is currently set to Production. Switch the DI environment back to Sandbox in Settings if you want to run scenario tests.
                </div>
            ) : (
                <SandboxScenariosModal
                    embedded
                    diConfig={{
                        businessActivity: config.businessActivity,
                        sector: config.sector,
                        sellerProvince: config.sellerProvince,
                        sandboxScenarios: config.sandboxScenarios,
                    }}
                    onScenariosUpdated={() => void loadConfig({ showLoading: false })}
                />
            )}
        </div>
    )
}