import { normalizeWhitespace } from "./chunking.js";
export const MAX_ANALYSIS_CHARS = 6000;
const HEAD_CHARS = 2800;
const TAIL_CHARS = 1400;
const MAX_SUSPICIOUS_EXCERPTS = 3;
export const JSON_SHAPE_PROMPT = `Return JSON with this exact shape:
{
  "probability": 0-100,
  "verdict": "короткий чіткий висновок українською мовою (1-2 речення: чи це природний авторський текст, чи присутні ознаки ШІ і які саме фактори це підтверджують)",
  "signals": [
    { "label": "коротка назва сигналу", "score": 0-100, "detail": "одне речення з поясненням сигналу", "evidence": ["коротка цитата або приклад"] }
  ]
}`;
export function asScore(value) {
    const number = Number(value);
    if (!Number.isFinite(number))
        return 0;
    return Math.max(0, Math.min(100, Math.round(number)));
}
export function extractJsonObject(content) {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const raw = fenced?.[1] ?? content;
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
        throw new Error("Model returned no JSON object.");
    }
    const jsonSubstring = raw.slice(start, end + 1);
    try {
        return JSON.parse(jsonSubstring);
    }
    catch {
        const cleaned = jsonSubstring.replace(/,\s*([}\]])/g, "$1");
        return JSON.parse(cleaned);
    }
}
export function withTimeout(ms) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms).unref();
    return controller.signal;
}
export function buildAnalysisSample(text, suspiciousExcerpts = []) {
    const normalized = normalizeWhitespace(text);
    if (normalized.length <= MAX_ANALYSIS_CHARS)
        return normalized;
    const head = normalized.slice(0, HEAD_CHARS);
    const tail = normalized.slice(-TAIL_CHARS);
    const excerptBudget = Math.max(480, MAX_ANALYSIS_CHARS - head.length - tail.length - 160);
    const perExcerpt = Math.floor(excerptBudget / MAX_SUSPICIOUS_EXCERPTS);
    const picked = suspiciousExcerpts
        .slice(0, MAX_SUSPICIOUS_EXCERPTS)
        .map((excerpt, index) => `[${index + 1}] ${normalizeWhitespace(excerpt).slice(0, perExcerpt)}`);
    return [
        "=== ПОЧАТОК ДОКУМЕНТА ===",
        head,
        "",
        "=== КІНЕЦЬ ДОКУМЕНТА ===",
        tail,
        picked.length > 0 ? "\n=== НАЙПІДОЗРІЛІШІ ФРАГМЕНТИ (за локальною евристикою) ===" : "",
        ...picked,
        "\nДокумент довший за цю вибірку. Оцінюй лише представлений матеріал і зазначай у деталях, що покриття обмежене."
    ]
        .filter(Boolean)
        .join("\n");
}
export function parseAuthorshipResult(content, fallbackLabel, emptyDetail) {
    const parsed = extractJsonObject(content);
    const rawProb = parsed.probability ?? parsed.ai_probability ?? parsed.aiProbability ?? parsed.score;
    const probability = asScore(rawProb);
    const rawSignals = Array.isArray(parsed.signals) ? parsed.signals : [];
    const signals = rawSignals
        .slice(0, 6)
        .map((signal) => ({
        label: String(signal.label || fallbackLabel).slice(0, 80),
        score: asScore(signal.score),
        detail: String(signal.detail || emptyDetail).slice(0, 280),
        category: "pattern",
        evidence: Array.isArray(signal.evidence)
            ? signal.evidence.map((item) => String(item).slice(0, 140)).slice(0, 4)
            : []
    }));
    const rawVerdict = typeof parsed.verdict === "string" ? parsed.verdict : typeof parsed.explanation === "string" ? parsed.explanation : typeof parsed.summary === "string" ? parsed.summary : undefined;
    const verdict = rawVerdict?.trim().slice(0, 500);
    if (signals.length === 0) {
        signals.push({
            label: fallbackLabel,
            score: probability,
            detail: emptyDetail,
            category: "pattern"
        });
    }
    return { probability, signals, verdict };
}
