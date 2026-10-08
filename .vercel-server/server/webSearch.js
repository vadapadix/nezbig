import * as cheerio from "cheerio";
import { franc } from "franc-min";
import { normalizeWhitespace } from "./chunking.js";
import { ProviderCircuitBreaker } from "./providerCircuitBreaker.js";
import { ProviderTaskScheduler } from "./providerTaskScheduler.js";
import { DistributedCache } from "./searchCache.js";
import { emptySearchDiagnostics, mergeSearchDiagnostics } from "./searchDiagnostics.js";
const SEARCH_TIMEOUT_MS = 8000;
const PAGE_TIMEOUT_MS = 7500;
const MAX_PAGE_CHARS = 120_000;
const searchCache = new DistributedCache("search", 1000 * 60 * 30, 500);
const pageCache = new DistributedCache("page", 1000 * 60 * 60, 500);
const providerCircuit = new ProviderCircuitBreaker(3, 45_000);
const providerScheduler = new ProviderTaskScheduler(4);
const STOP_WORDS = new Set([
    "та", "і", "й", "в", "у", "на", "до", "з", "із", "зі", "за", "по", "про", "як", "що", "це", "де", "чи",
    "але", "проте", "однак", "тому", "який", "яка", "яке", "які", "яких", "яким", "якого", "якій",
    "свій", "свого", "своїй", "свої", "цей", "ця", "це", "ці", "цих", "цим", "цього", "цій",
    "від", "під", "над", "перед", "через", "при", "для", "без", "щоб", "якщо", "коли", "було", "були", "буде", "є",
    "and", "or", "the", "a", "an", "in", "on", "at", "to", "for", "with", "by", "from", "of", "about", "that", "this", "is", "are", "was", "were", "be", "been"
]);
function cleanPunctuationForQuery(text) {
    return text
        .replace(/[«»""''„“”]/g, " ")
        .replace(/[.,;:!?()[\]{}\\/—–-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function decodeDuckDuckGoUrl(href) {
    try {
        const fullUrl = href.startsWith("//") ? `https:${href}` : href;
        const url = new URL(fullUrl, "https://duckduckgo.com");
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
function isTimeoutError(error) {
    return error instanceof Error && (error.name === "AbortError" || /abort|timeout/i.test(error.message));
}
function skippedProvider(provider, skippedReason) {
    return { provider, attempted: 0, succeeded: 0, failed: 0, timedOut: 0, results: 0, skippedReason };
}
async function runProviderTask(task) {
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
        }
        catch (error) {
            providerCircuit.recordFailure(task.provider);
            const timedOut = isTimeoutError(error) ? 1 : 0;
            return {
                candidates: [],
                diagnostic: { provider: task.provider, attempted: 1, succeeded: 0, failed: 1, timedOut, results: 0 }
            };
        }
    });
}
function normalizeUrlForDedupe(url) {
    return url
        .replace(/^https?:\/\/(www\.)?/i, "")
        .replace(/#.*$/, "")
        .replace(/\/+$/, "");
}
function dedupeByUrl(candidates) {
    const seen = new Set();
    const deduped = [];
    for (const candidate of candidates) {
        const key = normalizeUrlForDedupe(candidate.url);
        if (seen.has(key))
            continue;
        seen.add(key);
        deduped.push(candidate);
    }
    return deduped;
}
function interleaveCandidates(groups) {
    const interleaved = [];
    const longest = Math.max(0, ...groups.map((group) => group.length));
    for (let index = 0; index < longest; index += 1) {
        for (const group of groups) {
            if (group[index])
                interleaved.push(group[index]);
        }
    }
    return interleaved;
}
/**
 * Generates high-recall and high-precision search query variations for a given text chunk
 */
export function buildSearchQueries(chunkText, deep) {
    const clean = cleanPunctuationForQuery(chunkText);
    const words = clean.split(" ").filter(Boolean);
    if (words.length < 5)
        return [chunkText.slice(0, 100)];
    const queries = [];
    // 1. Natural consecutive clause 1 (7-9 words from beginning/middle)
    const window1Size = Math.min(8, words.length);
    const clause1 = words.slice(0, window1Size).join(" ");
    queries.push(clause1);
    // 2. Natural consecutive clause 2 (7-9 words from mid/end if text is long enough)
    if (words.length >= 14) {
        const midStart = Math.floor(words.length / 2) - 3;
        const clause2 = words.slice(midStart, midStart + 8).join(" ");
        queries.push(clause2);
    }
    // 3. Short exact phrase in quotes (5-6 words from the most informative segment)
    const nonStopSlices = [];
    const phraseLen = 5;
    for (let i = 0; i <= words.length - phraseLen; i += 3) {
        const slice = words.slice(i, i + phraseLen);
        const nonStopCount = slice.filter((w) => !STOP_WORDS.has(w.toLowerCase()) && w.length >= 4).length;
        nonStopSlices.push({
            phrase: slice.join(" "),
            score: nonStopCount
        });
    }
    nonStopSlices.sort((a, b) => b.score - a.score);
    if (nonStopSlices.length > 0) {
        queries.push(`"${nonStopSlices[0].phrase}"`);
        if (deep && nonStopSlices.length > 1) {
            queries.push(`"${nonStopSlices[1].phrase}"`);
        }
    }
    // 4. Salient keyword query (preserves sentence order of distinctive terms)
    const salient = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()) && (w.length >= 5 || /\d/.test(w)));
    if (salient.length >= 4) {
        queries.push(salient.slice(0, deep ? 10 : 8).join(" "));
    }
    return [...new Set(queries.filter((q) => q.replace(/"/g, "").trim().length >= 15))];
}
/**
 * Searches DuckDuckGo via fast HTML scraping with fallback to API scraper
 */
async function searchDuckDuckGo(query, maxResults) {
    const key = cacheKey("duckduckgo", query, maxResults);
    const cached = await searchCache.get(key);
    if (cached)
        return cached;
    // 1. Try DuckDuckGo HTML endpoint
    try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await fetch(url, {
            signal: withTimeout(SEARCH_TIMEOUT_MS),
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
        });
        if (response.ok) {
            const html = await response.text();
            const $ = cheerio.load(html);
            const candidates = [];
            $(".result").each((_, el) => {
                const title = $(el).find(".result__title").text().trim();
                const rawHref = $(el).find(".result__url").attr("href") || $(el).find(".result__title a").attr("href") || "";
                const snippet = $(el).find(".result__snippet").text().trim();
                const realUrl = decodeDuckDuckGoUrl(rawHref);
                if (title && realUrl && realUrl.startsWith("http")) {
                    candidates.push({
                        title: normalizeWhitespace(title),
                        url: realUrl,
                        snippet: normalizeWhitespace(snippet),
                        query,
                        provider: "DuckDuckGo"
                    });
                }
            });
            if (candidates.length > 0) {
                const sliced = candidates.slice(0, maxResults);
                await searchCache.set(key, sliced);
                return sliced;
            }
        }
    }
    catch {
        // Continue to next fallback
    }
    // 2. Try duck-duck-scrape library
    try {
        const { search, SafeSearchType } = await import("duck-duck-scrape");
        const searchResults = await search(query, { safeSearch: SafeSearchType.OFF });
        if (searchResults.results && searchResults.results.length > 0) {
            const candidates = searchResults.results.slice(0, maxResults).map((r) => ({
                title: normalizeWhitespace(r.title),
                url: r.url,
                snippet: normalizeWhitespace(r.description),
                query,
                provider: "DuckDuckGo"
            }));
            if (candidates.length > 0) {
                await searchCache.set(key, candidates);
                return candidates;
            }
        }
    }
    catch {
        // Fallback to SearXNG if available
    }
    // 3. Fallback to SearXNG if configured
    const searxngUrl = process.env.SEARXNG_URL;
    if (searxngUrl) {
        try {
            const url = new URL(`${searxngUrl}/search`);
            url.searchParams.set("q", query);
            url.searchParams.set("format", "json");
            const response = await fetch(url, { signal: withTimeout(SEARCH_TIMEOUT_MS) });
            if (response.ok) {
                const data = (await response.json());
                const results = (data.results || [])
                    .filter((r) => r.title && r.url && r.content)
                    .slice(0, maxResults)
                    .map((r) => ({
                    title: normalizeWhitespace(r.title),
                    url: r.url,
                    snippet: normalizeWhitespace(r.content),
                    query,
                    provider: "SearXNG"
                }));
                if (results.length > 0) {
                    await searchCache.set(key, results);
                    return results;
                }
            }
        }
        catch {
            // Return empty
        }
    }
    return [];
}
/**
 * Searches Crossref open DOI repository for Ukrainian and international scientific papers, theses, and journals
 */
async function searchCrossref(query, maxResults) {
    const key = cacheKey("crossref", query, maxResults);
    const cached = await searchCache.get(key);
    if (cached)
        return cached;
    const plainQuery = query.replaceAll('"', "").trim();
    if (plainQuery.length < 12)
        return [];
    try {
        const url = new URL("https://api.crossref.org/works");
        url.searchParams.set("query", plainQuery);
        url.searchParams.set("rows", String(Math.min(10, maxResults)));
        url.searchParams.set("mailto", "support@nezbig.app");
        const response = await fetch(url, {
            signal: withTimeout(SEARCH_TIMEOUT_MS),
            headers: {
                "User-Agent": "NezbigOriginality/1.0 (mailto:support@nezbig.app)",
                Accept: "application/json"
            }
        });
        if (!response.ok)
            return [];
        const data = (await response.json());
        const items = data.message?.items ?? [];
        const results = items
            .map((r) => {
            const title = Array.isArray(r.title) ? r.title[0] : r.title;
            const authors = (r.author ?? [])
                .slice(0, 3)
                .map((a) => `${a.given || ""} ${a.family || ""}`.trim())
                .filter(Boolean)
                .join(", ");
            const year = r.issued?.["date-parts"]?.[0]?.[0];
            const container = r.container_title?.[0];
            const meta = [authors, year, container].filter(Boolean).join(" · ");
            const targetUrl = r.URL || (r.DOI ? `https://doi.org/${r.DOI}` : "");
            if (!title || !targetUrl)
                return null;
            return {
                title: normalizeWhitespace(title),
                url: targetUrl,
                snippet: normalizeWhitespace(meta ? `${meta}. Академічна праця у базі Crossref.` : "Академічна публікація з реєстру Crossref DOI"),
                query,
                provider: "Crossref",
                sourceText: title,
                verifiedTextLength: title.length
            };
        })
            .filter((r) => r !== null)
            .slice(0, maxResults);
        await searchCache.set(key, results);
        return results;
    }
    catch {
        return [];
    }
}
/**
 * Searches OpenAlex free academic graph
 */
export function abstractFromInvertedIndex(index) {
    if (!index)
        return undefined;
    const positioned = Object.entries(index).flatMap(([word, positions]) => positions.map((position) => ({ word, position })));
    if (positioned.length === 0)
        return undefined;
    return normalizeWhitespace(positioned
        .sort((a, b) => a.position - b.position)
        .map(({ word }) => word)
        .join(" "));
}
async function searchOpenAlex(query, maxResults) {
    const key = cacheKey("openalex", query, maxResults);
    const cached = await searchCache.get(key);
    if (cached)
        return cached;
    const plainQuery = query.replaceAll('"', "").trim();
    if (plainQuery.length < 12)
        return [];
    try {
        const url = new URL("https://api.openalex.org/works");
        url.searchParams.set("search", plainQuery);
        url.searchParams.set("per_page", String(Math.min(10, maxResults)));
        url.searchParams.set("mailto", "support@nezbig.app");
        url.searchParams.set("select", "id,doi,display_name,publication_year,authorships,abstract_inverted_index,best_oa_location,primary_location");
        const response = await fetch(url, {
            signal: withTimeout(SEARCH_TIMEOUT_MS),
            headers: {
                "User-Agent": "NezbigOriginality/1.0 (mailto:support@nezbig.app)",
                Accept: "application/json"
            }
        });
        if (!response.ok)
            return [];
        const payload = (await response.json());
        const results = (payload.results ?? [])
            .flatMap((work) => {
            const title = normalizeWhitespace(work.display_name ?? "");
            const abstract = abstractFromInvertedIndex(work.abstract_inverted_index);
            const url = work.doi ?? work.best_oa_location?.landing_page_url ?? work.primary_location?.landing_page_url ?? work.id ?? "";
            if (!title || !url)
                return [];
            const authors = work.authorships
                ?.slice(0, 3)
                .map((authorship) => authorship.author?.display_name)
                .filter(Boolean)
                .join(", ");
            const metadata = [authors, work.publication_year].filter(Boolean).join(", ");
            const snippetText = abstract ? (metadata ? `${metadata}. ${abstract}` : abstract) : (metadata ? `${metadata}. Наукова стаття OpenAlex.` : title);
            return [
                {
                    title,
                    url,
                    snippet: normalizeWhitespace(snippetText),
                    query,
                    provider: "OpenAlex",
                    sourceText: abstract ?? title,
                    verifiedTextLength: (abstract ?? title).length
                }
            ];
        })
            .slice(0, maxResults);
        await searchCache.set(key, results);
        return results;
    }
    catch {
        return [];
    }
}
/**
 * Searches Wikipedia API
 */
async function searchWikipedia(query, maxResults) {
    const key = cacheKey("wikipedia", query, maxResults);
    const cached = await searchCache.get(key);
    if (cached)
        return cached;
    const plainQuery = cleanPunctuationForQuery(query).replace(/\s+/g, " ").trim();
    if (plainQuery.length < 8)
        return [];
    const lang = franc(plainQuery);
    const prefixMap = {
        eng: "en",
        ukr: "uk",
        rus: "ru",
        deu: "de",
        fra: "fr",
        pol: "pl",
        spa: "es",
        ita: "it"
    };
    const prefix = prefixMap[lang] ?? "uk";
    const url = new URL(`https://${prefix}.wikipedia.org/w/api.php`);
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "search");
    url.searchParams.set("srsearch", plainQuery);
    url.searchParams.set("format", "json");
    url.searchParams.set("srlimit", String(Math.min(10, maxResults)));
    try {
        const response = await fetch(url, {
            signal: withTimeout(SEARCH_TIMEOUT_MS),
            headers: {
                "User-Agent": "Mozilla/5.0 Nezbig/1.0 (+academic originality checker)",
                Accept: "application/json"
            }
        });
        if (!response.ok)
            return [];
        const payload = (await response.json());
        const results = (payload.query?.search ?? [])
            .filter((item) => item.title && item.snippet)
            .slice(0, maxResults)
            .map((item) => {
            const cleanSnippet = item.snippet.replace(/<[^>]+>/g, "");
            return {
                title: `${item.title} - Вікіпедія`,
                url: `https://${prefix}.wikipedia.org/wiki/?curid=${item.pageid}`,
                snippet: normalizeWhitespace(cleanSnippet),
                query,
                provider: "Wikipedia"
            };
        });
        await searchCache.set(key, results);
        return results;
    }
    catch {
        return [];
    }
}
/**
 * Searches Semantic Scholar API
 */
async function searchSemanticScholar(query, maxResults) {
    const key = cacheKey("semantic-scholar", query, maxResults);
    const cached = await searchCache.get(key);
    if (cached)
        return cached;
    const plainQuery = query.replaceAll('"', "").trim();
    if (plainQuery.length < 18)
        return [];
    try {
        const url = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
        url.searchParams.set("query", plainQuery);
        url.searchParams.set("limit", String(Math.min(10, maxResults)));
        url.searchParams.set("fields", "title,abstract,url,year,authors");
        const response = await fetch(url, {
            signal: withTimeout(SEARCH_TIMEOUT_MS),
            headers: {
                "User-Agent": "Mozilla/5.0 Nezbig/1.0 (+academic originality checker)",
                Accept: "application/json"
            }
        });
        if (!response.ok)
            return [];
        const payload = (await response.json());
        const results = (payload.data ?? [])
            .filter((paper) => paper.title && paper.url)
            .slice(0, maxResults)
            .map((paper) => {
            const authors = paper.authors
                ?.slice(0, 2)
                .map((author) => author.name)
                .filter(Boolean)
                .join(", ");
            const meta = [authors, paper.year].filter(Boolean).join(", ");
            const content = paper.abstract ?? paper.title ?? "";
            return {
                title: normalizeWhitespace(paper.title ?? ""),
                url: paper.url ?? "",
                snippet: normalizeWhitespace(meta ? `${meta}. ${content}` : content),
                query,
                provider: "Semantic Scholar",
                sourceText: normalizeWhitespace(content),
                verifiedTextLength: content.length
            };
        });
        await searchCache.set(key, results);
        return results;
    }
    catch {
        return [];
    }
}
/**
 * Searches Google Custom Search Engine (if API credentials provided)
 */
async function searchGoogleCustom(query, maxResults) {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY?.trim();
    const cx = process.env.GOOGLE_SEARCH_ENGINE_ID?.trim();
    if (!apiKey || !cx)
        return [];
    const key = cacheKey("google", query, maxResults);
    const cached = await searchCache.get(key);
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
            "User-Agent": "Mozilla/5.0 Nezbig/1.0 (+local plagiarism checker)",
            Accept: "application/json"
        }
    });
    if (!response.ok)
        throw new Error(`Google Search HTTP ${response.status}`);
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
    await searchCache.set(key, results);
    return results;
}
/**
 * Searches Brave Search (if API key provided)
 */
