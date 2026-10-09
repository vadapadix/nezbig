import { buildAnalysisSample, JSON_SHAPE_PROMPT, parseAuthorshipResult, withTimeout } from "./llmShared.js";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_TIMEOUT_MS = 24_000;
const FALLBACK_MODELS = [
    "openrouter/free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "liquid/lfm-2.5-2.6b:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
];
function getOpenRouterConfig() {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    const primaryModel = process.env.OPENROUTER_MODEL?.trim() || "openrouter/free";
    const envFallbacks = process.env.OPENROUTER_FALLBACK_MODELS?.split(",")
        .map((model) => model.trim())
        .filter(Boolean) ?? [];
    const models = [...new Set([primaryModel, ...envFallbacks, ...FALLBACK_MODELS].filter(Boolean))];
    if (!apiKey || models.length === 0)
        return null;
    return { apiKey, models };
}
function buildMessages(text, localAi) {
    const sample = buildAnalysisSample(text, localAi.suspiciousExcerpts ?? []);
    return [
        {
            role: "system",
            content: "You are an expert academic authorship and AI-stylometry analyst evaluating Ukrainian and English text based on empirical detection research (2024–2026). Return only valid JSON matching the requested schema. Treat AI detection as strictly probabilistic. Ground your evaluation in proven linguistic markers: sentence burstiness (CV of sentence length, uniform pacing vs dynamic rhythm), discourse connector over-reliance ('важливо зазначити', 'відіграє ключову роль', 'наріжний камінь', 'furthermore', 'testament to'), triadic rule-of-three structures ('X, Y та Z'), dialectical hedging ('з одного боку ... проте з іншого'), and lexical tail richness (Hapax Legomena). Crucially protect genuine student writing from false positives: formal citations [1], academic tables/figures, and domain terminology are expected in human research and must not be penalized."
        },
        {
            role: "user",
            content: `Analyze whether this text appears AI-generated using modern empirical stylometry markers. Use the local heuristic only as context, not as ground truth.

${JSON_SHAPE_PROMPT}

Local heuristic probability: ${localAi.probability}%
Local heuristic signals: ${JSON.stringify(localAi.signals.slice(0, 8))}

Text sample:
${sample}`
        }
    ];
}
export async function analyzeWithOpenRouter(text, localAi) {
    const config = getOpenRouterConfig();
    if (!config)
        return null;
    const headers = {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
        "http-referer": "http://127.0.0.1:5173",
        "x-title": "Nezbig AntiPlagiarism Checker"
    };
    function baseBodyFor(model) {
        return {
            model,
            messages: buildMessages(text, localAi),
            temperature: 0.1,
            max_tokens: 2500
        };
    }
    async function send(model, useJsonMode) {
        const baseBody = baseBodyFor(model);
        const response = await fetch(OPENROUTER_URL, {
            method: "POST",
            signal: withTimeout(OPENROUTER_TIMEOUT_MS),
            headers,
            body: JSON.stringify({
                ...baseBody,
                ...(useJsonMode ? { response_format: { type: "json_object" } } : {})
            })
        });
        const payload = (await response.json());
        if (!response.ok) {
            const raw = payload.error?.metadata?.raw;
            const provider = payload.error?.metadata?.provider_name;
            const detail = raw ? `${payload.error?.message || "OpenRouter request failed"}: ${raw}` : payload.error?.message;
            throw new Error(provider ? `${model}: ${detail} (${provider})` : `${model}: ${detail || `HTTP ${response.status}`}`);
        }
        return payload;
    }
    const errors = [];
    const attemptedModels = [];
    for (const model of config.models) {
        attemptedModels.push(model);
        let payload;
        try {
            payload = await send(model, true);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!/provider returned error|response_format|json/i.test(message)) {
                errors.push(message);
                continue;
            }
            try {
                payload = await send(model, false);
            }
            catch (fallbackError) {
                errors.push(fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
                continue;
            }
        }
        let content = payload.choices?.[0]?.message?.content?.trim();
        if (!content) {
            const rawReasoning = payload.choices?.[0]?.message?.reasoning ?? payload.choices?.[0]?.message?.reasoning_content;
            if (typeof rawReasoning === "string" && rawReasoning.includes("{")) {
                content = rawReasoning;
            }
        }
        if (!content) {
            try {
                const plainPayload = await send(model, false);
                content = plainPayload.choices?.[0]?.message?.content?.trim();
                if (!content) {
                    const plainReasoning = plainPayload.choices?.[0]?.message?.reasoning ?? plainPayload.choices?.[0]?.message?.reasoning_content;
                    if (typeof plainReasoning === "string" && plainReasoning.includes("{")) {
                        content = plainReasoning;
                    }
                }
            }
            catch {
                // ignore and record failure below
            }
        }
        if (!content) {
            errors.push(`${model}: OpenRouter returned an empty response.`);
            continue;
        }
        try {
            const result = parseAuthorshipResult(content, "OpenRouter AI Оцінка", "Модель повернула загальну оцінку без деталізованих сигналів.");
            const note = attemptedModels.length > 1 ? `AI fallback: спрацювала ${model}; перед цим пробували ${attemptedModels.slice(0, -1).join(", ")}.` : undefined;
            return {
                aiProbability: result.probability,
                aiProvider: "openrouter",
                aiModel: model,
                aiNote: note,
                aiSignals: result.signals
            };
        }
        catch (error) {
            errors.push(`${model}: ${error instanceof Error ? error.message : "invalid JSON response"}`);
        }
    }
    throw new Error(`Усі OpenRouter моделі недоступні: ${errors.join(" | ")}`);
}
