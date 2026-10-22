import type { LocalAiResult } from "../types/AiAssessment.js";
import type { LlmOpinion } from "../../../../shared/types/index.js";
export interface AssessmentProvider {
  readonly id: string;
  readonly label: string;
  assess(text: string, context: LocalAiResult): Promise<LlmOpinion | null>;
}
