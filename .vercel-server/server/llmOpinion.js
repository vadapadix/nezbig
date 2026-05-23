import { analyzeWithNvidiaNim } from "./nvidiaNimAi.js";
import { analyzeWithOpenRouter } from "./openrouterAi.js";
export async function analyzeWithLlmProviders(text, localAi) {
    const errors = [];
    for (const [label, provider] of [
        ["NVIDIA NIM", analyzeWithNvidiaNim],
        ["OpenRouter", analyzeWithOpenRouter]
    ]) {
        try {
            const result = await provider(text, localAi);
            if (result)
                return result;
        }
        catch (error) {
            errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    if (errors.length > 0) {
        throw new Error(errors.join(" | "));
    }
    return null;
}
