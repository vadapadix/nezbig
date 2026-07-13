import * as cheerio from "cheerio";
import { excerptForSearch, normalizeWhitespace } from "./chunking.js";
import { ProviderCircuitBreaker } from "./providerCircuitBreaker.js";
import { ProviderTaskScheduler } from "./providerTaskScheduler.js";
import { MemoryTtlCache } from "./searchCache.js";
import { emptySearchDiagnostics, mergeSearchDiagnostics } from "./searchDiagnostics.js";
import type { SearchCandidate, SearchDiagnostics, SearchProviderDiagnostic } from "../shared/types.js";

const SEARCH_TIMEOUT_MS = 9000;
const PAGE_TIMEOUT_MS = 8500;
const MAX_PAGE_CHARS = 120_000;
const searchCache = new MemoryTtlCache<SearchCandidate[]>(1000 * 60 * 30, 500);
const pageCache = new MemoryTtlCache<string | undefined>(1000 * 60 * 60, 500);
const providerCircuit = new ProviderCircuitBreaker(3, 60_000);
const providerScheduler = new ProviderTaskScheduler(3);

export type SearchProfile = {
  hydrateLimit?: number;
  includeAcademic?: boolean;
  queryLimit?: number;
};

export type WebSearchResult = {
  candidates: SearchCandidate[];
  diagnostics: SearchDiagnostics;
};

type ProviderTask = {
  provider: string;
  run: () => Promise<SearchCandidate[]>;
};

type PageReadResult = {
  text?: string;
  attempted: boolean;
  cacheHit: boolean;
  negativeCacheHit: boolean;
};

function decodeDuckDuckGoUrl(href: string): string {
  try {
    const url = new URL(href, "https://duckduckgo.com");
    const encoded = url.searchParams.get("uddg");
    return encoded ? decodeURIComponent(encoded) : url.href;
  } catch {
    return href;
  }
}

function cacheKey(provider: string, query: string, maxResults: number): string {
  return `${provider}::${query}::${maxResults}`;
}

function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms).unref();
  return controller.signal;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || /abort|timeout/i.test(error.message));
}

function skippedProvider(provider: string, skippedReason: string): SearchProviderDiagnostic {
  return { provider, attempted: 0, succeeded: 0, failed: 0, timedOut: 0, results: 0, skippedReason };
}

async function runProviderTask(task: ProviderTask): Promise<{ candidates: SearchCandidate[]; diagnostic: SearchProviderDiagnostic }> {
  return providerScheduler.run(task.provider, async () => {
    if (!providerCircuit.canRequest(task.provider)) {
      return { candidates: [], diagnostic: skippedProvider(task.provider, "тимчасово призупинено після повторних помилок") };
    }

    try {
      const candidates = await task.run();
      providerCircuit.recordSuccess(task.provider);
      return {
        candidates,
        diagnostic: { provider: task.provider, attempted: 1, succeeded: 1, failed: 0, timedOut: 0, results: candidates.length }
      };
    } catch (error) {
      providerCircuit.recordFailure(task.provider);
      const timedOut = isTimeoutError(error) ? 1 : 0;
      return {
        candidates: [],
        diagnostic: { provider: task.provider, attempted: 1, succeeded: 0, failed: 1, timedOut, results: 0 }
      };
    }
  });
}