async function searchBrave(query, maxResults) {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
    if (!apiKey)
        return [];
    const key = cacheKey("brave", query, maxResults);
    const cached = await searchCache.get(key);
    if (cached)
        return cached;
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(Math.min(20, maxResults)));
    url.searchParams.set("extra_snippets", "true");
    const response = await fetch(url, {
        signal: withTimeout(SEARCH_TIMEOUT_MS),
        headers: {
            "x-subscription-token": apiKey,
            "User-Agent": "Mozilla/5.0 Nezbig/1.0 (+local plagiarism checker)",
            Accept: "application/json"
        }
    });
    if (!response.ok)
        throw new Error(`Brave Search HTTP ${response.status}`);
    const payload = (await response.json());
    const results = (payload.web?.results ?? [])
        .filter((item) => item.title && item.url && (item.description || item.extra_snippets?.length))
        .slice(0, maxResults)
        .map((item) => ({
        title: normalizeWhitespace(item.title ?? ""),
        url: item.url ?? "",
        snippet: normalizeWhitespace([item.description, ...(item.extra_snippets ?? [])].filter(Boolean).join(" ")),
        query,
        provider: "Brave"
    }));
    await searchCache.set(key, results);
    return results;
}
/**
 * Searches Tavily AI Search (if API key provided)
 */
