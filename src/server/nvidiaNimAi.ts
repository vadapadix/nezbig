import { normalizeWhitespace } from "./chunking.js";
import type { AiSignal, LlmOpinion } from "../shared/types.js";

type LocalAiResult = {
  probability: number;
  signals: AiSignal[];
};

type NvidiaResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const NVIDIA_NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_TIMEOUT_MS = 32_000;
const MAX_ANALYSIS_CHARS = 18000;
const DEFAULT_NIM_MODELS = ["nvidia/llama-3.1-nemotron-ultra-253b-v1", "meta/llama-3.3-70b-instruct", "meta/llama-3.1-70b-instruct"];

function getNvidiaConfig(): { apiKey: string; models: string[] } | null {
  const apiKey = process.env.NVIDIA_NIM_API_KEY?.trim() || process.env.NVIDIA_API_KEY?.trim();
  const primaryModel = process.env.NVIDIA_NIM_MODEL?.trim();
  const envFallbacks = process.env.NVIDIA_NIM_FALLBACK_MODELS?.split(",").map((model) => model.trim()).filter(Boolean) ?? [];
  const models = [...new Set([primaryModel, ...envFallbacks, ...DEFAULT_NIM_MODELS].filter(Boolean) as string[])];

  if (!apiKey || models.length === 0) return null;
  return { apiKey, models };
}

function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms).unref();
  return controller.signal;
}

function asScore(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function extractJsonObject(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? content;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("NVIDIA NIM returned no JSON object.");
  }

  return JSON.parse(raw.slice(start, end + 1));
}

function buildMessages(text: string, localAi: LocalAiResult) {
  const sample = normalizeWhitespace(text).slice(0, MAX_ANALYSIS_CHARS);
  return [
    {
      role: "system",
      content:
        "You are an authorship-risk analyst for Ukrainian academic prose. Return only valid JSON. Ignore code. AI detection is probabilistic. Do not reduce risk just because the text has course-work headings."
    },
    {
      role: "user",
      content: `Estimate whether the prose was written by an AI model. Return JSON only:
{
  "probability": 0-100,
  "signals": [
    { "label": "short Ukrainian label", "score": 0-100, "detail": "one sentence", "evidence": ["short evidence"] }
  ]
}

Local heuristic probability: ${localAi.probability}
Local heuristic signals: ${JSON.stringify(localAi.signals.slice(0, 8))}

Text:
${sample}`
    }
  ];
}

function parseNimResult(content: string, model: string, attemptedModels: string[]): LlmOpinion {
  const parsed = extractJsonObject(content) as {
    probability?: unknown;
    signals?: Array<{
      label?: unknown;
      score?: unknown;
      detail?: unknown;
      evidence?: unknown;
    }>;
  };
  const probability = asScore(parsed.probability);
  const signals = (Array.isArray(parsed.signals) ? parsed.signals : []).slice(0, 6).map(
    (signal): AiSignal => ({
      label: String(signal.label || "NVIDIA NIM AI Оцінка").slice(0, 80),
      score: asScore(signal.score),
      detail: String(signal.detail || "Модель NVIDIA NIM визначила це як релевантний авторський сигнал.").slice(0, 280),
      category: "pattern",
      evidence: Array.isArray(signal.evidence) ? signal.evidence.map((item) => String(item).slice(0, 140)).slice(0, 4) : []
    })
  );

  return {
    aiProbability: probability,
    aiProvider: "nvidia-nim",
    aiModel: model,
    aiNote: attemptedModels.length > 1 ? `NVIDIA NIM fallback: спрацювала ${model}; перед цим пробували ${attemptedModels.slice(0, -1).join(", ")}.` : undefined,
    aiSignals:
      signals.length > 0
        ? signals
        : [
            {
              label: "NVIDIA NIM AI Оцінка",
              score: probability,
              detail: "NVIDIA NIM повернула загальну оцінку без деталізованих сигналів.",
              category: "pattern"
            }
          ]
  };
}

export async function analyzeWithNvidiaNim(text: string, localAi: LocalAiResult): Promise<LlmOpinion | null> {
  const config = getNvidiaConfig();
  if (!config) return null;

  const errors: string[] = [];
  const attemptedModels: string[] = [];

  for (const model of config.models) {
    attemptedModels.push(model);
    try {
      const response = await fetch(NVIDIA_NIM_URL, {
        method: "POST",
        signal: withTimeout(NVIDIA_TIMEOUT_MS),
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify({
          model,
          messages: buildMessages(text, localAi),
          temperature: 0.1,
          max_tokens: 900,
          stream: false
        })
      });
      const payload = (await response.json()) as NvidiaResponse;

      if (!response.ok) {
        errors.push(`${model}: ${payload.error?.message || `HTTP ${response.status}`}`);
        continue;
      }

      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        errors.push(`${model}: NVIDIA NIM returned an empty response.`);
        continue;
      }

      return parseNimResult(content, model, attemptedModels);
    } catch (error) {
      errors.push(`${model}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Усі NVIDIA NIM моделі недоступні: ${errors.join(" | ")}`);
}
