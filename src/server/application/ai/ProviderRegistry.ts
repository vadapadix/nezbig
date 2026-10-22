import type { AssessmentProvider } from "../../domain/analysis/ports/AssessmentProvider.js";
export class ProviderRegistry {
  private readonly providers = new Map<string, { provider: AssessmentProvider; priority: number }>();
  register(provider: AssessmentProvider, priority: number): this {
    if (this.providers.has(provider.id)) throw new Error(`Duplicate provider: ${provider.id}`);
    this.providers.set(provider.id, { provider, priority });
    return this;
  }
  ordered(): AssessmentProvider[] { return [...this.providers.values()].sort((a, b) => a.priority - b.priority).map(item => item.provider); }
}
