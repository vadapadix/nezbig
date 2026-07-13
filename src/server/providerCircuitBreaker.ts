type ProviderState = {
  consecutiveFailures: number;
  openUntil: number;
};

export class ProviderCircuitBreaker {
  private readonly states = new Map<string, ProviderState>();

  constructor(
    private readonly failureThreshold = 3,
    private readonly cooldownMs = 60_000,
    private readonly now: () => number = Date.now
  ) {}

  canRequest(provider: string): boolean {
    const state = this.states.get(provider);
    if (!state) return true;
    if (state.openUntil === 0) return true;
    if (state.openUntil <= this.now()) {
      this.states.delete(provider);
      return true;
    }
    return false;
  }

  recordSuccess(provider: string): void {
    this.states.delete(provider);
  }

  recordFailure(provider: string): void {
    const current = this.states.get(provider) ?? { consecutiveFailures: 0, openUntil: 0 };
    const consecutiveFailures = current.consecutiveFailures + 1;
    this.states.set(provider, {
      consecutiveFailures,
      openUntil: consecutiveFailures >= this.failureThreshold ? this.now() + this.cooldownMs : 0
    });
  }
}
