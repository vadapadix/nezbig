export class ProviderCircuitBreaker {
    failureThreshold;
    cooldownMs;
    now;
    states = new Map();
    constructor(failureThreshold = 3, cooldownMs = 60_000, now = Date.now) {
        this.failureThreshold = failureThreshold;
        this.cooldownMs = cooldownMs;
        this.now = now;
    }
    canRequest(provider) {
        const state = this.states.get(provider);
        if (!state)
            return true;
        if (state.openUntil === 0)
            return true;
        if (state.openUntil <= this.now()) {
            this.states.delete(provider);
            return true;
        }
        return false;
    }
    recordSuccess(provider) {
        this.states.delete(provider);
    }
    recordFailure(provider) {
        const current = this.states.get(provider) ?? { consecutiveFailures: 0, openUntil: 0 };
        const consecutiveFailures = current.consecutiveFailures + 1;
        this.states.set(provider, {
            consecutiveFailures,
            openUntil: consecutiveFailures >= this.failureThreshold ? this.now() + this.cooldownMs : 0
        });
    }
}
