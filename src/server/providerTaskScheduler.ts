type ProviderQueue = {
  active: number;
  waiters: Array<() => void>;
};

export class ProviderTaskScheduler {
  private readonly queues = new Map<string, ProviderQueue>();

  constructor(private readonly maxConcurrentPerProvider = 3) {}

  async run<T>(provider: string, task: () => Promise<T>): Promise<T> {
    await this.acquire(provider);
    try {
      return await task();
    } finally {
      this.release(provider);
    }
  }

  private async acquire(provider: string): Promise<void> {
    const queue = this.queues.get(provider) ?? { active: 0, waiters: [] };
    this.queues.set(provider, queue);
    if (queue.active < this.maxConcurrentPerProvider) {
      queue.active += 1;
      return;
    }

    await new Promise<void>((resolve) => queue.waiters.push(resolve));
  }

  private release(provider: string): void {
    const queue = this.queues.get(provider);
    if (!queue) return;
    const next = queue.waiters.shift();
    if (next) {
      next();
      return;
    }

    queue.active -= 1;
    if (queue.active === 0) this.queues.delete(provider);
  }
}
