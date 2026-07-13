import { scoreCandidate } from "./plagiarismScoring.js";
import { detectAiSignals } from "./aiDetection.js";
export { scoreCandidate, detectAiSignals };
export function summarizeReport(plagiarismScore, aiProbability, matches) {
    if (matches.length === 0) {
        return `Сильних збігів у відкритих вебджерелах не знайдено. Ризик ШІ: ${aiProbability}%.`;
    }
    const top = matches[0];
    const confidence = top.confidence === "page" ? "сторінку перевірено повним текстом" : "оцінка за уривком пошуку";
    return `Найсильніший збіг: ${top.score}% з "${top.title}" (${confidence}). Загальний ризик плагіату: ${plagiarismScore}%, ризик ШІ: ${aiProbability}%.`;
}
