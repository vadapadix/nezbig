import type { AssessmentProvider } from "../../domain/analysis/ports/AssessmentProvider.js";
import type { LocalAiResult } from "../../domain/analysis/types/AiAssessment.js";
import { analyzeWithNvidiaNim } from "./nvidiaNimAi.js";
import { analyzeWithOpenRouter } from "./openrouterAi.js";
export class NvidiaNimProvider implements AssessmentProvider {
  readonly id = "nvidia-nim";
  readonly label = "NVIDIA NIM";
  assess(text: string, context: LocalAiResult) { return analyzeWithNvidiaNim(text, context); }
}
export class OpenRouterProvider implements AssessmentProvider {
  readonly id = "openrouter";
  readonly label = "OpenRouter";
  assess(text: string, context: LocalAiResult) { return analyzeWithOpenRouter(text, context); }
}
