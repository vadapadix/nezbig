import { afterEach, describe, expect, it, vi } from "vitest";
import { hydrateSearchCandidatesDetailed, searchWebCandidatesDetailed } from "./webSearch.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("web search diagnostics", () => {
  it("caches unavailable pages and reports a negative-cache hit", async () => {
    const url = `https://unavailable-${crypto.randomUUID()}.example/page`;
    const fetchMock = vi.fn().mockResolvedValue(new Response("down", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const candidate = { title: "Unavailable", url, snippet: "A candidate page that cannot be read." };

    const first = await hydrateSearchCandidatesDetailed([candidate], 1);
    const second = await hydrateSearchCandidatesDetailed([candidate], 1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.diagnostics.pages).toMatchObject({ attempted: 1, verified: 0, unavailable: 1, negativeCacheHits: 0 });
    expect(second.diagnostics.pages).toMatchObject({ attempted: 0, verified: 0, unavailable: 1, negativeCacheHits: 1 });
  });

  it("reports provider success and missing optional credentials separately", async () => {
    const previousGoogleKey = process.env.GOOGLE_SEARCH_API_KEY;
    const previousGoogleCx = process.env.GOOGLE_SEARCH_ENGINE_ID;
    const previousBraveKey = process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.GOOGLE_SEARCH_API_KEY;
    delete process.env.GOOGLE_SEARCH_ENGINE_ID;
    delete process.env.BRAVE_SEARCH_API_KEY;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`
      <div class="result">
        <div class="result__title"><a href="https://example.com/source">Verified title</a></div>
        <div class="result__snippet">A sufficiently descriptive result snippet for the originality checker.</div>
      </div>
    `, { status: 200, headers: { "content-type": "text/html" } })));

    try {
      const result = await searchWebCandidatesDetailed(
        `A distinctive ${crypto.randomUUID()} academic phrase contains enough words for one exact search request`,
        5,
        false,
        { hydrateLimit: 0, queryLimit: 1 }
      );

      expect(result.candidates).toHaveLength(1);
      expect(result.diagnostics.providers.find((provider) => provider.provider === "DuckDuckGo")).toMatchObject({ attempted: 1, succeeded: 1, results: 1 });
      expect(result.diagnostics.providers.find((provider) => provider.provider === "Google")?.skippedReason).toMatch(/ключ/i);
      expect(result.diagnostics.providers.find((provider) => provider.provider === "Brave")?.skippedReason).toMatch(/ключ/i);
    } finally {
      if (previousGoogleKey === undefined) delete process.env.GOOGLE_SEARCH_API_KEY;
      else process.env.GOOGLE_SEARCH_API_KEY = previousGoogleKey;
      if (previousGoogleCx === undefined) delete process.env.GOOGLE_SEARCH_ENGINE_ID;
      else process.env.GOOGLE_SEARCH_ENGINE_ID = previousGoogleCx;
      if (previousBraveKey === undefined) delete process.env.BRAVE_SEARCH_API_KEY;
      else process.env.BRAVE_SEARCH_API_KEY = previousBraveKey;
    }
  });

  it("uses Brave Search when its optional key is configured", async () => {
    const previousBraveKey = process.env.BRAVE_SEARCH_API_KEY;
    process.env.BRAVE_SEARCH_API_KEY = "test-brave-key";
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      if (url.hostname === "api.search.brave.com") {
        return new Response(JSON.stringify({
          web: { results: [{ title: "Brave source", url: "https://brave.example/source", description: "Independent web index result with a descriptive text snippet." }] }
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("<html><body>No DuckDuckGo results</body></html>", { status: 200, headers: { "content-type": "text/html" } });
    }));

    try {
      const result = await searchWebCandidatesDetailed(
        `Another distinctive ${crypto.randomUUID()} academic phrase contains enough words for the provider request`,
        5,
        false,
        { hydrateLimit: 0, queryLimit: 1 }
      );

      expect(result.candidates.some((candidate) => candidate.provider === "Brave")).toBe(true);
      expect(result.diagnostics.providers.find((provider) => provider.provider === "Brave")).toMatchObject({ attempted: 1, succeeded: 1, results: 1 });
    } finally {
      if (previousBraveKey === undefined) delete process.env.BRAVE_SEARCH_API_KEY;
      else process.env.BRAVE_SEARCH_API_KEY = previousBraveKey;
    }
  });
});