function dedupeByUrl(candidates: SearchCandidate[]): SearchCandidate[] {
  const seen = new Set<string>();
  const deduped: SearchCandidate[] = [];

  for (const candidate of candidates) {
    const key = candidate.url.replace(/#.*$/, "").replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
}

function interleaveCandidates(groups: SearchCandidate[][]): SearchCandidate[] {
  const interleaved: SearchCandidate[] = [];
  const longest = Math.max(0, ...groups.map((group) => group.length));
  for (let index = 0; index < longest; index += 1) {
    for (const group of groups) {
      if (group[index]) interleaved.push(group[index]);
    }
  }
  return interleaved;
}

function phraseScore(words: string[]): number {
  const normalized = words.map((word) => word.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, "")).filter(Boolean);
  const uniqueRatio = new Set(normalized).size / Math.max(1, normalized.length);
  const informative = normalized.filter((word) => word.length >= 7 || /\d/.test(word)).length;
  const averageLength = normalized.reduce((sum, word) => sum + word.length, 0) / Math.max(1, normalized.length);
  return uniqueRatio * 10 + informative * 1.8 + averageLength;
}

export function buildSearchQueries(chunkText: string, deep: boolean): string[] {
  const words = normalizeWhitespace(chunkText).split(" ").filter(Boolean);
  if (words.length === 0) return [];

  const phraseWords = deep ? 12 : 10;
  const stride = Math.max(5, Math.floor(phraseWords / 2));
  const phraseCandidates: Array<{ phrase: string; score: number; bucket: number }> = [];
  for (let start = 0; start <= Math.max(0, words.length - phraseWords); start += stride) {
    const slice = words.slice(start, start + phraseWords);
    if (slice.length < Math.min(7, phraseWords)) continue;
    phraseCandidates.push({
      phrase: slice.join(" "),
      score: phraseScore(slice),
      bucket: Math.min(3, Math.floor((start / Math.max(1, words.length - phraseWords)) * 4))
    });
  }

  const distributedCandidates = [0, 1, 2, 3]
    .map((bucket) => phraseCandidates.filter((candidate) => candidate.bucket === bucket).sort((a, b) => b.score - a.score)[0])
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
  const exactQueries = distributedCandidates
    .sort((a, b) => b.score - a.score)
    .filter((candidate, index, all) => all.findIndex((other) => other.phrase.toLowerCase() === candidate.phrase.toLowerCase()) === index)
    .slice(0, deep ? 4 : 2)
    .map(({ phrase }) => `"${phrase}"`);

  const keywordQuery = [...new Set(words
    .map((word) => word.replace(/[^\p{L}\p{N}'-]/gu, ""))
    .filter((word) => word.length >= 7 || /\d/.test(word)))]
    .sort((a, b) => b.length - a.length)
    .slice(0, deep ? 12 : 9)
    .join(" ");
  const fallback = excerptForSearch(chunkText);
  const queries = [...exactQueries, keywordQuery, `"${fallback}"`]
    .filter((query) => query.replaceAll('"', "").trim().length > 20);

  return [...new Set(queries)];
}

async function searchDuckDuckGo(query: string, maxResults: number): Promise<SearchCandidate[]> {
  const key = cacheKey("duckduckgo", query, maxResults);
  const cached = searchCache.get(key);
  if (cached) return cached;

  const url = new URL("https://duckduckgo.com/html/");
  url.searchParams.set("q", query);

  const response = await fetch(url, {
    signal: withTimeout(SEARCH_TIMEOUT_MS),
    headers: {
      "user-agent": "Mozilla/5.0 Nezbig/1.0 (+local plagiarism checker)",
      accept: "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(`Пошук тимчасово недоступний: HTTP ${response.status}.`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const candidates: SearchCandidate[] = [];

  $(".result").each((_, element) => {
    const titleElement = $(element).find(".result__title a").first();
    const title = normalizeWhitespace(titleElement.text());
    const href = titleElement.attr("href");
    const snippet = normalizeWhitespace($(element).find(".result__snippet").text());

    if (title && href && snippet) {
      candidates.push({
        title,
        url: decodeDuckDuckGoUrl(href),
        snippet,
        query,
        provider: "DuckDuckGo"
      });
    }
  });

  const results = candidates.slice(0, maxResults);
  searchCache.set(key, results);
  return results;
}

async function searchGoogleCustom(query: string, maxResults: number): Promise<SearchCandidate[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY?.trim();
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID?.trim();
  if (!apiKey || !cx) return [];

  const key = cacheKey("google", query, maxResults);
  const cached = searchCache.get(key);
  if (cached) return cached;

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(10, maxResults)));

  const response = await fetch(url, {
    signal: withTimeout(SEARCH_TIMEOUT_MS),
    headers: {
      "user-agent": "Mozilla/5.0 Nezbig/1.0 (+local plagiarism checker)",
      accept: "application/json"
    }
  });

  if (!response.ok) throw new Error(`Google Search HTTP ${response.status}`);

  const payload = (await response.json()) as {
    items?: Array<{
      title?: string;
      link?: string;
      snippet?: string;
    }>;
  };

  const results = (payload.items ?? [])
    .filter((item) => item.title && item.link && item.snippet)
    .slice(0, maxResults)
    .map((item): SearchCandidate => ({
      title: normalizeWhitespace(item.title ?? ""),
      url: item.link ?? "",
      snippet: normalizeWhitespace(item.snippet ?? ""),
      query,
      provider: "Google"
    }));

  searchCache.set(key, results);
  return results;
}

async function searchBrave(query: string, maxResults: number): Promise<SearchCandidate[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!apiKey) return [];

  const key = cacheKey("brave", query, maxResults);
  const cached = searchCache.get(key);
  if (cached) return cached;

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(Math.min(20, maxResults)));
  url.searchParams.set("extra_snippets", "true");

  const response = await fetch(url, {
    signal: withTimeout(SEARCH_TIMEOUT_MS),
    headers: {
      "x-subscription-token": apiKey,
      "user-agent": "Mozilla/5.0 Nezbig/1.0 (+local plagiarism checker)",
      accept: "application/json"
    }
  });
  if (!response.ok) throw new Error(`Brave Search HTTP ${response.status}`);

  const payload = (await response.json()) as {
    web?: {
      results?: Array<{
        title?: string;
        url?: string;
        description?: string;
        extra_snippets?: string[];
      }>;
    };
  };
  const results = (payload.web?.results ?? [])
    .filter((item) => item.title && item.url && (item.description || item.extra_snippets?.length))
    .slice(0, maxResults)
    .map((item): SearchCandidate => ({
      title: normalizeWhitespace(item.title ?? ""),
      url: item.url ?? "",
      snippet: normalizeWhitespace([item.description, ...(item.extra_snippets ?? [])].filter(Boolean).join(" ")),
      query,
      provider: "Brave"
    }));

  searchCache.set(key, results);
  return results;
}

async function searchSemanticScholar(query: string, maxResults: number): Promise<SearchCandidate[]> {
  const key = cacheKey("semantic-scholar", query, maxResults);
  const cached = searchCache.get(key);
  if (cached) return cached;

  const plainQuery = query.replaceAll('"', "").trim();
  if (plainQuery.length < 24) return [];

  const url = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
  url.searchParams.set("query", plainQuery);
  url.searchParams.set("limit", String(Math.min(10, maxResults)));
  url.searchParams.set("fields", "title,abstract,url,year,authors");

  const response = await fetch(url, {
    signal: withTimeout(SEARCH_TIMEOUT_MS),
    headers: {
      "user-agent": "Mozilla/5.0 Nezbig/1.0 (+academic originality checker)",
      accept: "application/json"
    }
  });

  if (!response.ok) throw new Error(`Semantic Scholar HTTP ${response.status}`);

  const payload = (await response.json()) as {
    data?: Array<{
      title?: string;
      abstract?: string;
      url?: string;
      year?: number;
      authors?: Array<{ name?: string }>;
    }>;
  };

  const results = (payload.data ?? [])
    .filter((paper) => paper.title && paper.url && paper.abstract)
    .slice(0, maxResults)
    .map((paper): SearchCandidate => {
      const authors = paper.authors?.slice(0, 2).map((author) => author.name).filter(Boolean).join(", ");
      const meta = [authors, paper.year].filter(Boolean).join(", ");
      return {
        title: normalizeWhitespace(paper.title ?? ""),
        url: paper.url ?? "",
        snippet: normalizeWhitespace(meta ? `${meta}. ${paper.abstract}` : paper.abstract ?? ""),
        query,
        provider: "Semantic Scholar",
        sourceText: normalizeWhitespace(paper.abstract ?? ""),
        verifiedTextLength: paper.abstract?.length
      };
    });

  searchCache.set(key, results);
  return results;
}

export function abstractFromInvertedIndex(index?: Record<string, number[]> | null): string | undefined {
  if (!index) return undefined;
  const positioned = Object.entries(index).flatMap(([word, positions]) =>
    positions.map((position) => ({ word, position }))
  );
  if (positioned.length === 0) return undefined;
  return normalizeWhitespace(positioned.sort((a, b) => a.position - b.position).map(({ word }) => word).join(" "));
}

async function searchOpenAlex(query: string, maxResults: number): Promise<SearchCandidate[]> {
  const apiKey = process.env.OPENALEX_API_KEY?.trim();
  if (!apiKey) return [];

  const key = cacheKey("openalex", query, maxResults);
  const cached = searchCache.get(key);
  if (cached) return cached;

  const plainQuery = query.replaceAll('"', "").trim();
  if (plainQuery.length < 24) return [];

  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("search", plainQuery);
  url.searchParams.set("per_page", String(Math.min(10, maxResults)));
  url.searchParams.set("select", "id,doi,display_name,publication_year,authorships,abstract_inverted_index,best_oa_location,primary_location");

  const response = await fetch(url, {
    signal: withTimeout(SEARCH_TIMEOUT_MS),
    headers: {
      "user-agent": "Mozilla/5.0 Nezbig/1.0 (+academic originality checker)",
      accept: "application/json"
    }
  });
  if (!response.ok) throw new Error(`OpenAlex HTTP ${response.status}`);

  const payload = (await response.json()) as {
    results?: Array<{
      id?: string;
      doi?: string;
      display_name?: string;
      publication_year?: number;
      authorships?: Array<{ author?: { display_name?: string } }>;
      abstract_inverted_index?: Record<string, number[]> | null;
      best_oa_location?: { landing_page_url?: string; pdf_url?: string } | null;
      primary_location?: { landing_page_url?: string } | null;
    }>;
  };

  const results = (payload.results ?? []).flatMap((work): SearchCandidate[] => {
    const title = normalizeWhitespace(work.display_name ?? "");
    const abstract = abstractFromInvertedIndex(work.abstract_inverted_index);
    const url = work.doi ?? work.best_oa_location?.landing_page_url ?? work.primary_location?.landing_page_url ?? work.id ?? "";
    if (!title || !url || !abstract) return [];
    const authors = work.authorships?.slice(0, 3).map((authorship) => authorship.author?.display_name).filter(Boolean).join(", ");
    const metadata = [authors, work.publication_year].filter(Boolean).join(", ");
    return [{
      title,
      url,
      snippet: normalizeWhitespace(metadata ? `${metadata}. ${abstract}` : abstract),
      query,
      provider: "OpenAlex",
      sourceText: abstract,
      verifiedTextLength: abstract.length
    }];
  }).slice(0, maxResults);

  searchCache.set(key, results);
  return results;
}

async function fetchReadablePageText(url: string): Promise<PageReadResult> {
  if (pageCache.has(url)) {
    const text = pageCache.get(url);
    return { text, attempted: false, cacheHit: text !== undefined, negativeCacheHit: text === undefined };
  }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      pageCache.set(url, undefined);
      return { attempted: false, cacheHit: false, negativeCacheHit: false };
    }

    const response = await fetch(url, {
      signal: withTimeout(PAGE_TIMEOUT_MS),
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 Nezbig/1.0 (+local plagiarism checker)",
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9"
      }
    });

    if (!response.ok) {
      pageCache.set(url, undefined);
      return { attempted: true, cacheHit: false, negativeCacheHit: false };
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) {
      pageCache.set(url, undefined);
      return { attempted: true, cacheHit: false, negativeCacheHit: false };
    }

    const raw = (await response.text()).slice(0, MAX_PAGE_CHARS);
    if (/text\/plain/i.test(contentType)) {
      const plain = normalizeWhitespace(raw).slice(0, MAX_PAGE_CHARS);
      pageCache.set(url, plain);
      return { text: plain, attempted: true, cacheHit: false, negativeCacheHit: false };
    }

    const $ = cheerio.load(raw);
    $("script, style, noscript, svg, iframe, nav, header, footer, form").remove();
    const text = normalizeWhitespace($("article, main, body").text());
    const readable = text.length > 160 ? text.slice(0, MAX_PAGE_CHARS) : undefined;
    pageCache.set(url, readable);
    return { text: readable, attempted: true, cacheHit: false, negativeCacheHit: false };
  } catch {
    pageCache.set(url, undefined);
    return { attempted: true, cacheHit: false, negativeCacheHit: false };
  }
}

