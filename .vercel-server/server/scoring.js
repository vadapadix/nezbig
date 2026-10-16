import { scoreCandidate } from "./plagiarismScoring.js";
import { detectAiSignals } from "./aiDetection.js";
import { clampScore } from "./utils/textUtils.js";
export { scoreCandidate, detectAiSignals };
export async function rerankCandidates(query, candidates) {
    const apiKey = process.env.COHERE_API_KEY?.trim();
    if (!apiKey || candidates.length === 0)
        return candidates;
    try {
        const response = await fetch("https://api.cohere.ai/v1/rerank", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "rerank-multilingual-v3.0",
                query,
                documents: candidates.map((c) => c.sourceText || c.snippet),
                top_n: candidates.length
            })
        });
        if (!response.ok) {
            console.warn(`Cohere rerank failed: HTTP ${response.status}`);
            return candidates;
        }
        const payload = (await response.json());
        if (!payload.results)
            return candidates;
        // Attach relevance score and sort
        const reranked = payload.results
            .map((r) => ({
            ...candidates[r.index],
            relevanceScore: r.relevance_score
        }))
            .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
        return reranked;
    }
    catch (error) {
        console.warn("Error during semantic reranking:", error);
        return candidates;
    }
}
export function calculateConfirmedPlagiarismScore(matches) {
    const confirmed = matches.filter((match) => match.confidence === "page");
    if (confirmed.length === 0)
        return 0;
    return clampScore(Math.max(...confirmed.map(match => match.score)));
}
function summarizeAi(aiProbability, verdict) {
    if (verdict === "insufficient")
        return "Для локального AI-висновку недостатньо авторського тексту.";
    if (verdict === "mixed")
        return `Локальний AI-аналіз виявив неоднорідні сегменти; індикатор ризику: ${aiProbability}%.`;
    if (verdict === "uncertain")
        return `Локальний AI-аналіз невизначений; індикатор ризику: ${aiProbability}%.`;
    if (verdict === "high")
        return `Локальний AI-аналіз показує високий ризик; індикатор: ${aiProbability}%.`;
    if (verdict === "elevated")
        return `Локальний AI-аналіз показує підвищений ризик; індикатор: ${aiProbability}%.`;
    return `Локальний AI-аналіз показує низький ризик; індикатор: ${aiProbability}%.`;
}
export function summarizeReport(plagiarismScore, aiProbability, matches, searchDiagnostics, aiVerdict = "low") {
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
