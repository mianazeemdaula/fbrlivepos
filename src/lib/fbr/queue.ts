import { EventEmitter } from 'node:events'
import { Socket } from 'node:net'
import { Job, Queue, Worker } from 'bullmq'
import { getDIClientForTenant, DIAuthError, DIConfigError, isDIPermanentError } from '@/lib/di/client'
import { prisma } from '@/lib/db/prisma'
import { buildDIPayload } from '@/lib/di/payload-builder'
import { SCENARIO_DESCRIPTIONS, getRequiredScenarios } from '@/lib/di/scenarios'
import { recordFBRSubmissionLog, stringifyError, updateInvoiceForTenant } from './submission-log'

type SubmissionJobData = {
    tenantId: string
    invoiceId: string
}

type TenantQueueStats = {
    waiting: number
    active: number
    failed: number
}

type GlobalQueueStats = TenantQueueStats & {
    delayed: number
}

type QueueEventJob = {
    id: string
    data: SubmissionJobData
}

type QueueEventMap = {
    ready: []
    completed: [QueueEventJob]
    failed: [QueueEventJob | undefined, Error]
}

export interface FbrWorkerHandle {
    on<EventName extends keyof QueueEventMap>(event: EventName, listener: (...args: QueueEventMap[EventName]) => void): this
    close(): Promise<void>
}

type FbrWorkerGlobalState = {
    promise: Promise<FbrWorkerHandle> | null
    handle: FbrWorkerHandle | null
    shutdownRegistered: boolean
}

const REDIS_QUEUE_NAME = 'fbr-submissions'
const MAX_ATTEMPTS = 10
const BACKOFF_DELAY_MS = 5_000
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false'
const REDIS_READY_TIMEOUT_MS = Number(process.env.REDIS_READY_TIMEOUT_MS ?? 500)
const REDIS_RECHECK_MS = Number(process.env.REDIS_RECHECK_MS ?? 30_000)
const DB_QUEUE_POLL_MS = Number(process.env.FBR_DB_QUEUE_POLL_MS ?? 5_000)
const DB_QUEUE_CONCURRENCY = Number(process.env.FBR_DB_QUEUE_CONCURRENCY ?? 5)

const connection = {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
}

let redisQueue: Queue<SubmissionJobData> | null = null
let redisState: { status: 'unknown' | 'available' | 'unavailable'; checkedAt: number } = {
    status: REDIS_ENABLED ? 'unknown' : 'unavailable',
    checkedAt: 0,
}
let lastRedisWarningAt = 0

function getWorkerGlobalState(): FbrWorkerGlobalState {
    const globalScope = globalThis as typeof globalThis & {
        __fbrWorkerState__?: FbrWorkerGlobalState
    }

    if (!globalScope.__fbrWorkerState__) {
        globalScope.__fbrWorkerState__ = {
            promise: null,
            handle: null,
            shutdownRegistered: false,
        }
    }

    return globalScope.__fbrWorkerState__
}

function registerWorkerShutdown(handle: FbrWorkerHandle) {
    const state = getWorkerGlobalState()
    if (state.shutdownRegistered) {
        return
    }

    state.shutdownRegistered = true

    const closeWorker = async () => {
        const currentState = getWorkerGlobalState()
        const activeHandle = currentState.handle
        currentState.promise = null
        currentState.handle = null

        if (activeHandle) {
            await activeHandle.close().catch(() => undefined)
        }
    }

    process.once('SIGTERM', () => {
        void closeWorker().finally(() => process.exit(0))
    })

    process.once('SIGINT', () => {
        void closeWorker().finally(() => process.exit(0))
    })
}

function getBackoffDelayMs(failedAttempts: number) {
    return BACKOFF_DELAY_MS * 2 ** Math.max(0, failedAttempts - 1)
}

function getJobId({ tenantId, invoiceId }: SubmissionJobData) {
    return `tenant:${tenantId}:inv:${invoiceId}`
}

function getRedisWarning(error: unknown) {
    return `FBR queue Redis unavailable, falling back to database queue: ${stringifyError(error)}`
}

function getOrCreateRedisQueue() {
    if (!redisQueue) {
        redisQueue = new Queue<SubmissionJobData>(REDIS_QUEUE_NAME, {
            connection,
            defaultJobOptions: {
                attempts: MAX_ATTEMPTS,
                backoff: { type: 'exponential', delay: BACKOFF_DELAY_MS },
                removeOnComplete: { count: 5000 },
                removeOnFail: { count: 2000 },
            },
        })
    }

    return redisQueue
}

