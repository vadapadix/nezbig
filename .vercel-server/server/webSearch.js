import * as cheerio from "cheerio";
import { excerptForSearch, normalizeWhitespace } from "./chunking.js";
import { MemoryTtlCache } from "./searchCache.js";
const SEARCH_TIMEOUT_MS = 9000;
const PAGE_TIMEOUT_MS = 8500;
const MAX_PAGE_CHARS = 120_000;
const searchCache = new MemoryTtlCache(1000 * 60 * 30, 500);
const pageCache = new MemoryTtlCache(1000 * 60 * 60, 500);
function decodeDuckDuckGoUrl(href) {
    try {
        const url = new URL(href, "https://duckduckgo.com");
        const encoded = url.searchParams.get("uddg");
        return encoded ? decodeURIComponent(encoded) : url.href;
    }
    catch {
        return href;
    }
}
function cacheKey(provider, query, maxResults) {
    return `${provider}::${query}::${maxResults}`;
}
function withTimeout(ms) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms).unref();
    return controller.signal;
}
function dedupeByUrl(candidates) {
    const seen = new Set();
    const deduped = [];
    for (const candidate of candidates) {
        const key = candidate.url.replace(/#.*$/, "").replace(/\/$/, "");
        if (seen.has(key))
            continue;
        seen.add(key);
        deduped.push(candidate);
    }
    return deduped;
}
function phraseScore(words) {
    const normalized = words.map((word) => word.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, "")).filter(Boolean);
    const uniqueRatio = new Set(normalized).size / Math.max(1, normalized.length);
    const informative = normalized.filter((word) => word.length >= 7 || /\d/.test(word)).length;
    const averageLength = normalized.reduce((sum, word) => sum + word.length, 0) / Math.max(1, normalized.length);
    return uniqueRatio * 10 + informative * 1.8 + averageLength;
}
export function buildSearchQueries(chunkText, deep) {
    const words = normalizeWhitespace(chunkText).split(" ").filter(Boolean);
    if (words.length === 0)
        return [];
    const phraseWords = deep ? 12 : 10;
    const stride = Math.max(5, Math.floor(phraseWords / 2));
    const phraseCandidates = [];
    for (let start = 0; start <= Math.max(0, words.length - phraseWords); start += stride) {
        const slice = words.slice(start, start + phraseWords);
        if (slice.length < Math.min(7, phraseWords))
            continue;
        phraseCandidates.push({
            phrase: slice.join(" "),
            score: phraseScore(slice),
            bucket: Math.min(3, Math.floor((start / Math.max(1, words.length - phraseWords)) * 4))
        });
    }
    const distributedCandidates = [0, 1, 2, 3]
        .map((bucket) => phraseCandidates.filter((candidate) => candidate.bucket === bucket).sort((a, b) => b.score - a.score)[0])
        .filter((candidate) => Boolean(candidate));
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
async function searchDuckDuckGo(query, maxResults) {
    const key = cacheKey("duckduckgo", query, maxResults);
    const cached = searchCache.get(key);
    if (cached)
        return cached;
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
    const candidates = [];
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
async function searchGoogleCustom(query, maxResults) {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY?.trim();
    const cx = process.env.GOOGLE_SEARCH_ENGINE_ID?.trim();
    if (!apiKey || !cx)
        return [];
    const key = cacheKey("google", query, maxResults);
    const cached = searchCache.get(key);
    if (cached)
        return cached;
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
    if (!response.ok)
        return [];
    const payload = (await response.json());
    const results = (payload.items ?? [])
        .filter((item) => item.title && item.link && item.snippet)
        .slice(0, maxResults)
        .map((item) => ({
        title: normalizeWhitespace(item.title ?? ""),
        url: item.link ?? "",
        snippet: normalizeWhitespace(item.snippet ?? ""),
        query,
        provider: "Google"
    }));
    searchCache.set(key, results);
    return results;
}
async function searchSemanticScholar(query, maxResults) {
    const key = cacheKey("semantic-scholar", query, maxResults);
    const cached = searchCache.get(key);
    if (cached)
        return cached;
    const plainQuery = query.replaceAll('"', "").trim();
    if (plainQuery.length < 24)
        return [];
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
    if (!response.ok)
        return [];
    const payload = (await response.json());
    const results = (payload.data ?? [])
        .filter((paper) => paper.title && paper.url && paper.abstract)
        .slice(0, maxResults)
        .map((paper) => {
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
export function abstractFromInvertedIndex(index) {
    if (!index)
        return undefined;
    const positioned = Object.entries(index).flatMap(([word, positions]) => positions.map((position) => ({ word, position })));
    if (positioned.length === 0)
        return undefined;
    return normalizeWhitespace(positioned.sort((a, b) => a.position - b.position).map(({ word }) => word).join(" "));
}
async function searchOpenAlex(query, maxResults) {
    const apiKey = process.env.OPENALEX_API_KEY?.trim();
    if (!apiKey)
        return [];
    const key = cacheKey("openalex", query, maxResults);
    const cached = searchCache.get(key);
    if (cached)
        return cached;
    const plainQuery = query.replaceAll('"', "").trim();
    if (plainQuery.length < 24)
        return [];
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
    if (!response.ok)
        return [];
    const payload = (await response.json());
    const results = (payload.results ?? []).flatMap((work) => {
        const title = normalizeWhitespace(work.display_name ?? "");
        const abstract = abstractFromInvertedIndex(work.abstract_inverted_index);
        const url = work.doi ?? work.best_oa_location?.landing_page_url ?? work.primary_location?.landing_page_url ?? work.id ?? "";
        if (!title || !url || !abstract)
            return [];
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
async function fetchReadablePageText(url) {
    const cached = pageCache.get(url);
    if (cached !== undefined)
        return cached;
    try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol))
            return undefined;
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
            return undefined;
        }
        const contentType = response.headers.get("content-type") ?? "";
        if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) {
            pageCache.set(url, undefined);
            return undefined;
        }
        const raw = (await response.text()).slice(0, MAX_PAGE_CHARS);
        if (/text\/plain/i.test(contentType)) {
            const plain = normalizeWhitespace(raw).slice(0, MAX_PAGE_CHARS);
            pageCache.set(url, plain);
            return plain;
        }
        const $ = cheerio.load(raw);
        $("script, style, noscript, svg, iframe, nav, header, footer, form").remove();
        const text = normalizeWhitespace($("article, main, body").text());
        const readable = text.length > 160 ? text.slice(0, MAX_PAGE_CHARS) : undefined;
        pageCache.set(url, readable);
        return readable;
    }
    catch {
        pageCache.set(url, undefined);
        return undefined;
    }
}
export async function searchWebCandidates(chunkText, maxResults = 5, deep = false, profile = {}) {
    const perQuery = deep ? 7 : maxResults;
    const queries = buildSearchQueries(chunkText, deep).slice(0, profile.queryLimit ?? (deep ? 5 : 3));
    const searches = await Promise.allSettled(queries.flatMap((query) => [
        searchDuckDuckGo(query, perQuery),
        searchGoogleCustom(query, perQuery),
        ...(deep && profile.includeAcademic !== false
            ? [
                searchSemanticScholar(query, Math.min(5, perQuery)),
                searchOpenAlex(query, Math.min(5, perQuery))
            ]
            : [])
    ]));
    const candidates = dedupeByUrl(searches.flatMap((result) => (result.status === "fulfilled" ? result.value : []))).slice(0, deep ? 18 : 10);
    const hydrateLimit = Math.min(candidates.length, profile.hydrateLimit ?? candidates.length);
    const hydrated = await Promise.all(candidates.map(async (candidate, index) => {
        if (index >= hydrateLimit)
            return candidate;
        const sourceText = await fetchReadablePageText(candidate.url);
        return {
            ...candidate,
            sourceText,
            verifiedTextLength: sourceText?.length
        };
    }));
    return hydrated.slice(0, maxResults);
}
export async function hydrateSearchCandidates(candidates, maxPages) {
    const selected = candidates.slice(0, maxPages);
    const sourceByUrl = new Map();
    const hydrated = await Promise.all(selected.map(async (candidate) => {
        const key = candidate.url.replace(/#.*$/, "").replace(/\/$/, "");
        const sourcePromise = sourceByUrl.get(key) ?? fetchReadablePageText(candidate.url);
        sourceByUrl.set(key, sourcePromise);
        const sourceText = await sourcePromise;
        return {
            ...candidate,
            sourceText: sourceText ?? candidate.sourceText,
            verifiedTextLength: sourceText?.length ?? candidate.verifiedTextLength
        };
    }));
    return hydrated;
}
