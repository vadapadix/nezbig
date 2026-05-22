type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export class MemoryTtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 300
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.entries.size >= this.maxEntries) {
      const firstKey = this.entries.keys().next().value as string | undefined;
      if (firstKey) this.entries.delete(firstKey);
    }

    this.entries.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      value
    });
  }
}