function noteRedisUnavailable(error: unknown) {
    redisState = { status: 'unavailable', checkedAt: Date.now() }

    if (redisQueue) {
        const queue = redisQueue
        redisQueue = null
        void queue.close().catch(() => undefined)
    }

    if (Date.now() - lastRedisWarningAt >= REDIS_RECHECK_MS) {
        lastRedisWarningAt = Date.now()
        console.warn(getRedisWarning(error))
    }
}

async function canReachRedisPort() {
    return await new Promise<boolean>((resolve) => {
        const socket = new Socket()
        let settled = false

        const finish = (reachable: boolean) => {
            if (settled) {
                return
            }

            settled = true
            socket.destroy()
            resolve(reachable)
        }

        socket.setTimeout(REDIS_READY_TIMEOUT_MS)
        socket.once('connect', () => finish(true))
        socket.once('timeout', () => finish(false))
        socket.once('error', () => finish(false))
        socket.connect(connection.port, connection.host)
    })
}

async function getRedisQueue(): Promise<Queue<SubmissionJobData> | null> {
    if (!REDIS_ENABLED) {
        return null
    }

    const now = Date.now()
    if (redisState.status === 'unavailable' && now - redisState.checkedAt < REDIS_RECHECK_MS) {
        return null
    }

    try {
        const isReachable = await canReachRedisPort()
        if (!isReachable) {
            noteRedisUnavailable(new Error(`Redis is not reachable at ${connection.host}:${connection.port}`))
            return null
        }

        const queue = getOrCreateRedisQueue()
        await Promise.race([
            queue.waitUntilReady(),
            new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Redis readiness timed out')), REDIS_READY_TIMEOUT_MS)
            }),
        ])

        redisState = { status: 'available', checkedAt: now }
        return queue
    } catch (error) {
        noteRedisUnavailable(error)
        return null
    }
}

async function markInvoiceQueued(tenantId: string, invoiceId: string, queuedAt = new Date()) {
    await updateInvoiceForTenant(tenantId, invoiceId, {
        status: 'QUEUED',
        queuedAt,
    })
}

export async function enqueueInvoiceSubmission(tenantId: string, invoiceId: string, scenarioId?: string) {
    // Persist scenarioId on the invoice so the worker can include it in the PRAL payload
    if (scenarioId) {
        await prisma.invoice.updateMany({
            where: { id: invoiceId, tenantId },
            data: { diScenarioId: scenarioId },
        })
    }

    const jobData = { tenantId, invoiceId }
    const queue = await getRedisQueue()

    if (queue) {
        try {
            await queue.add('submit', jobData, {
                jobId: getJobId(jobData),
                priority: 1,
            })

            await markInvoiceQueued(tenantId, invoiceId)
            return { backend: 'redis' as const }
        } catch (error) {
            noteRedisUnavailable(error)
        }
    }

    await markInvoiceQueued(tenantId, invoiceId)
    return { backend: 'database' as const }
}

async function getDatabaseQueueStatsForTenant(tenantId: string): Promise<TenantQueueStats> {
    const now = new Date()
    const [waiting, failed] = await Promise.all([
        prisma.invoice.count({
            where: {
                tenantId,
                status: 'QUEUED',
                OR: [{ queuedAt: null }, { queuedAt: { lte: now } }],
            },
        }),
        prisma.invoice.count({
            where: {
                tenantId,
                status: 'FAILED',
            },
        }),
    ])

    return {
        waiting,
        active: 0,
        failed,
    }
}

async function getDatabaseQueueStats(): Promise<GlobalQueueStats> {
    const now = new Date()
    const [waiting, delayed, failed] = await Promise.all([
        prisma.invoice.count({
            where: {
                status: 'QUEUED',
                OR: [{ queuedAt: null }, { queuedAt: { lte: now } }],
            },
        }),
        prisma.invoice.count({
            where: {
                status: 'QUEUED',
                queuedAt: { gt: now },
            },
        }),
        prisma.invoice.count({
            where: {
                status: 'FAILED',
            },
        }),
    ])

    return {
        waiting,
        active: 0,
        failed,
        delayed,
    }
}

