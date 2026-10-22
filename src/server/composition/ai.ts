import { ProviderRegistry } from "../application/ai/ProviderRegistry.js";
import { AiAssessmentService } from "../application/ai/AiAssessmentService.js";
import { NvidiaNimProvider, OpenRouterProvider } from "../infrastructure/ai/AssessmentProviders.js";
const registry = new ProviderRegistry().register(new NvidiaNimProvider(), 10).register(new OpenRouterProvider(), 20);
export const assessmentService = new AiAssessmentService(registry);
