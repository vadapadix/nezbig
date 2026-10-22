import { scoreCandidate } from "../../domain/analysis/plagiarismScoring.js";
import { detectAiSignals } from "../../domain/analysis/aiDetection.js";
import { clampScore } from "../../domain/utils/textUtils.js";
import type { AiVerdict, PlagiarismMatch, SearchDiagnostics } from "../../../shared/types/index.js";

export { scoreCandidate, detectAiSignals };

export function calculateConfirmedPlagiarismScore(matches: PlagiarismMatch[]): number {
  const confirmed = matches.filter((match) => match.confidence === "page");
  if (confirmed.length === 0) return 0;

  return clampScore(Math.max(...confirmed.map((match) => match.score)));
}

function summarizeAi(aiProbability: number, verdict: AiVerdict): string {
  if (verdict === "insufficient") return "Для локального AI-висновку недостатньо авторського тексту.";
  if (verdict === "mixed") return `Локальний AI-аналіз виявив неоднорідні сегменти; індикатор ризику: ${aiProbability}%.`;
  if (verdict === "uncertain") return `Локальний AI-аналіз невизначений; індикатор ризику: ${aiProbability}%.`;
  if (verdict === "high") return `Локальний AI-аналіз показує високий ризик; індикатор: ${aiProbability}%.`;
  if (verdict === "elevated") return `Локальний AI-аналіз показує підвищений ризик; індикатор: ${aiProbability}%.`;
  return `Локальний AI-аналіз показує низький ризик; індикатор: ${aiProbability}%.`;
}

export function summarizeReport(
  plagiarismScore: number,
  aiProbability: number,
  matches: PlagiarismMatch[],
  searchDiagnostics?: SearchDiagnostics,
  aiVerdict: AiVerdict = "low"
): string {
  const aiSummary = summarizeAi(aiProbability, aiVerdict);
  if (matches.length === 0) {
    const attempted = searchDiagnostics?.providers.reduce((sum, provider) => sum + provider.attempted, 0) ?? 0;
    const succeeded = searchDiagnostics?.providers.reduce((sum, provider) => sum + provider.succeeded, 0) ?? 0;
    const circuitOpen = searchDiagnostics?.providers.some((provider) => /повторних помилок/i.test(provider.skippedReason ?? "")) ?? false;
    if (succeeded === 0 && (attempted > 0 || circuitOpen)) {
      const requestDetail = attempted > 0 ? `усі ${attempted} запитів завершилися помилкою` : "доступні провайдери тимчасово призупинені після помилок";
      return `Вебпошук не завершено: ${requestDetail}. Відсутність збігів не підтверджена. ${aiSummary}`;
    }
    return `Сильних збігів у відкритих вебджерелах не знайдено. ${aiSummary}`;
  }

  const confirmed = matches.filter((match) => match.confidence === "page");
  const leads = matches.length - confirmed.length;
  if (confirmed.length === 0) {
    return `Знайдено ${leads} можливих джерел у пошукових уривках, але текст сторінок не підтверджено. Вони не впливають на ризик плагіату. ${aiSummary}`;
  }

  const top = confirmed[0];
  const leadNote = leads > 0 ? ` Ще ${leads} пошукових підказок потребують підтвердження.` : "";
  return `Найсильніший підтверджений збіг: ${top.score}% з "${top.title}". Сила збігів: ${plagiarismScore}/100; це не частка запозичень у документі. ${aiSummary}${leadNote}`;
}