export async function getQueueStatsForTenant(tenantId: string): Promise<TenantQueueStats> {
    const queue = await getRedisQueue()

    if (!queue) {
        return getDatabaseQueueStatsForTenant(tenantId)
    }

    try {
        const [jobs, activeJobs] = await Promise.all([
            queue.getJobs(['waiting', 'active', 'delayed', 'failed']),
            queue.getActive(),
        ])
        const tenantJobs = jobs.filter((job) => job.data?.tenantId === tenantId)

        return {
            waiting: tenantJobs.filter((job) => !job.failedReason).length,
            active: activeJobs.filter((job) => job.data?.tenantId === tenantId).length,
            failed: tenantJobs.filter((job) => job.failedReason).length,
        }
    } catch (error) {
        noteRedisUnavailable(error)
        return getDatabaseQueueStatsForTenant(tenantId)
    }
}

export async function getGlobalQueueStats(): Promise<GlobalQueueStats> {
    const queue = await getRedisQueue()

    if (!queue) {
        return getDatabaseQueueStats()
    }

    try {
        return await queue.getJobCounts('waiting', 'active', 'failed', 'delayed') as GlobalQueueStats
    } catch (error) {
        noteRedisUnavailable(error)
        return getDatabaseQueueStats()
    }
}

async function processSubmissionJob(jobData: SubmissionJobData, attemptsMade: number) {
    const { tenantId, invoiceId } = jobData

    const invoice = await prisma.invoice.findFirstOrThrow({
        where: { id: invoiceId, tenantId },
        include: { items: true, tenant: { include: { diCredentials: true } } },
    })
    console.log(`Processing submission job for tenant ${tenantId}, invoice ${invoiceId}, attempt ${attemptsMade + 1}`)
    const creds = invoice.tenant.diCredentials
    if (!creds) {
        const errMsg = `No DI credentials configured for tenant ${tenantId}`
        await Promise.all([
            recordFBRSubmissionLog({
                tenantId,
                invoiceId,
                attempt: attemptsMade + 1,
                error: errMsg,
            }),
            updateInvoiceForTenant(tenantId, invoiceId, {
                status: 'FAILED',
                queuedAt: null,
                submissionError: errMsg,
                retryCount: attemptsMade + 1,
            }),
        ])
        // No credentials → permanent failure, do not retry
        return
    }

    const isSandbox = creds.environment === 'SANDBOX'

    let diClient: Awaited<ReturnType<typeof getDIClientForTenant>>
    try {
        diClient = await getDIClientForTenant(tenantId)
    } catch (error) {
        if (isDIPermanentError(error)) {
            await Promise.all([
                recordFBRSubmissionLog({
                    tenantId,
                    invoiceId,
                    attempt: attemptsMade + 1,
                    error,
                }),
                updateInvoiceForTenant(tenantId, invoiceId, {
                    status: 'FAILED',
                    queuedAt: null,
                    submissionError: stringifyError(error),
                    retryCount: attemptsMade + 1,
                }),
            ])
            return
        }
        throw error
    }

    // Build payload — pass isSandbox so scenarioId is included for sandbox submissions
    const payload = buildDIPayload(invoice, creds, {
        isSandbox,
        scenarioId: invoice.diScenarioId ?? undefined,
        preferredIdType: invoice.tenant.preferredIdType === 'CNIC' ? 'CNIC' : 'NTN',
    })

    const start = Date.now()

    // Step 1: Pre-validate before submitting (per PRAL DI integration guide Phase 6)
    let validation: Awaited<ReturnType<typeof diClient.validateInvoice>>
    try {
        validation = await diClient.validateInvoice(payload)
    } catch (error) {
        const isPermanent = isDIPermanentError(error)
        await Promise.all([
            recordFBRSubmissionLog({
                tenantId,
                invoiceId,
                attempt: attemptsMade + 1,
                requestBody: payload,
                responseCode: error instanceof DIAuthError ? 401 : undefined,
                error,
                durationMs: Date.now() - start,
            }),
            updateInvoiceForTenant(tenantId, invoiceId, {
                ...(isPermanent ? { status: 'FAILED' as const, queuedAt: null } : {}),
                submissionError: stringifyError(error),
                retryCount: attemptsMade + 1,
            }),
        ])
        // Permanent errors (auth/config) should NOT be retried
        if (isPermanent) return
        throw error
    }

    // Step 2: If validation fails, mark invoice permanently FAILED — do not retry
    if (validation.validationResponse?.statusCode === '01') {
        const errMsg = validation.validationResponse.error ?? 'PRAL DI validation failed'
        await Promise.all([
            updateInvoiceForTenant(tenantId, invoiceId, {
                status: 'FAILED',
                diStatusCode: validation.validationResponse.statusCode,
                diStatus: validation.validationResponse.status,
                diItemStatuses: validation.validationResponse.invoiceStatuses as object ?? undefined,
                diErrorCode: validation.validationResponse.errorCode ?? null,
                diErrorMessage: errMsg,
                retryCount: attemptsMade,
                queuedAt: null,
                submissionError: errMsg,
            }),
            recordFBRSubmissionLog({
                tenantId,
                invoiceId,
                attempt: attemptsMade + 1,
                requestBody: payload,
                responseCode: 422,
                responseBody: validation,
                durationMs: Date.now() - start,
            }),
        ])
        // Return without throwing — validation errors are permanent, not retryable
        return
    }

    // Step 3: Submit validated invoice to PRAL
    try {
        const response = await diClient.postInvoice(payload)
        const isValid = response.validationResponse?.statusCode === '00'

        await Promise.all([
            updateInvoiceForTenant(tenantId, invoiceId, {
                status: isValid ? 'SUBMITTED' : 'FAILED',
                diInvoiceNumber: response.invoiceNumber ?? null,
                diInvoiceDate: response.dated ? new Date(response.dated) : null,
                diStatusCode: response.validationResponse?.statusCode ?? null,
                diStatus: response.validationResponse?.status ?? null,
                diItemStatuses: response.validationResponse?.invoiceStatuses as object ?? undefined,
                diErrorCode: response.validationResponse?.errorCode ?? null,
                diErrorMessage: response.validationResponse?.error ?? null,
                retryCount: attemptsMade,
                queuedAt: null,
                submissionError: null,
                qrCodeData: response.invoiceNumber ?? null,
            }),
            recordFBRSubmissionLog({
                tenantId,
                invoiceId,
                attempt: attemptsMade + 1,
                requestBody: payload,
                responseCode: 200,
                responseBody: response,
                durationMs: Date.now() - start,
            }),
        ])

        // Step 4: Update sandbox scenario tracking on success
        if (isSandbox && isValid && invoice.diScenarioId) {
            const scenarioId = invoice.diScenarioId
            await prisma.sandboxScenario.upsert({
                where: { tenantId_scenarioId: { tenantId, scenarioId } },
                create: {
                    tenantId,
                    scenarioId,
                    description: SCENARIO_DESCRIPTIONS[scenarioId] ?? scenarioId,
                    status: 'PASSED',
                    completedAt: new Date(),
                    invoiceNo: response.invoiceNumber,
                },
                update: {
                    status: 'PASSED',
                    completedAt: new Date(),
                    invoiceNo: response.invoiceNumber,
                },
            })
            await checkAndUpdateSandboxCompletion(tenantId)
        }

        if (!isValid) {
            throw new Error(`DI post failed after validation: ${response.validationResponse?.error ?? 'Unknown error'}`)
        }
    } catch (error) {
        const isPermanent = isDIPermanentError(error)
        await Promise.all([
            recordFBRSubmissionLog({
                tenantId,
                invoiceId,
                attempt: attemptsMade + 1,
                requestBody: payload,
                responseCode: error instanceof DIAuthError ? 401 : undefined,
                error,
                durationMs: Date.now() - start,
            }),
            updateInvoiceForTenant(tenantId, invoiceId, {
                ...(isPermanent ? { status: 'FAILED' as const, queuedAt: null } : {}),
                submissionError: stringifyError(error),
                retryCount: attemptsMade + 1,
            }),
        ])
        // Permanent errors (auth/config) should NOT be retried
        if (isPermanent) return
        throw error
    }
}

