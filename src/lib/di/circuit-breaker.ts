type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

class TenantDICircuitBreaker {
    private state: State = 'CLOSED'
    private failureCount = 0
    private successCount = 0
    private nextAttempt = 0
    private readonly FAILURE_THRESHOLD = 5
    private readonly SUCCESS_THRESHOLD = 2
    // Shorter open timeout so a transient failure on cold deploy recovers quickly
    private readonly OPEN_TIMEOUT_MS = 10_000

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                throw new Error('DI_CIRCUIT_OPEN')
            }
            this.state = 'HALF_OPEN'
            this.successCount = 0
        }
        try {
            const result = await fn()
            this.onSuccess()
            return result
        } catch (err) {
            this.onFailure()
            throw err
        }
    }

    private onSuccess() {
        this.failureCount = 0
        if (this.state === 'HALF_OPEN') {
            if (++this.successCount >= this.SUCCESS_THRESHOLD) this.state = 'CLOSED'
        }
    }

    private onFailure() {
        if (++this.failureCount >= this.FAILURE_THRESHOLD || this.state === 'HALF_OPEN') {
            this.state = 'OPEN'
            this.nextAttempt = Date.now() + this.OPEN_TIMEOUT_MS
        }
    }

    getState() {
        // Auto-expire OPEN state so callers see HALF_OPEN after timeout
        if (this.state === 'OPEN' && Date.now() >= this.nextAttempt) {
            this.state = 'HALF_OPEN'
            this.successCount = 0
        }
        return {
            state: this.state,
            failureCount: this.failureCount,
            nextAttemptAt: this.state === 'OPEN' ? new Date(this.nextAttempt) : null,
        }
    }

    reset() {
        this.state = 'CLOSED'
        this.failureCount = 0
        this.successCount = 0
        this.nextAttempt = 0
    }
}

// Singleton registry — one breaker per tenant per server process
export class DICircuitBreakerRegistry {
    private static instance: DICircuitBreakerRegistry
    private breakers = new Map<string, TenantDICircuitBreaker>()

    static getInstance() {
        if (!this.instance) this.instance = new DICircuitBreakerRegistry()
        return this.instance
    }

    get(tenantId: string): TenantDICircuitBreaker {
        if (!this.breakers.has(tenantId)) {
            this.breakers.set(tenantId, new TenantDICircuitBreaker())
        }
        return this.breakers.get(tenantId)!
    }

    reset(tenantId: string) {
        this.breakers.get(tenantId)?.reset()
    }

    getAllStates() {
        const result: Record<string, ReturnType<TenantDICircuitBreaker['getState']>> = {}
        this.breakers.forEach((b, id) => {
            result[id] = b.getState()
        })
        return result
    }
}
