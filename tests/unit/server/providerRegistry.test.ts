import { describe, expect, it, vi } from "vitest";
import { ProviderRegistry } from "../../../src/server/application/ai/ProviderRegistry.js";

describe("ProviderRegistry", () => {
  it("orders registered providers by explicit priority", () => {
    const primary = { id: "primary", label: "Primary", assess: vi.fn() };
    const fallback = { id: "fallback", label: "Fallback", assess: vi.fn() };
    const registry = new ProviderRegistry().register(fallback, 20).register(primary, 10);
    expect(registry.ordered()).toEqual([primary, fallback]);
  });
  it("rejects duplicate identifiers", () => {
    const provider = { id: "same", label: "Provider", assess: vi.fn() };
    expect(() => new ProviderRegistry().register(provider, 1).register(provider, 2)).toThrow("Duplicate provider");
  });
});