async function checkAndUpdateSandboxCompletion(tenantId: string) {
    const creds = await prisma.dICredentials.findUniqueOrThrow({ where: { tenantId } })
    const requiredScenarios = getRequiredScenarios(creds.businessActivity, creds.sector)
    const passedCount = await prisma.sandboxScenario.count({
        where: { tenantId, status: 'PASSED' },
    })
    if (passedCount >= requiredScenarios.length) {
        await prisma.dICredentials.update({
            where: { tenantId },
            data: {
                sandboxCompleted: true,
                sandboxCompletedAt: new Date(),
                irisRegistrationStatus: 'PRODUCTION_READY',
            },
        })
    }
}

class DatabaseQueueWorker extends EventEmitter implements FbrWorkerHandle {
    private interval: NodeJS.Timeout | null = null
    private inFlightJobs = new Map<string, Promise<void>>()
    private closed = false

    constructor() {
        super()

        queueMicrotask(() => {
            this.emit('ready')
            void this.poll()
            this.interval = setInterval(() => {
                void this.poll()
            }, DB_QUEUE_POLL_MS)
        })
    }

    override on<EventName extends keyof QueueEventMap>(event: EventName, listener: (...args: QueueEventMap[EventName]) => void): this {
        return super.on(event, listener)
    }