async function searchTavily(query, maxResults) {
    const apiKey = process.env.TAVILY_API_KEY?.trim();
    if (!apiKey)
        return [];
    const key = cacheKey("tavily", query, maxResults);
    const cached = await searchCache.get(key);
    if (cached)
        return cached;
    const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 Nezbig/1.0 (+local plagiarism checker)"
        },
        body: JSON.stringify({
            api_key: apiKey,
            query,
            search_depth: "basic",
            max_results: Math.min(10, maxResults),
            include_answer: false
        }),
        signal: withTimeout(SEARCH_TIMEOUT_MS)
    });
    if (!response.ok)
        throw new Error(`Tavily Search HTTP ${response.status}`);
    const payload = (await response.json());
    const results = (payload.results ?? [])
        .filter((item) => item.title && item.url && item.content)
        .slice(0, maxResults)
        .map((item) => ({
        title: normalizeWhitespace(item.title ?? ""),
        url: item.url ?? "",
        snippet: normalizeWhitespace(item.content ?? ""),
        query,
        provider: "Tavily"
    }));
    await searchCache.set(key, results);
    return results;
}
/**
 * Searches Google via Serper.dev API (if API key provided)
 */
async function searchSerper(query, maxResults) {
    const apiKey = process.env.SERPER_API_KEY?.trim();
    if (!apiKey)
        return [];
    const key = cacheKey("serper", query, maxResults);
    const cached = await searchCache.get(key);
    if (cached)
        return cached;
    const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 Nezbig/1.0 (+local plagiarism checker)"
        },
        body: JSON.stringify({
            q: query,
            num: Math.min(10, maxResults),
            gl: "ua",
            hl: "uk"
        }),
        signal: withTimeout(SEARCH_TIMEOUT_MS)
    });
    if (!response.ok)
        throw new Error(`Serper Search HTTP ${response.status}`);
    const payload = (await response.json());
    const results = (payload.organic ?? [])
        .filter((item) => item.title && item.link && item.snippet)
        .slice(0, maxResults)
        .map((item) => ({
        title: normalizeWhitespace(item.title ?? ""),
        url: item.link ?? "",
        snippet: normalizeWhitespace(item.snippet ?? ""),
        query,
        provider: "Serper"
    }));
    await searchCache.set(key, results);
    return results;
}
/**
 * Fetches page content (supporting HTML, plaintext, and PDF documents)
 */
