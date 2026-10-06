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
  if (provider.succeeded === 0) return lang === "uk" ? "недоступний" : "unavailable";
  const resWord = lang === "uk" ? "рез." : "res.";
  return `${provider.succeeded}/${provider.attempted} · ${provider.results} ${resWord}`;
}

export function ProviderDiagnostics({ diagnostics }: { diagnostics: ScanReport["searchDiagnostics"] }) {
  const { lang } = useLanguage();
  if (!diagnostics) return null;

  return (
    <div className="provider-health" aria-label={lang === "uk" ? "Стан пошукових провайдерів" : "Search provider diagnostics"}>
      {diagnostics.providers.map((provider) => (
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
      <span title={lang === "uk" ? "Сторінки, текст яких сервер зміг прочитати для підтвердження збігу" : "Pages fetched and verified in full"}>
        <strong>{lang === "uk" ? "Сторінки" : "Pages"}</strong>
        {lang === "uk"
          ? `${diagnostics.pages.verified} підтвердж. · ${diagnostics.pages.unavailable} недоступ.`
          : `${diagnostics.pages.verified} verified · ${diagnostics.pages.unavailable} unavailable`}
      </span>
    </div>
  );
}
