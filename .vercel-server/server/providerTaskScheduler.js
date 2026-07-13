export class ProviderTaskScheduler {
    maxConcurrentPerProvider;
    queues = new Map();
    constructor(maxConcurrentPerProvider = 3) {
        this.maxConcurrentPerProvider = maxConcurrentPerProvider;
    }
    async run(provider, task) {
        await this.acquire(provider);
        try {
            return await task();
        }
        finally {
            this.release(provider);
        }
    }
    async acquire(provider) {
        const queue = this.queues.get(provider) ?? { active: 0, waiters: [] };
        this.queues.set(provider, queue);
        if (queue.active < this.maxConcurrentPerProvider) {
            queue.active += 1;
            return;
        }
        await new Promise((resolve) => queue.waiters.push(resolve));
    }
    release(provider) {
        const queue = this.queues.get(provider);
        if (!queue)
            return;
        const next = queue.waiters.shift();
        if (next) {
            next();
            return;
        }
        queue.active -= 1;
        if (queue.active === 0)
            this.queues.delete(provider);
    }
}