    async close() {
        this.closed = true

        if (this.interval) {
            clearInterval(this.interval)
            this.interval = null
        }

        await Promise.allSettled(this.inFlightJobs.values())
    }

    private async poll() {
        if (this.closed) {
            return
        }

        const availableSlots = DB_QUEUE_CONCURRENCY - this.inFlightJobs.size
        if (availableSlots <= 0) {
            return
        }

        try {
            const jobs = await prisma.invoice.findMany({
                where: {
                    status: 'QUEUED',
                    OR: [{ queuedAt: null }, { queuedAt: { lte: new Date() } }],
                },
                select: {
                    id: true,
                    tenantId: true,
                    retryCount: true,
                },
                orderBy: [{ queuedAt: 'asc' }, { createdAt: 'asc' }],
                take: availableSlots,
            })

            for (const job of jobs) {
                if (this.inFlightJobs.has(job.id)) {
                    continue
                }

                const task = this.runJob(job).finally(() => {
                    this.inFlightJobs.delete(job.id)
                })
                this.inFlightJobs.set(job.id, task)
            }
        } catch (error) {
            console.error('Database queue polling failed', stringifyError(error))
        }
    }

    private async runJob(job: { id: string; tenantId: string; retryCount: number }) {
        const jobData: SubmissionJobData = {
            tenantId: job.tenantId,
            invoiceId: job.id,
        }

        try {
            await processSubmissionJob(jobData, job.retryCount)
            this.emit('completed', { id: getJobId(jobData), data: jobData })
        } catch (error) {
            const failedAttempts = job.retryCount + 1

            if (failedAttempts >= MAX_ATTEMPTS) {
                await updateInvoiceForTenant(job.tenantId, job.id, {
                    status: 'FAILED',
                    queuedAt: null,
                }).catch(() => undefined)
            } else {
                await markInvoiceQueued(job.tenantId, job.id, new Date(Date.now() + getBackoffDelayMs(failedAttempts))).catch(() => undefined)
            }

            const normalizedError = error instanceof Error ? error : new Error(stringifyError(error))
            this.emit('failed', { id: getJobId(jobData), data: jobData }, normalizedError)
        }
    }
}

function createRedisWorker(): FbrWorkerHandle {
    const worker = new Worker<SubmissionJobData>(
        REDIS_QUEUE_NAME,
        async (job: Job<SubmissionJobData>) => {
            await processSubmissionJob(job.data, job.attemptsMade)
        },
        {
            connection,
            concurrency: 10,
        },
    )

    worker.on('error', (error) => {
        noteRedisUnavailable(error)
    })

    worker.on('failed', async (job) => {
        if (!job) {
            return
        }

        const maxAttempts = job.opts.attempts ?? MAX_ATTEMPTS
        if (job.attemptsMade >= maxAttempts) {
            await updateInvoiceForTenant(job.data.tenantId, job.data.invoiceId, {
                status: 'FAILED',
                queuedAt: null,
            }).catch(() => undefined)
        }
    })

    return worker as unknown as FbrWorkerHandle
}

export async function startFBRWorker(): Promise<FbrWorkerHandle> {
    const queue = await getRedisQueue()

    if (queue) {
        return createRedisWorker()
    }

    return new DatabaseQueueWorker()
}

export function ensureFBRWorkerStarted() {
    const state = getWorkerGlobalState()
    if (!state.promise) {
        state.promise = startFBRWorker()
            .then((handle) => {
                state.handle = handle
                registerWorkerShutdown(handle)
                return handle
            })
            .catch((error) => {
                state.promise = null
                state.handle = null
                throw error
            })
    }

    return state.promise
}