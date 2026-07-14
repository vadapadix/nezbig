import { scoreCandidate } from "./plagiarismScoring.js";
import { detectAiSignals } from "./aiDetection.js";
import { clampScore } from "./utils/textUtils.js";
import type { AiVerdict, PlagiarismMatch, SearchCandidate, SearchDiagnostics } from "../shared/types.js";

export { scoreCandidate, detectAiSignals };

export function calculateConfirmedPlagiarismScore(matches: PlagiarismMatch[]): number {
  const confirmed = matches.filter((match) => match.confidence === "page").slice(0, 8);
  if (confirmed.length === 0) return 0;

  const weighted = confirmed.reduce((sum, match, index) => {
    const weight = Math.max(0.35, 1 - index * 0.08);
    return sum + match.score * weight;
  }, 0);
  const totalWeight = confirmed.reduce((sum, _match, index) => sum + Math.max(0.35, 1 - index * 0.08), 0);
  return clampScore(weighted / totalWeight);
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
  return `Найсильніший підтверджений збіг: ${top.score}% з "${top.title}". Загальний ризик плагіату: ${plagiarismScore}%. ${aiSummary}${leadNote}`;
}
