import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProviderDiagnostics } from "./ProviderDiagnostics";
import { LanguageProvider } from "../context/LanguageContext";
import type { SearchProviderDiagnostic } from "../../shared/types";

afterEach(() => { cleanup(); localStorage.clear(); });
it.each([
  [undefined, "пошук недоступний"],
  ["quota", "вичерпано квоту"],
  ["access", "перевірте доступ API"],
  ["timeout", "час очікування вичерпано"]
] as const)("labels provider failure %s accurately", (errorCode, label) => {
  localStorage.setItem("nezbig_lang", "uk");
  const provider: SearchProviderDiagnostic = { provider: "Google", attempted: 1, succeeded: 0, failed: 1, timedOut: 0, results: 0, errorCode };
  render(<LanguageProvider><ProviderDiagnostics diagnostics={{ providers: [provider], pages: { attempted: 0, verified: 0, unavailable: 0, cacheHits: 0, negativeCacheHits: 0 } }} /></LanguageProvider>);
  expect(screen.getByText(new RegExp(label))).toBeVisible();
  if (!errorCode) expect(screen.queryByText(/квот/)).not.toBeInTheDocument();
});
