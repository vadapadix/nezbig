import * as cheerio from "cheerio";
import { excerptForSearch, normalizeWhitespace } from "./chunking.js";
import type { SearchCandidate } from "../shared/types";

const SEARCH_TIMEOUT_MS = 9000;
const PAGE_TIMEOUT_MS = 8500;
const MAX_PAGE_CHARS = 120_000;

function decodeDuckDuckGoUrl(href: string): string {
  try {
    const url = new URL(href, "https://duckduckgo.com");
    const encoded = url.searchParams.get("uddg");
    return encoded ? decodeURIComponent(encoded) : url.href;
  } catch {
    return href;
  }
}

function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms).unref();
  return controller.signal;
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

function buildQueries(chunkText: string, deep: boolean): string[] {
  const words = normalizeWhitespace(chunkText).split(" ").filter(Boolean);
  const middle = excerptForSearch(chunkText);
  const start = words.slice(0, 14).join(" ");
  const end = words.slice(Math.max(0, words.length - 14)).join(" ");
  const compact = words
    .filter((word) => word.length > 5)
    .slice(0, 10)
    .join(" ");

  const queries = [`"${middle}"`, `"${start}"`, compact].filter((query) => query.replaceAll('"', "").trim().length > 20);
  if (deep && end && end !== start) queries.push(`"${end}"`);
  return [...new Set(queries)];
}

async function searchDuckDuckGo(query: string, maxResults: number): Promise<SearchCandidate[]> {
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
        query
      });
    }
  });

  return candidates.slice(0, maxResults);
}

async function fetchReadablePageText(url: string): Promise<string | undefined> {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return undefined;

    const response = await fetch(url, {
      signal: withTimeout(PAGE_TIMEOUT_MS),
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 Nezbig/1.0 (+local plagiarism checker)",
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9"
      }
    });

    if (!response.ok) return undefined;
    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) return undefined;

    const raw = (await response.text()).slice(0, MAX_PAGE_CHARS);
    if (/text\/plain/i.test(contentType)) return normalizeWhitespace(raw).slice(0, MAX_PAGE_CHARS);

    const $ = cheerio.load(raw);
    $("script, style, noscript, svg, iframe, nav, header, footer, form").remove();
    const text = normalizeWhitespace($("article, main, body").text());
    return text.length > 160 ? text.slice(0, MAX_PAGE_CHARS) : undefined;
  } catch {
    return undefined;
  }
}

export async function searchWebCandidates(chunkText: string, maxResults = 5, deep = false): Promise<SearchCandidate[]> {
  const perQuery = deep ? 7 : maxResults;
  const searches = await Promise.allSettled(buildQueries(chunkText, deep).map((query) => searchDuckDuckGo(query, perQuery)));
  const candidates = dedupeByUrl(searches.flatMap((result) => (result.status === "fulfilled" ? result.value : []))).slice(0, deep ? 14 : 8);

  const hydrated = await Promise.all(
    candidates.map(async (candidate) => {
      const sourceText = await fetchReadablePageText(candidate.url);
      return {
        ...candidate,
        sourceText,
        verifiedTextLength: sourceText?.length
      };
    })
  );

  return hydrated.slice(0, maxResults);
}