export async function searchWebCandidatesDetailed(chunkText: string, maxResults = 5, deep = false, profile: SearchProfile = {}): Promise<WebSearchResult> {
  const perQuery = deep ? 7 : maxResults;
  const queries = buildSearchQueries(chunkText, deep).slice(0, profile.queryLimit ?? (deep ? 5 : 3));
  const tasks: ProviderTask[] = [];
  const diagnostics = emptySearchDiagnostics();
  const googleConfigured = Boolean(process.env.GOOGLE_SEARCH_API_KEY?.trim() && process.env.GOOGLE_SEARCH_ENGINE_ID?.trim());
  const braveConfigured = Boolean(process.env.BRAVE_SEARCH_API_KEY?.trim());
  const academicEnabled = deep && profile.includeAcademic !== false;
  const openAlexConfigured = Boolean(process.env.OPENALEX_API_KEY?.trim());

  for (const query of queries) {
    tasks.push({ provider: "DuckDuckGo", run: () => searchDuckDuckGo(query, perQuery) });
    if (googleConfigured) tasks.push({ provider: "Google", run: () => searchGoogleCustom(query, perQuery) });
    if (braveConfigured) tasks.push({ provider: "Brave", run: () => searchBrave(query, perQuery) });
    if (academicEnabled) {
      tasks.push({ provider: "Semantic Scholar", run: () => searchSemanticScholar(query, Math.min(5, perQuery)) });
      if (openAlexConfigured) tasks.push({ provider: "OpenAlex", run: () => searchOpenAlex(query, Math.min(5, perQuery)) });
    }
  }

  if (!googleConfigured) diagnostics.providers.push(skippedProvider("Google", "не налаштовано API-ключ і Search Engine ID"));
  if (!braveConfigured) diagnostics.providers.push(skippedProvider("Brave", "не налаштовано API-ключ"));
  if (deep && !academicEnabled) {
    diagnostics.providers.push(skippedProvider("Semantic Scholar", "вимкнено профілем довгого сканування"));
    diagnostics.providers.push(skippedProvider("OpenAlex", "вимкнено профілем довгого сканування"));
  } else if (academicEnabled && !openAlexConfigured) {
    diagnostics.providers.push(skippedProvider("OpenAlex", "не налаштовано API-ключ"));
  }

  const taskResults = await Promise.all(tasks.map(runProviderTask));
  const providerDiagnostics = mergeSearchDiagnostics(
    diagnostics,
    ...taskResults.map(({ diagnostic }) => ({ ...emptySearchDiagnostics(), providers: [diagnostic] }))
  );
  const candidates = dedupeByUrl(interleaveCandidates(taskResults.map(({ candidates: group }) => group)))
    .slice(0, deep ? 18 : 10)
    .slice(0, maxResults);
  const hydrateLimit = Math.min(candidates.length, profile.hydrateLimit ?? candidates.length);
  const hydration = await hydrateSearchCandidatesDetailed(candidates.slice(0, hydrateLimit), hydrateLimit);
  const hydrated = [...hydration.candidates, ...candidates.slice(hydrateLimit)];

  return { candidates: hydrated, diagnostics: mergeSearchDiagnostics(providerDiagnostics, hydration.diagnostics) };
}

