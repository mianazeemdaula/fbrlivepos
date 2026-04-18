// BullMQ Worker — run as standalone: npx tsx workers/fbr-worker.ts
import { startFBRWorker } from '@/lib/fbr/queue'

type WorkerEventJob = {
    id: string
    data: {
        tenantId: string
        invoiceId: string
    }
}

async function main() {
    console.log('Starting DI submission worker...')
    const worker = await startFBRWorker()

    worker.on('ready', () => {
        console.log('DI worker ready, processing jobs...')
    })

    worker.on('completed', (job: WorkerEventJob) => {
        console.log(`Job ${job.id} completed for tenant ${job.data.tenantId}`)
    })

    worker.on('failed', (job: WorkerEventJob | undefined, err: Error) => {
        console.error(`Job ${job?.id} failed: ${err.message}`)
    })

    process.on('SIGTERM', async () => {
        console.log('SIGTERM received, shutting down worker...')
        await worker.close()
        process.exit(0)
    })

    process.on('SIGINT', async () => {
        console.log('SIGINT received, shutting down worker...')
        await worker.close()
        process.exit(0)
    })
}

void main().catch((error) => {
    console.error('Failed to start DI worker', error)
    process.exit(1)
})
