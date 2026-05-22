export class MemoryTtlCache {
    ttlMs;
    maxEntries;
    entries = new Map();
    constructor(ttlMs, maxEntries = 300) {
        this.ttlMs = ttlMs;
        this.maxEntries = maxEntries;
    }
    get(key) {
        const entry = this.entries.get(key);
        if (!entry)
            return undefined;
        if (entry.expiresAt < Date.now()) {
            this.entries.delete(key);
            return undefined;
        }
        return entry.value;
    }
    set(key, value) {
        if (this.entries.size >= this.maxEntries) {
            const firstKey = this.entries.keys().next().value;
            if (firstKey)
                this.entries.delete(firstKey);
        }
        this.entries.set(key, {
            expiresAt: Date.now() + this.ttlMs,
            value
        });
    }
}
