import type { CacheEntry } from "../../types/searchCache.types.js";
export type { CacheEntry } from "../../types/searchCache.types.js";
import { kv } from "@vercel/kv";

export class MemoryTtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 300
  ) {}

  get(key: string): T | undefined {
    return this.getLiveEntry(key)?.value;
  }

  has(key: string): boolean {
    return this.getLiveEntry(key) !== undefined;
  }

  deleteMatching(predicate: (key: string, value: T) => boolean): void {
    for (const [key, entry] of this.entries) {
      if (predicate(key, entry.value)) this.remove(key);
    }
  }

  set(key: string, value: T, customTtlMs?: number): void {
    this.remove(key);
    if (this.entries.size >= this.maxEntries) {
      const firstKey = this.entries.keys().next().value as string | undefined;
      if (firstKey) this.remove(firstKey);
    }

    const ttl = customTtlMs ?? this.ttlMs;
    const timer = setTimeout(() => this.remove(key), ttl);
    timer.unref?.();
    this.entries.set(key, { expiresAt: Date.now() + ttl, value, timer });
  }

  private remove(key: string): void {
    const entry = this.entries.get(key);
    if (entry?.timer) clearTimeout(entry.timer);
    this.entries.delete(key);
  }

  private getLiveEntry(key: string): CacheEntry<T> | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt < Date.now()) {
      this.remove(key);
      return undefined;
    }

    return entry;
  }
}

export class DistributedCache<T> {
  private readonly memoryCache: MemoryTtlCache<T>;
  private readonly isKvEnabled: boolean;

  constructor(
    private readonly prefix: string,
    private readonly ttlMs: number,
    maxMemoryEntries = 300
  ) {
    this.memoryCache = new MemoryTtlCache<T>(ttlMs, maxMemoryEntries);
    this.isKvEnabled = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
  }

  async get(key: string): Promise<T | null | undefined> {
    const memVal = this.memoryCache.get(key);
    if (memVal !== undefined) return memVal;

    if (this.isKvEnabled) {
      try {
        // kv.get returns null if key doesn't exist. If we explicitly set null, it also returns null?
        // Actually, Vercel KV returns null if missing. So we can't distinguish missing from stored null easily unless we wrap it.
        // Let's just wrap it.
        const wrapped = await kv.get<{ value: T | null }>(`${this.prefix}:${key}`);
        if (wrapped !== null) {
          this.memoryCache.set(key, wrapped.value as any);
          return wrapped.value;
        }
      } catch (error) {
        console.warn(`[KV Cache] Error getting key ${key}:`, error);
      }
    }
    return undefined; // Not found
  }

  async set(key: string, value: T | null, customTtlMs?: number): Promise<void> {
    const ttl = customTtlMs ?? this.ttlMs;
    // We can update MemoryTtlCache to accept ttl or just create a new entry with explicit expiration.
    // For now, memoryCache.set uses this.ttlMs internally. Let's modify MemoryTtlCache to accept customTtlMs.
    this.memoryCache.set(key, value as any, customTtlMs);

    if (this.isKvEnabled) {
      try {
        await kv.set(`${this.prefix}:${key}`, { value }, { px: ttl });
      } catch (error) {
        console.warn(`[KV Cache] Error setting key ${key}:`, error);
      }
    }
  }
}
