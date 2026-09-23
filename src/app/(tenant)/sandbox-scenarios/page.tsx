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
        <div className="p-4 lg:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-page-title font-semibold tracking-tight text-ink">Sandbox Scenarios</h1>
                    <p className="mt-0.5 text-ui-xs text-muted">
                        Run PRAL DI sandbox cases outside Settings so testing has a dedicated page.
                    </p>
                </div>
                <Link
                    href="/settings"
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-subtle"
                >
                    Back to Settings
                </Link>
            </div>

            {loading ? (
                <div className="bg-white rounded-card shadow-card rounded-2xl p-6 text-sm text-muted">
                    Loading sandbox configuration...
                </div>
            ) : !config?.configured ? (
                <div className="rounded-xl border border-gold/30 bg-gold/10 p-6 text-sm text-muted">
                    Configure PRAL DI credentials in Settings before running sandbox scenarios.
                </div>
            ) : config.environment !== 'SANDBOX' ? (
                <div className="rounded-xl border border-primary/35 bg-primary/10 p-6 text-sm text-success">
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
