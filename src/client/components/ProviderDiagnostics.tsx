import type { ScanReport } from "../../shared/types";
import { ProviderIcon } from "./ProviderIcon";
import { useLanguage, type Language } from "../context/LanguageContext";

function providerDiagnosticLabel(provider: NonNullable<ScanReport["searchDiagnostics"]>["providers"][number], lang: Language): string {
  if (provider.attempted === 0) {
    if (provider.skippedReason?.startsWith("не налаштовано") || provider.skippedReason?.includes("not configured")) {
      return lang === "uk" ? "не підключено" : "not connected";
    }
    return lang === "uk" ? "пропущено" : "skipped";
  }
  if (provider.succeeded === 0) {
    return lang === "uk" ? "ліміт квоти" : "quota limit";
  }
  const resWord = lang === "uk" ? "рез." : "res.";
  return `${provider.succeeded}/${provider.attempted} · ${provider.results} ${resWord}`;
}

export function ProviderDiagnostics({ diagnostics }: { diagnostics: ScanReport["searchDiagnostics"] }) {
  const { lang } = useLanguage();
  if (!diagnostics) return null;

  // De-duplicate by provider name to guarantee no duplicate provider chips appear
  const uniqueProvidersMap = new Map<string, NonNullable<ScanReport["searchDiagnostics"]>["providers"][number]>();
  for (const p of diagnostics.providers) {
    if (p.attempted > 0) {
      const existing = uniqueProvidersMap.get(p.provider);
      if (!existing) {
        uniqueProvidersMap.set(p.provider, { ...p });
      } else {
        existing.attempted += p.attempted;
        existing.succeeded += p.succeeded;
        existing.failed += p.failed;
        existing.timedOut += p.timedOut;
        existing.results += p.results;
      }
    }
  }
  const visibleProviders = Array.from(uniqueProvidersMap.values());
  if (visibleProviders.length === 0 && diagnostics.pages.attempted === 0) return null;

  return (
    <div className="provider-health" aria-label={lang === "uk" ? "Стан пошукових провайдерів" : "Search provider diagnostics"}>
      {visibleProviders.map((provider) => (
        <span
          className={provider.succeeded === 0 ? "provider-health-issue" : ""}
          key={provider.provider}
          title={provider.skippedReason ?? `${provider.failed} errors, ${provider.timedOut} timeout`}
        >
          <span className="provider-health-metric">
            <strong>
              <ProviderIcon provider={provider.provider} /> {provider.provider}
            </strong>
            {providerDiagnosticLabel(provider, lang)}
          </span>
        </span>
      ))}
      {diagnostics.pages.attempted > 0 || diagnostics.pages.verified > 0 ? (
        <span title={lang === "uk" ? "Сторінки, текст яких сервер зміг прочитати для підтвердження збігу" : "Pages fetched and verified in full"}>
          <strong>{lang === "uk" ? "Сторінки" : "Pages"}</strong>
          {lang === "uk"
            ? `${diagnostics.pages.verified} підтвердж. · ${diagnostics.pages.unavailable} недоступ.`
            : `${diagnostics.pages.verified} verified · ${diagnostics.pages.unavailable} unavailable`}
        </span>
      ) : null}
    </div>
  );
}