export async function searchWebCandidates(chunkText: string, maxResults = 5, deep = false, profile: SearchProfile = {}): Promise<SearchCandidate[]> {
  return (await searchWebCandidatesDetailed(chunkText, maxResults, deep, profile)).candidates;
}

export async function hydrateSearchCandidatesDetailed(candidates: SearchCandidate[], maxPages: number): Promise<WebSearchResult> {
  const selected = candidates.slice(0, maxPages);
  const sourceByUrl = new Map<string, Promise<PageReadResult>>();

  const hydrated = await Promise.all(
    selected.map(async (candidate) => {
      if (candidate.sourceText && candidate.sourceText.length > 160) return candidate;
      const key = candidate.url.replace(/#.*$/, "").replace(/\/$/, "");
      const sourcePromise = sourceByUrl.get(key) ?? fetchReadablePageText(candidate.url);
      sourceByUrl.set(key, sourcePromise);
      const page = await sourcePromise;
      return {
        ...candidate,
        sourceText: page.text ?? candidate.sourceText,
        verifiedTextLength: page.text?.length ?? candidate.verifiedTextLength
      };
    })
  );

  const pageResults = await Promise.all(sourceByUrl.values());
  const diagnostics = emptySearchDiagnostics();
  diagnostics.pages = {
    attempted: pageResults.filter((page) => page.attempted).length,
    verified: pageResults.filter((page) => page.text !== undefined).length,
    unavailable: pageResults.filter((page) => page.text === undefined).length,
    cacheHits: pageResults.filter((page) => page.cacheHit).length,
    negativeCacheHits: pageResults.filter((page) => page.negativeCacheHit).length
  };

  return { candidates: hydrated, diagnostics };
}

export async function hydrateSearchCandidates(candidates: SearchCandidate[], maxPages: number): Promise<SearchCandidate[]> {
  return (await hydrateSearchCandidatesDetailed(candidates, maxPages)).candidates;
}
