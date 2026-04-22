import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

interface DIDebugLogEntry {
    tenantId: string
    event: string
    operation?: string
    environment?: 'SANDBOX' | 'PRODUCTION'
    endpoint?: string
    status?: number
    message?: string
    errorName?: string
    errorMessage?: string
    responseBody?: string
    payload?: unknown
    metadata?: Record<string, unknown>
}

const MAX_RESPONSE_BODY_LENGTH = 12_000

function truncate(value: string): string {
    if (value.length <= MAX_RESPONSE_BODY_LENGTH) {
        return value
    }

    return `${value.slice(0, MAX_RESPONSE_BODY_LENGTH)}...[truncated]`
}

export async function appendDIDebugLog(entry: DIDebugLogEntry): Promise<string> {
    const now = new Date()
    const day = now.toISOString().slice(0, 10)
    const timestamp = now.toISOString()

    const relativeDir = path.join('logs', 'di-debug', entry.tenantId)
    const absoluteDir = path.join(process.cwd(), relativeDir)
    const fileName = `${day}.jsonl`
    const absoluteFilePath = path.join(absoluteDir, fileName)
    const relativeFilePath = path.join(relativeDir, fileName)

    const responseBody = entry.responseBody == null
        ? undefined
        : truncate(entry.responseBody)

    const line = JSON.stringify({
        timestamp,
        ...entry,
        responseBody,
    })

    await mkdir(absoluteDir, { recursive: true })
    await appendFile(absoluteFilePath, `${line}\n`, 'utf8')

    return relativeFilePath
}
