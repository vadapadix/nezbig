import type { LlmOpinion, ScanReport } from "../../shared/types";

export function formatNumber(value: number, lang: "uk" | "en" = "uk"): string {
  return new Intl.NumberFormat(lang === "uk" ? "uk-UA" : "en-US").format(value);
}

export function riskLabel(value: number, lang: "uk" | "en" = "uk"): string {
  if (value >= 70) return lang === "uk" ? "Високий" : "High";
  if (value >= 38) return lang === "uk" ? "Середній" : "Moderate";
  return lang === "uk" ? "Низький" : "Low";
}

export function reliabilityLabel(level: ScanReport["aiReliability"]["level"], lang: "uk" | "en" = "uk"): string {
  if (level === "high") return lang === "uk" ? "висока" : "high";
  if (level === "medium") return lang === "uk" ? "середня" : "medium";
  return lang === "uk" ? "низька" : "low";
}

export function aiVerdictLabel(verdict: ScanReport["aiVerdict"], lang: "uk" | "en" = "uk"): string {
  if (verdict === "insufficient") return lang === "uk" ? "Недостатньо даних" : "Insufficient data";
  if (verdict === "mixed") return lang === "uk" ? "Змішаний документ" : "Mixed content";
  if (verdict === "uncertain") return lang === "uk" ? "Невизначений результат" : "Uncertain result";
  if (verdict === "high") return lang === "uk" ? "Високий ризик" : "High risk";
  if (verdict === "elevated") return lang === "uk" ? "Підвищений ризик" : "Elevated risk";
  return lang === "uk" ? "Низький ризик" : "Low risk";
}

export function languageLabel(code: ScanReport["aiLanguage"]["code"], lang: "uk" | "en" = "uk"): string {
  if (code === "uk") return lang === "uk" ? "українська" : "Ukrainian";
  if (code === "en") return lang === "uk" ? "англійська" : "English";
  if (code === "mixed") return lang === "uk" ? "українська + англійська" : "Ukrainian + English";
  return lang === "uk" ? "обмежене покриття" : "Limited coverage";
}

export function aiMetricCaption(report: ScanReport, lang: "uk" | "en" = "uk"): string {
  const reliabilityWord = lang === "uk" ? "надійність" : "reliability";
  return `${aiVerdictLabel(report.aiVerdict, lang)} · ${reliabilityWord} ${report.aiReliability.score}/100`;
}

export function uncertaintyBand(report: ScanReport): number {
  const base = (100 - report.aiReliability.score) * 0.25;
  const spreadBonus = Math.min(15, report.aiReliability.segmentSpread * 0.15);
  const shortTextPenalty = report.wordCount < 240 ? 8 : 0;
  const band = base + spreadBonus + shortTextPenalty;
  return Math.max(4, Math.min(35, Math.round(band)));
}

export function reportSummaryText(report: ScanReport, lang: "uk" | "en" = "uk"): string {
  if (report.aiOpinionProbability === undefined) return report.summary;
  if (lang === "uk") {
    return `${report.summary} AI-думка показана окремо: ${report.aiOpinionProbability}%.`;
  }
  return `${report.summary} AI opinion shown separately: ${report.aiOpinionProbability}%.`;
}

export function summarizeAiError(error: unknown, lang: "uk" | "en" = "uk"): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/rate-limited|rate.?limit|429/i.test(message)) {
    return lang === "uk" ? "модель тимчасово обмежена лімітом запитів" : "rate limit exceeded on AI model";
  }
  if (/insufficient_quota|out of credits|quota/i.test(message)) {
    return lang === "uk" ? "у провайдера закінчилася квота" : "provider quota exceeded";
  }
  if (/aborted|timeout/i.test(message)) {
    return lang === "uk" ? "модель не відповіла вчасно" : "AI model timed out";
  }
  if (/empty response/i.test(message)) {
    return lang === "uk" ? "модель повернула порожню відповідь" : "AI model returned empty response";
  }
  return message.slice(0, 180);
}

export function isDuplicateOpinionSignal(signal: LlmOpinion["aiSignals"][number], localSignals: ScanReport["aiSignals"]): boolean {
  const normalizedLabel = signal.label.trim().toLowerCase();
  return localSignals.some((localSignal) => localSignal.label.trim().toLowerCase() === normalizedLabel);
}

export function formatAiOpinionVerdict(report: ScanReport, lang: "uk" | "en" = "uk"): string {
  if (report.aiOpinionVerdict && report.aiOpinionVerdict.trim().length > 15) {
    return report.aiOpinionVerdict.trim();
  }

  // If aiOpinionNote is set, ensure it's not a technical fallback or provider log
  if (report.aiOpinionNote && !/fallback|openrouter|nvidia|спрацювала|пробували|nemotron|llama|gemma|api[_-]?ключ|http/i.test(report.aiOpinionNote)) {
    return report.aiOpinionNote.trim();
  }

  const prob = report.aiOpinionProbability ?? 0;
  if (prob < 18) {
    return lang === "uk"
      ? "Текст демонструє високу природність та автентичний авторський стиль: динамічний ритм, живу варіативність речень та багату лексику. Ознак штучної генерації не виявлено."
      : "The text demonstrates high naturalness and authentic authorship: dynamic rhythm, varied sentence lengths, and rich vocabulary. No synthetic AI patterns detected.";
  }
  if (prob < 45) {
    return lang === "uk"
      ? "Текст здебільшого відповідає природному стилю написання, проте окремі фрагменти містять підвищену однорідність синтаксису чи стандартні академічні кліше. Загальний ризик використання ШІ низький."
      : "The text mostly matches natural human writing, though certain segments display elevated syntactic uniformity or standard academic transitional phrases. Overall AI risk is low.";
  }
  if (prob < 70) {
    return lang === "uk"
      ? "Виявлено помітні ознаки комп'ютерної генерації або глибокого редагування ШІ: передбачувана структура абзаців, згладжений ритм речень, надмірне використання стандартних зв'язок та низька варіативність синтаксису."
      : "Noticeable indicators of computer generation or extensive AI editing detected: predictable paragraph structure, smoothed sentence rhythm, excessive transitional clichés, and limited syntactic variance.";
  }
  return lang === "uk"
    ? "Висока ймовірність генерації штучним інтелектом: виявлено характерні структурні патерни мовних моделей — симетричну довжину речень, тріадні переліки, формульні конструкції переходів та відсутність живої авторської нерівномірності ритму."
    : "High probability of AI generation: characteristic LLM structural patterns detected — symmetrical sentence lengths, triadic list groupings, formulaic transitional phrases, and absence of natural human rhythmic burstiness.";
}
