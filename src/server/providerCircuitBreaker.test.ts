import { describe, expect, it } from "vitest";
import { ProviderCircuitBreaker } from "./providerCircuitBreaker.js";

describe("ProviderCircuitBreaker", () => {
  it("pauses a failing provider and retries it after the cooldown", () => {
    let now = 10_000;
    const breaker = new ProviderCircuitBreaker(2, 5000, () => now);

    expect(breaker.canRequest("DuckDuckGo")).toBe(true);
    breaker.recordFailure("DuckDuckGo");
    expect(breaker.canRequest("DuckDuckGo")).toBe(true);
    breaker.recordFailure("DuckDuckGo");
    expect(breaker.canRequest("DuckDuckGo")).toBe(false);

    now += 5001;
    expect(breaker.canRequest("DuckDuckGo")).toBe(true);
    breaker.recordSuccess("DuckDuckGo");
    expect(breaker.canRequest("DuckDuckGo")).toBe(true);
  });
});
