import type { ProviderRegistry } from "./ProviderRegistry.js";
import type { LocalAiResult } from "../../domain/analysis/types/AiAssessment.js";
import type { LlmOpinion } from "../../../shared/types/index.js";
export class AiAssessmentService {
  constructor(private readonly registry: ProviderRegistry) {}
  async assess(text: string, localAi: LocalAiResult): Promise<LlmOpinion | null> {
    const errors: string[] = [];
    for (const provider of this.registry.ordered()) {
      try {
        const result = await provider.assess(text, localAi);
        if (result) return result;
      } catch (error) { errors.push(`${provider.label}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    if (errors.length) throw new Error(errors.join(" | "));
    return null;
  }
}