async function fetchReadablePageText(url) {
    const cached = await pageCache.get(url);
    if (cached !== undefined) {
        return { text: cached === null ? undefined : cached, attempted: false, cacheHit: cached !== null, negativeCacheHit: cached === null };
    }
    try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
            await pageCache.set(url, null);
            return { attempted: false, cacheHit: false, negativeCacheHit: false };
        }
        const response = await fetch(url, {
            signal: withTimeout(PAGE_TIMEOUT_MS),
            redirect: "follow",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,text/plain,application/pdf;q=0.9,*/*;q=0.8"
            }
        });
        if (!response.ok) {
            await pageCache.set(url, null);
            return { attempted: true, cacheHit: false, negativeCacheHit: false };
        }
        const contentType = response.headers.get("content-type") ?? "";
        // 1. Handle PDF documents directly
        if (/application\/pdf/i.test(contentType) || /\.pdf($|\?)/i.test(url)) {
            try {
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const { PDFParse } = await import("pdf-parse");
                const parser = new PDFParse({ data: buffer });
                try {
                    const result = await parser.getText();
                    const text = normalizeWhitespace(result.text).slice(0, MAX_PAGE_CHARS);
                    const readable = text.length > 160 ? text : null;
                    await pageCache.set(url, readable);
                    return { text: readable === null ? undefined : readable, attempted: true, cacheHit: false, negativeCacheHit: false };
                }
                finally {
                    await parser.destroy();
                }
            }
            catch {
                await pageCache.set(url, null);
                return { attempted: true, cacheHit: false, negativeCacheHit: false };
            }
        }
        // 2. Handle Plain Text
        if (/text\/plain/i.test(contentType)) {
            const raw = (await response.text()).slice(0, MAX_PAGE_CHARS);
            const plain = normalizeWhitespace(raw).slice(0, MAX_PAGE_CHARS);
            const readable = plain.length > 160 ? plain : null;
            await pageCache.set(url, readable);
            return { text: readable === null ? undefined : readable, attempted: true, cacheHit: false, negativeCacheHit: false };
        }
        // 3. Handle HTML pages
        if (/text\/html|application\/xhtml\+xml/i.test(contentType) || !contentType) {
            const raw = (await response.text()).slice(0, MAX_PAGE_CHARS);
            const $ = cheerio.load(raw);
            $("script, style, noscript, svg, iframe, nav, header, footer, form").remove();
            const text = normalizeWhitespace($("article, main, body").text());
            const readable = text.length > 160 ? text.slice(0, MAX_PAGE_CHARS) : null;
            await pageCache.set(url, readable);
            return { text: readable === null ? undefined : readable, attempted: true, cacheHit: false, negativeCacheHit: false };
        }
        await pageCache.set(url, null);
        return { attempted: true, cacheHit: false, negativeCacheHit: false };
    }
    catch {
        await pageCache.set(url, null);
        return { attempted: true, cacheHit: false, negativeCacheHit: false };
    }
}
/**
 * Searches across all enabled search engines and academic databases
 */
export async function searchWebCandidatesDetailed(chunkText, maxResults = 5, deep = false, profile = {}) {
    const perQuery = deep ? 6 : maxResults;
    const queries = buildSearchQueries(chunkText, deep).slice(0, profile.queryLimit ?? (deep ? 4 : 3));
    const tasks = [];
    const diagnostics = emptySearchDiagnostics();
    const googleConfigured = Boolean(process.env.GOOGLE_SEARCH_API_KEY?.trim() && process.env.GOOGLE_SEARCH_ENGINE_ID?.trim());
    const braveConfigured = Boolean(process.env.BRAVE_SEARCH_API_KEY?.trim());
    const tavilyConfigured = Boolean(process.env.TAVILY_API_KEY?.trim());
    const serperConfigured = Boolean(process.env.SERPER_API_KEY?.trim());
    const academicEnabled = profile.includeAcademic !== false;
    for (const query of queries) {
        tasks.push({ provider: "DuckDuckGo", run: () => searchDuckDuckGo(query, perQuery) });
        tasks.push({ provider: "Wikipedia", run: () => searchWikipedia(query, Math.min(3, perQuery)) });
        tasks.push({ provider: "Crossref", run: () => searchCrossref(query, Math.min(4, perQuery)) });
        if (academicEnabled) {
            tasks.push({ provider: "OpenAlex", run: () => searchOpenAlex(query, Math.min(4, perQuery)) });
            tasks.push({ provider: "Semantic Scholar", run: () => searchSemanticScholar(query, Math.min(3, perQuery)) });
        }
        if (serperConfigured)
            tasks.push({ provider: "Serper", run: () => searchSerper(query, perQuery) });
        if (tavilyConfigured)
            tasks.push({ provider: "Tavily", run: () => searchTavily(query, perQuery) });
        if (googleConfigured)
            tasks.push({ provider: "Google", run: () => searchGoogleCustom(query, perQuery) });
        if (braveConfigured)
            tasks.push({ provider: "Brave", run: () => searchBrave(query, perQuery) });
    }
    if (!googleConfigured)
        diagnostics.providers.push(skippedProvider("Google", "не налаштовано API-ключ і Search Engine ID"));
    if (!braveConfigured)
        diagnostics.providers.push(skippedProvider("Brave", "не налаштовано API-ключ"));
    if (!tavilyConfigured)
        diagnostics.providers.push(skippedProvider("Tavily", "не налаштовано API-ключ"));
    if (!serperConfigured)
        diagnostics.providers.push(skippedProvider("Serper", "не налаштовано API-ключ"));
    const taskResults = await Promise.all(tasks.map(runProviderTask));
    const providerDiagnostics = mergeSearchDiagnostics(diagnostics, ...taskResults.map(({ diagnostic }) => ({ ...emptySearchDiagnostics(), providers: [diagnostic] })));
    const candidates = dedupeByUrl(interleaveCandidates(taskResults.map(({ candidates: group }) => group)))
        .slice(0, deep ? 20 : 12)
        .slice(0, maxResults);
    const hydrateLimit = Math.min(candidates.length, profile.hydrateLimit ?? candidates.length);
    const hydration = await hydrateSearchCandidatesDetailed(candidates.slice(0, hydrateLimit), hydrateLimit);
    const hydrated = [...hydration.candidates, ...candidates.slice(hydrateLimit)];
    return { candidates: hydrated, diagnostics: mergeSearchDiagnostics(providerDiagnostics, hydration.diagnostics) };
}
export async function searchWebCandidates(chunkText, maxResults = 5, deep = false, profile = {}) {
    return (await searchWebCandidatesDetailed(chunkText, maxResults, deep, profile)).candidates;
}
export async function hydrateSearchCandidatesDetailed(candidates, maxPages) {
    const selected = candidates.slice(0, maxPages);
    const sourceByUrl = new Map();
    const hydrated = await Promise.all(selected.map(async (candidate) => {
        if (candidate.sourceText && candidate.sourceText.length > 160)
            return candidate;
        const key = candidate.url.replace(/#.*$/, "").replace(/\/$/, "");
        const sourcePromise = sourceByUrl.get(key) ?? fetchReadablePageText(candidate.url);
        sourceByUrl.set(key, sourcePromise);
        const page = await sourcePromise;
        return {
            ...candidate,
            sourceText: page.text ?? candidate.sourceText,
            verifiedTextLength: page.text?.length ?? candidate.verifiedTextLength
        };
    }));
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
export async function hydrateSearchCandidates(candidates, maxPages) {
    return (await hydrateSearchCandidatesDetailed(candidates, maxPages)).candidates;
}
