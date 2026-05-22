import { normalizeWhitespace } from "./chunking.js";
import { FullTextIndex } from "./fullTextIndex.js";
const STOP_WORDS = new Set([
    "але",
    "або",
    "для",
    "про",
    "при",
    "що",
    "це",
    "цей",
    "ця",
    "цих",
    "так",
    "які",
    "який",
    "яка",
    "було",
    "були",
    "бути",
    "the",
    "and",
    "that",
    "with",
    "from",
    "this",
    "have",
    "are",
    "was",
    "were"
]);
const TRANSITIONS = new Set([
    "therefore",
    "however",
    "moreover",
    "furthermore",
    "additionally",
    "consequently",
    "overall",
    "важливо",
    "отже",
    "проте",
    "однак",
    "таким",
    "загалом",
    "водночас",
    "натомість",
    "по-перше",
    "по-друге",
    "насамкінець"
]);
const HEDGES = new Set(["may", "might", "could", "typically", "often", "може", "ймовірно", "зазвичай", "часто", "можливо", "потенційно"]);
const AI_PATTERN_GROUPS = [
    {
        label: "AI-лексика і канцелярит",
        category: "pattern",
        weight: 1.18,
        patterns: [
            /(?:crucial|pivotal|vibrant|valuable|seamless|robust|innovative|transformative|groundbreaking|comprehensive)/gi,
            /(?:delve|leverage|utilize|enhance|underscore|showcase|foster|facilitate|optimize|navigate the complexities)/gi,
            /(?:ключов(?:ий|а|е|і)|важлив(?:ий|а|е|і)|комплексн(?:ий|а|е|і)|ефективн(?:ий|а|е|і)|інноваційн(?:ий|а|е|і)|унікальн(?:ий|а|е|і))/gi,
            /(?:підкреслює|відіграє ключову роль|сприяє|забезпечує|оптимізує|покращує|розкриває потенціал)/gi
        ]
    },
    {
        label: "Шаблонні переходи",
        category: "pattern",
        weight: 1.08,
        patterns: [
            /(?:moreover|furthermore|additionally|nevertheless|in conclusion|to summarize|it is important to note|it is worth noting)/gi,
            /(?:варто зазначити|слід зазначити|важливо підкреслити|таким чином|у підсумку|на завершення|з огляду на це)/gi
        ]
    },
    {
        label: "Маркетингові або надмірно урочисті фрази",
        category: "pattern",
        weight: 0.96,
        patterns: [
            /(?:stands as|serves as|testament to|in today's fast-paced world|unlock your|harness the power|game-changer|paradigm shift)/gi,
            /(?:є свідченням|слугує прикладом|у сучасному світі|широкий спектр|нові горизонти|важливий крок уперед)/gi
        ]
    },
    {
        label: "Роботична структура",
        category: "structure",
        weight: 1.05,
        patterns: [
            /not only\b[\s\S]{0,90}\bbut also/gi,
            /it's not just\b[\s\S]{0,90}\bit'?s/gi,
            /(?:не лише|не тільки)[\s\S]{0,90}(?:а й|але й)/gi,
            /(?:по-перше|по-друге|по-третє)/gi,
            /(?:firstly|secondly|thirdly)/gi
        ]
    },
    {
        label: "Вагомі, але нечіткі твердження",
        category: "pattern",
        weight: 0.86,
        patterns: [
            /(?:experts argue|observers note|studies show|research suggests|many sources|various factors|numerous examples)/gi,
            /(?:експерти вважають|дослідження показують|численні фактори|різноманітні аспекти|багато джерел|широкий спектр)/gi
        ]
    }
];
function tokenize(text, keepStopWords = false) {
    const tokens = normalizeWhitespace(text)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2);
    return keepStopWords ? tokens : tokens.filter((word) => !STOP_WORDS.has(word));
}
function splitSentences(text) {
    return normalizeWhitespace(text)
        .split(/(?<=[.!?…])\s+/u)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 0);
}
function buildNgrams(tokens, size) {
    const ngrams = new Set();
    for (let index = 0; index <= tokens.length - size; index += 1) {
        ngrams.add(tokens.slice(index, index + size).join(" "));
    }
    return ngrams;
}
function overlapRatio(source, candidate) {
    if (source.size === 0)
        return 0;
    let matches = 0;
    for (const item of source) {
        if (candidate.has(item))
            matches += 1;
    }
    return matches / source.size;
}
function longestCommonRun(source, candidate) {
    const previous = new Array(candidate.length + 1).fill(0);
    const current = new Array(candidate.length + 1).fill(0);
    let longest = 0;
    for (let i = 1; i <= source.length; i += 1) {
        for (let j = 1; j <= candidate.length; j += 1) {
            current[j] = source[i - 1] === candidate[j - 1] ? previous[j - 1] + 1 : 0;
            longest = Math.max(longest, current[j]);
        }
        previous.splice(0, previous.length, ...current);
        current.fill(0);
    }
    return longest;
}
function clampScore(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
}
function standardDeviation(values, average) {
    if (values.length === 0)
        return 0;
    const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
    return Math.sqrt(variance);
}
function coefficientOfVariation(values) {
    if (values.length < 2)
        return 1;
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    if (average === 0)
        return 1;
    return standardDeviation(values, average) / average;
}
function countRegexMatches(text, regex) {
    const matches = text.match(regex) ?? [];
    return matches.map((match) => normalizeWhitespace(match)).filter(Boolean);
}
function sampleEvidence(values, max = 4) {
    return [...new Set(values.map((value) => value.slice(0, 120)))].slice(0, max);
}
function looksLikePlaceholderText(text) {
    const normalized = text.toLowerCase();
    return /lorem ipsum|consectetur adipiscing|suspendisse potenti/.test(normalized);
}
function hasAcademicStructure(text) {
    return /(?<![\p{L}\p{N}_])(зміст|вступ|розділ\s+(?:[0-9]+|[ivx]+)|висновки|список\s+використаних\s+джерел)(?![\p{L}\p{N}_])/iu.test(text);
}
function sourceForCandidate(candidate) {
    const pageText = candidate.sourceText?.trim();
    if (pageText && pageText.split(/\s+/).length >= 18)
        return pageText;
    return `${candidate.title} ${candidate.snippet}`;
}
function stableHash(input) {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function hashTree(tokens, size = 5) {
    const leaves = [];
    for (let index = 0; index <= tokens.length - size; index += 1) {
        leaves.push(stableHash(tokens.slice(index, index + size).join(" ")));
    }
    const hashes = new Set(leaves);
    let level = leaves;
    while (level.length > 1) {
        const next = [];
        for (let index = 0; index < level.length; index += 2) {
            const left = level[index];
            const right = level[index + 1] ?? left;
            next.push(stableHash(`${left}:${right}`));
        }
        for (const hash of next)
            hashes.add(hash);
        level = next;
    }
    return hashes;
}
function setOverlapPercent(source, candidate) {
    if (source.size === 0)
        return 0;
    let overlap = 0;
    for (const hash of source) {
        if (candidate.has(hash))
            overlap += 1;
    }
    return overlap / source.size;
}
export function scoreCandidate(chunkText, candidate, chunkIndex) {
    const sourceTokens = tokenize(chunkText);
    const sourceRunTokens = tokenize(chunkText, true);
    const candidateText = sourceForCandidate(candidate);
    const candidateTokens = tokenize(candidateText).slice(0, 8000);
    const candidateRunTokens = tokenize(candidateText, true).slice(0, 8000);
    const candidateIndex = new FullTextIndex(candidateTokens);
    const candidateSet = new Set(candidateTokens);
    const overlapCount = sourceTokens.filter((token) => candidateSet.has(token)).length;
    const overlapPercent = sourceTokens.length === 0 ? 0 : overlapCount / sourceTokens.length;
    const threeGramOverlap = overlapRatio(buildNgrams(sourceTokens, 3), buildNgrams(candidateTokens, 3));
    const fiveGramOverlap = overlapRatio(buildNgrams(sourceRunTokens, 5), buildNgrams(candidateRunTokens, 5));
    const hashOverlap = setOverlapPercent(hashTree(sourceRunTokens), hashTree(candidateRunTokens));
    const fullTextRank = candidateIndex.rank(sourceTokens);
    const longestRun = longestCommonRun(sourceRunTokens, candidateRunTokens);
    const runScore = Math.min(1, longestRun / 18);
    const phraseScore = Math.max(threeGramOverlap * 0.72, fiveGramOverlap);
    const pageBonus = candidate.sourceText ? 1 : 0.76;
    const score = clampScore((overlapPercent * 0.2 + phraseScore * 0.32 + runScore * 0.22 + hashOverlap * 0.16 + fullTextRank * 0.1) * 100 * pageBonus);
    return {
        ...candidate,
        chunkIndex,
        score,
        overlapPercent: clampScore(overlapPercent * 100),
        ngramOverlapPercent: clampScore(phraseScore * 100),
        hashOverlapPercent: clampScore(hashOverlap * 100),
        fullTextRank: clampScore(fullTextRank * 100),
        longestRun,
        confidence: candidate.sourceText ? "page" : "snippet",
        excerpt: normalizeWhitespace(chunkText).split(" ").slice(0, 48).join(" ")
    };
}
function patternSignals(normalized, wordCount) {
    return AI_PATTERN_GROUPS.map((group) => {
        const matches = group.patterns.flatMap((pattern) => countRegexMatches(normalized, pattern));
        const density = matches.length / Math.max(1, wordCount / 220);
        const score = clampScore(Math.min(1, density / 4.2) * 100);
        return {
            label: group.label,
            score,
            category: group.category,
            evidence: sampleEvidence(matches),
            detail: matches.length > 0
                ? `Знайдено ${matches.length} характерних маркерів. Вони самі по собі не доводять ШІ, але підсилюють підозру разом з іншими ознаками.`
                : "Явних маркерів цієї групи не знайдено.",
            weight: group.weight
        };
    });
}
function sentenceStartRepetition(sentences) {
    const starts = sentences
        .map((sentence) => tokenize(sentence, true).slice(0, 3).join(" "))
        .filter((start) => start.length > 4);
    const counts = new Map();
    for (const start of starts)
        counts.set(start, (counts.get(start) ?? 0) + 1);
    const repeated = [...counts.entries()].filter(([, count]) => count >= 2);
    const score = clampScore((repeated.reduce((sum, [, count]) => sum + count, 0) / Math.max(1, starts.length)) * 160);
    return { score, evidence: repeated.map(([start, count]) => `${start} (${count}x)`).slice(0, 4) };
}
function ngramRepetition(tokens) {
    const counts = new Map();
    for (let index = 0; index <= tokens.length - 4; index += 1) {
        const gram = tokens.slice(index, index + 4).join(" ");
        counts.set(gram, (counts.get(gram) ?? 0) + 1);
    }
    const repeated = [...counts.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]);
    const score = clampScore((repeated.reduce((sum, [, count]) => sum + count - 1, 0) / Math.max(1, tokens.length / 120)) * 55);
    return { score, evidence: repeated.map(([gram, count]) => `${gram} (${count}x)`).slice(0, 4) };
}
function safeguardScore(normalized, wordCount, placeholderText, academicStructure) {
    const citations = countRegexMatches(normalized, /\[[0-9]{1,3}\]|\([A-ZА-ЯІЇЄҐ][\p{L}'-]+,\s*20[0-9]{2}\)|https?:\/\/\S+|doi:\s*\S+/giu);
    const numbers = countRegexMatches(normalized, /\b\d+(?:[.,]\d+)?\s*(?:%|грн|uah|usd|км|м|року|р\.|рік|years?)?\b/giu);
    const firstPerson = countRegexMatches(normalized, /\b(?:я|мені|мою|моє|ми|наш|наша|i|my|we|our)\b/giu);
    const quotes = countRegexMatches(normalized, /["“„«][^"”»]{12,}["”»]/gu);
    const evidence = [
        citations.length ? `${citations.length} посилань або бібліографічних маркерів` : "",
        numbers.length >= 3 ? `${numbers.length} числових/фактичних маркерів` : "",
        firstPerson.length >= 2 ? `${firstPerson.length} маркерів авторської позиції` : "",
        quotes.length ? `${quotes.length} довгих цитат` : "",
        wordCount < 180 ? "короткий текст: нижча надійність AI-оцінки" : "",
        placeholderText ? "lorem ipsum / шаблонний наповнювач" : "",
        academicStructure ? "академічна структура: вступ, розділи або висновки не вважаються AI-ознакою" : ""
    ].filter(Boolean);
    const score = clampScore(citations.length * 10 + Math.min(18, numbers.length * 2) + Math.min(14, firstPerson.length * 3) + quotes.length * 8 + (wordCount < 180 ? 16 : 0) + (placeholderText ? 80 : 0) + (academicStructure ? 22 : 0));
    return { score, evidence };
}
export function detectAiSignals(text) {
    const normalized = normalizeWhitespace(text);
    const lower = normalized.toLowerCase();
    const words = tokenize(normalized, true);
    const contentWords = tokenize(normalized);
    const sentences = splitSentences(normalized);
    const wordCount = words.length;
    const uniqueRatio = wordCount === 0 ? 0 : new Set(words).size / wordCount;
    const sentenceLengths = sentences.map((sentence) => tokenize(sentence, true).length).filter(Boolean);
    const averageSentence = sentenceLengths.reduce((sum, value) => sum + value, 0) / Math.max(1, sentenceLengths.length);
    const sentenceCv = coefficientOfVariation(sentenceLengths);
    const transitionDensity = words.filter((word) => TRANSITIONS.has(word)).length / Math.max(1, wordCount);
    const hedgeDensity = words.filter((word) => HEDGES.has(word)).length / Math.max(1, wordCount);
    const placeholderText = looksLikePlaceholderText(normalized);
    const academicStructure = hasAcademicStructure(normalized);
    const repeatedStarts = sentenceStartRepetition(sentences);
    const repeatedNgrams = ngramRepetition(contentWords);
    const safeguards = safeguardScore(normalized, wordCount, placeholderText, academicStructure);
    const rhythmScore = clampScore((1 - Math.min(1, sentenceCv / 0.58)) * 100 * (sentences.length >= 5 ? 1 : 0.55));
    const lexicalScore = clampScore(Math.max(0, 0.6 - uniqueRatio) * 170 + repeatedNgrams.score * 0.28);
    const transitionScore = clampScore(transitionDensity * 3100);
    const hedgeScore = clampScore(hedgeDensity * 3300);
    const punctuationTypes = new Set((normalized.replace(/--|—|–/g, "").match(/[;:!?()[\]]/g) ?? []).map((value) => value));
    const punctuationScore = clampScore(sentences.length >= 8 && punctuationTypes.size <= 1 ? 28 : 0);
    const patternBased = patternSignals(lower, wordCount);
    const signalDrafts = [
        {
            label: "Рівномірність речень",
            score: rhythmScore,
            category: "statistical",
            detail: rhythmScore >= 55
                ? `Речення мають надто рівний темп: середня довжина ${averageSentence.toFixed(1)} слів, коефіцієнт варіації ${sentenceCv.toFixed(2)}.`
                : "Довжина речень достатньо різна, це знижує підозру на машинно згладжений стиль.",
            evidence: sentences.length >= 2 ? sentenceLengths.slice(0, 8).map((length) => `${length} слів`) : [],
            weight: 0.76
        },
        {
            label: "Лексична передбачуваність",
            score: lexicalScore,
            category: "statistical",
            detail: lexicalScore >= 50
                ? `Низька різноманітність або повтори фраз: унікальність словника ${(uniqueRatio * 100).toFixed(0)}%.`
                : `Унікальність словника ${(uniqueRatio * 100).toFixed(0)}%, масових повторів не видно.`,
            evidence: repeatedNgrams.evidence,
            weight: 0.86
        },
        {
            label: "Формальні переходи",
            score: transitionScore,
            category: "pattern",
            detail: transitionScore >= 45 ? "Текст часто використовує типові переходи, які LLM люблять для гладкої структури." : "Перехідні слова не домінують.",
            evidence: sampleEvidence(words.filter((word) => TRANSITIONS.has(word))),
            weight: 0.88
        },
        {
            label: "Обережні формулювання",
            score: hedgeScore,
            category: "pattern",
            detail: hedgeScore >= 45 ? "Є висока частка обережних слів, що можуть розмивати авторську позицію." : "Обережні формулювання не домінують.",
            evidence: sampleEvidence(words.filter((word) => HEDGES.has(word))),
            weight: 0.7
        },
        {
            label: "Повтор початку речень",
            score: repeatedStarts.score,
            category: "structure",
            detail: repeatedStarts.score >= 45 ? "Кілька речень починаються однаково, що схоже на шаблонне генерування." : "Початки речень достатньо різні.",
            evidence: repeatedStarts.evidence,
            weight: 0.74
        },
        {
            label: "Одноманітна пунктуація",
            score: punctuationScore,
            category: "structure",
            detail: punctuationScore >= 45 ? "Пунктуація надто рівна за різними реченнями." : "Пунктуаційний малюнок не виглядає шаблонним; тире й подвійні дефіси не рахуються як AI-ознака.",
            evidence: punctuationTypes.size ? [`${punctuationTypes.size} типів пунктуаційних маркерів`] : [],
            weight: 0.46
        },
        ...patternBased
    ];
    const evidenceSignals = signalDrafts.filter((signal) => signal.score >= 32);
    const weightedRaw = signalDrafts.reduce((sum, signal) => sum + signal.score * signal.weight, 0) / signalDrafts.reduce((sum, signal) => sum + signal.weight, 0);
    const corroborationFactor = evidenceSignals.length <= 1 ? 0.62 : evidenceSignals.length === 2 ? 0.78 : evidenceSignals.length === 3 ? 0.9 : 1;
    const lengthFactor = wordCount < 120 ? (evidenceSignals.length >= 4 ? 0.92 : 0.62) : wordCount < 260 ? (evidenceSignals.length >= 4 ? 0.96 : 0.84) : 1;
    const effectiveSafeguardScore = wordCount < 180 && evidenceSignals.length >= 4 ? Math.max(0, safeguards.score - 16) : safeguards.score;
    const safeguardPenalty = Math.min(42, effectiveSafeguardScore * 0.55);
    const patternClusterBoost = evidenceSignals.filter((signal) => signal.category === "pattern" && signal.score >= 65).length >= 3 ? 14 : 0;
    const probability = placeholderText ? Math.min(12, clampScore(weightedRaw)) : clampScore(weightedRaw * corroborationFactor * lengthFactor - safeguardPenalty + patternClusterBoost);
    const signals = signalDrafts
        .map(({ weight: _weight, ...signal }) => signal)
        .filter((signal) => signal.score >= 18 || signal.evidence?.length)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    signals.push({
        label: "Запобіжники від false positive",
        score: Math.min(100, safeguards.score),
        category: "safeguard",
        detail: safeguards.score > 0
            ? "Ці ознаки зменшують підсумкову AI-оцінку, бо часто трапляються в людських академічних або робочих текстах."
            : "Сильних запобіжних ознак не знайдено.",
        evidence: safeguards.evidence
    });
    return { probability, signals };
}
export function summarizeReport(plagiarismScore, aiProbability, matches) {
    if (matches.length === 0) {
        return `Сильних збігів у відкритих вебджерелах не знайдено. Розширені AI-сигнали: ${aiProbability}%.`;
    }
    const top = matches[0];
    const confidence = top.confidence === "page" ? "сторінку перевірено повним текстом" : "оцінка за уривком пошуку";
    return `Найсильніший збіг: ${top.score}% з "${top.title}" (${confidence}). Загальний ризик плагіату: ${plagiarismScore}%, розширені AI-сигнали: ${aiProbability}%.`;
}
