import { normalizeWhitespace } from "./chunking.js";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_ANALYSIS_CHARS = 18000;
const FALLBACK_MODELS = [
    "openrouter/owl-alpha",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openai/gpt-oss-120b:free",
    "deepseek/deepseek-v4-flash:free",
    "z-ai/glm-4.5-air:free"
];
function getOpenRouterConfig() {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    const primaryModel = process.env.OPENROUTER_MODEL?.trim();
    const envFallbacks = process.env.OPENROUTER_FALLBACK_MODELS?.split(",").map((model) => model.trim()).filter(Boolean) ?? [];
    const models = [...new Set([primaryModel, ...envFallbacks, ...FALLBACK_MODELS].filter(Boolean))];
    if (!apiKey || models.length === 0)
        return null;
    return { apiKey, models };
}
function extractJsonObject(content) {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const raw = fenced?.[1] ?? content;
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
        throw new Error("OpenRouter returned no JSON object.");
    }
    return JSON.parse(raw.slice(start, end + 1));
}
function asScore(value) {
    const number = Number(value);
    if (!Number.isFinite(number))
        return 0;
    return Math.max(0, Math.min(100, Math.round(number)));
}
function parseAiResult(content, model, attemptedModels) {
    const parsed = extractJsonObject(content);
    const signals = (Array.isArray(parsed.signals) ? parsed.signals : [])
        .slice(0, 6)
        .map((signal) => ({
        label: String(signal.label || "OpenRouter Signal").slice(0, 80),
        score: asScore(signal.score),
        detail: String(signal.detail || "Model identified this as a relevant authorship signal.").slice(0, 280),
        category: "pattern",
        evidence: Array.isArray(signal.evidence) ? signal.evidence.map((item) => String(item).slice(0, 140)).slice(0, 4) : []
    }));
    return {
        provider: "openrouter",
        model,
        note: attemptedModels.length > 1 ? `AI fallback: спрацювала ${model}; перед цим пробували ${attemptedModels.slice(0, -1).join(", ")}.` : undefined,
        probability: asScore(parsed.probability),
        signals: signals.length > 0
            ? signals
            : [
                {
                    label: "OpenRouter AI Оцінка",
                    score: asScore(parsed.probability),
                    detail: "Модель повернула загальну оцінку без деталізованих сигналів.",
                    category: "pattern"
                }
            ]
    };
}
function buildMessages(text, localAi) {
    const sample = normalizeWhitespace(text).slice(0, MAX_ANALYSIS_CHARS);
    return [
        {
            role: "system",
            content: "You are a careful authorship-risk analyst for Ukrainian and English text. Return only valid JSON. Do not claim certainty. Treat AI detection as probabilistic. Penalize false positives for citations, personal voice, concrete data, and domain-specific vocabulary."
        },
        {
            role: "user",
            content: `Analyze whether this text appears AI-generated. Use the local heuristic only as context, not as truth.

Return JSON with this exact shape:
{
  "probability": 0-100,
  "signals": [
    {
      "label": "short Ukrainian or English label",
      "score": 0-100,
      "detail": "one sentence explaining the signal and uncertainty",
      "evidence": ["short quoted or paraphrased evidence"]
    }
  ]
}

Local heuristic probability: ${localAi.probability}
Local heuristic signals: ${JSON.stringify(localAi.signals.slice(0, 6))}

Text:
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
            max_tokens: 900
        };
    }
    async function send(model, useJsonMode) {
        const baseBody = baseBodyFor(model);
        const response = await fetch(OPENROUTER_URL, {
            method: "POST",
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
        const content = payload.choices?.[0]?.message?.content;
        if (!content) {
            errors.push(`${model}: OpenRouter returned an empty response.`);
            continue;
        }
        try {
            const result = parseAiResult(content, model, attemptedModels);
            return {
                aiProbability: result.probability,
                aiProvider: "openrouter",
                aiModel: result.model,
                aiNote: result.note,
                aiSignals: result.signals
            };
        }
        catch (error) {
            errors.push(`${model}: ${error instanceof Error ? error.message : "invalid JSON response"}`);
        }
    }
    throw new Error(`Усі OpenRouter моделі недоступні: ${errors.join(" | ")}`);
}
