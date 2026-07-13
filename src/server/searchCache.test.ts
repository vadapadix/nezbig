import { describe, expect, it } from "vitest";
import { MemoryTtlCache } from "./searchCache.js";

describe("MemoryTtlCache", () => {
  it("distinguishes a cached undefined value from a cache miss", () => {
    const cache = new MemoryTtlCache<string | undefined>(1000);

    cache.set("unavailable-page", undefined);

    expect(cache.has("unavailable-page")).toBe(true);
    expect(cache.get("unavailable-page")).toBeUndefined();
    expect(cache.has("missing-page")).toBe(false);
  });
});
