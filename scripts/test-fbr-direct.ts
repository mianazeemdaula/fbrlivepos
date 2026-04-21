/**
 * Direct FBR PRAL DI API test — runs scenario-catalog payloads against sandbox endpoints.
 * Usage: npx tsx scripts/test-fbr-direct.ts
 */
import 'dotenv/config'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildSandboxScenarioPayload } from '../src/lib/di/scenario-catalog'

const TOKEN = process.env.PRAL_PLATFORM_TOKEN!
const VALIDATE_URL = 'https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb'
const POST_URL = 'https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb'
const DEFAULT_SCENARIOS = ['SN026', 'SN027', 'SN028'] as const
const LOG_ROOT = path.resolve(process.cwd(), 'logs', 'di-sandbox')

const SELLER = {
    sellerNTNCNIC: '3530118686639',
    sellerBusinessName: 'ALI PROTEIN FARM',
    sellerProvince: 'Punjab',
    sellerAddress: 'VILLAGE DHARMAIWALA 5-KM BASIRPUR ROAD',
}

type EndpointResult = {
    status: number
    statusText?: string
    headers?: Record<string, string>
    rawBody?: string
    json?: unknown
    error?: string
}

function sanitizeSegment(value: string) {
    return value.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()
}

async function ensureLogDir(scenarioId: string) {
    const dir = path.join(LOG_ROOT, sanitizeSegment(scenarioId))
    await mkdir(dir, { recursive: true })
    return dir
}

async function writeScenarioLog(scenarioId: string, name: string, payload: unknown) {
    const dir = await ensureLogDir(scenarioId)
    await writeFile(path.join(dir, name), JSON.stringify(payload, null, 2), 'utf8')
}

// ─── Helper: call endpoint ──────────────────────────────────────────────
async function callEndpoint(
    scenarioId: string,
    label: string,
    url: string,
    payload: Record<string, unknown>,
): Promise<EndpointResult> {
    console.log(`\n${'='.repeat(70)}`)
    console.log(`  ${label}`)
    console.log(`  URL: ${url}`)
    console.log(`${'='.repeat(70)}`)
    console.log('TOKEN:', TOKEN ? `${TOKEN.substring(0, 10)}...${TOKEN.substring(TOKEN.length - 6)}` : 'MISSING')
    console.log('TOKEN length:', TOKEN?.length)
    console.log('PAYLOAD:\n', JSON.stringify(payload, null, 2))

    await writeScenarioLog(scenarioId, `${sanitizeSegment(label)}-request.json`, payload)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${TOKEN}`,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        })
        clearTimeout(timer)

        console.log(`\nHTTP STATUS: ${res.status} ${res.statusText}`)
        console.log('RESPONSE HEADERS:')
        const headers = Object.fromEntries(res.headers.entries())
        res.headers.forEach((v, k) => console.log(`  ${k}: ${v}`))

        const text = await res.text()
        await writeScenarioLog(scenarioId, `${sanitizeSegment(label)}-response-raw.json`, {
            status: res.status,
            statusText: res.statusText,
            headers,
            body: text,
        })

        try {
            const json = JSON.parse(text)
            console.log('\nRESPONSE BODY (parsed):')
            console.log(JSON.stringify(json, null, 2))
            await writeScenarioLog(scenarioId, `${sanitizeSegment(label)}-response.json`, json)
            return { status: res.status, statusText: res.statusText, headers, rawBody: text, json }
        } catch (error) {
            console.log('\nRESPONSE BODY (raw, non-JSON):')
            console.log(text)
            return {
                status: res.status,
                statusText: res.statusText,
                headers,
                rawBody: text,
                error: error instanceof Error ? error.message : String(error),
            }
        }
    } catch (err: unknown) {
        clearTimeout(timer)
        console.error('\nFETCH ERROR:', err)
        return { status: 0, error: err instanceof Error ? err.message : String(err) }
    }
}

async function runScenario(scenarioId: string) {
    const payload = buildSandboxScenarioPayload(scenarioId, SELLER)
    await writeScenarioLog(scenarioId, 'payload.json', payload)

    const validation = await callEndpoint(
        scenarioId,
        `${scenarioId}: Validate`,
        VALIDATE_URL,
        payload as unknown as Record<string, unknown>,
    )

    const validationStatus = (validation.json as { validationResponse?: { statusCode?: string } } | undefined)
        ?.validationResponse?.statusCode

    if (validationStatus === '00') {
        const post = await callEndpoint(
            scenarioId,
            `${scenarioId}: Post`,
            POST_URL,
            payload as unknown as Record<string, unknown>,
        )

        return {
            scenarioId,
            validation,
            post,
            ok: ((post.json as { validationResponse?: { statusCode?: string } } | undefined)
                ?.validationResponse?.statusCode ?? validationStatus) === '00',
        }
    }

    return {
        scenarioId,
        validation,
        ok: false,
    }
}

function resolveScenarioIds() {
    const scenarioIds = process.argv
        .slice(2)
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean)

    return scenarioIds.length > 0 ? scenarioIds : [...DEFAULT_SCENARIOS]
}

// ─── Main ───────────────────────────────────────────────────────────────
async function main() {
    console.log('╔══════════════════════════════════════════════════════════════╗')
    console.log('║     PRAL DI Scenario Catalog Test — Sandbox                 ║')
    console.log('╚══════════════════════════════════════════════════════════════╝')

    if (!TOKEN) {
        console.error('ERROR: PRAL_PLATFORM_TOKEN not set in .env')
        process.exit(1)
    }

    await mkdir(LOG_ROOT, { recursive: true })

    console.log(`\nSeller: ${SELLER.sellerNTNCNIC} (${SELLER.sellerBusinessName})`)
    console.log(`Logs: ${LOG_ROOT}`)

    const summary = []
    const scenarioIds = resolveScenarioIds()

    for (const scenarioId of scenarioIds) {
        console.log(`\n\nRunning ${scenarioId}...`)
        const result = await runScenario(scenarioId)
        summary.push(result)
    }

    await writeScenarioLog('summary', 'required-scenarios-summary.json', summary)

    console.log('\n' + '='.repeat(70))
    console.log('  REQUIRED SCENARIO TESTS COMPLETE')
    console.log('='.repeat(70))
    console.log(JSON.stringify(summary, null, 2))
}

main().catch(console.error)
