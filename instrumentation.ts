export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') {
        return
    }

    const { ensureFBRWorkerStarted } = await import('@/lib/fbr/queue')
    await ensureFBRWorkerStarted()
}