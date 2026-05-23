import { analyzeWithNvidiaNim } from "./nvidiaNimAi.js";
import { analyzeWithOpenRouter } from "./openrouterAi.js";
import type { AiSignal, LlmOpinion } from "../shared/types.js";

type LocalAiResult = {
  probability: number;
  signals: AiSignal[];
};

export async function analyzeWithLlmProviders(text: string, localAi: LocalAiResult): Promise<LlmOpinion | null> {
  const errors: string[] = [];

  for (const [label, provider] of [
    ["NVIDIA NIM", analyzeWithNvidiaNim],
    ["OpenRouter", analyzeWithOpenRouter]
  ] as const) {
    try {
      const result = await provider(text, localAi);
      if (result) return result;
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join(" | "));
  }

  return null;
}
