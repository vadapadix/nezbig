import { normalizeWhitespace } from "./chunking.js";
import { tokenize, splitSentences, clampScore, coefficientOfVariation, countRegexMatches, sampleEvidence, } from "./utils/textUtils.js";
const TRANSITIONS = new Set([
    "therefore", "however", "moreover", "furthermore", "additionally", "consequently", "overall",
    "важливо", "отже", "проте", "однак", "таким", "загалом", "водночас", "натомість", "по-перше", "по-друге", "насамкінець"
]);
const HEDGES = new Set(["may", "might", "could", "typically", "often", "може", "ймовірно", "зазвичай", "часто", "можливо", "потенційно"]);
const AI_PATTERN_GROUPS = [
    {
        label: "AI-лексика і канцелярит",
        category: "pattern",
        weight: 1.35,
        patterns: [
            /(?:crucial|pivotal|vibrant|valuable|seamless|robust|innovative|transformative|groundbreaking|comprehensive|meticulous|unwavering|versatile|alignment|synergy)/gi,
            /(?:delve|leverage|utilize|enhance|underscore|showcase|foster|facilitate|optimize|navigate the complexities|tapestry of|testament to|evolving landscape|rapidly changing)/gi,
            /(?:ключов(?:ий|а|е|і)|важлив(?:ий|а|е|і)|комплексн(?:ий|а|е|і)|ефективн(?:ий|а|е|і)|інноваційн(?:ий|а|е|і)|унікальн(?:ий|а|е|і)|перспектив(?:ний|на|не|ні)|значн(?:ий|а|е|і)|активн(?:о|ий|а|е|і))/gi,
            /(?:підкреслює|відіграє ключову роль|сприяє|забезпечує|оптимізує|покращує|розкриває потенціал|важливо розуміти|варто відмітити|варто зауважити|відіграє роль|має значення|вимагає уваги)/gi,
            /(?:актуальність\s+теми|мета\s+роботи\s+полягає|об['’]єктом\s+дослідження|предметом\s+дослідження|практичне\s+значення|теоретичне\s+значення)/gi
        ]
    },
    {
        label: "Шаблонні переходи та зв'язки",
        category: "pattern",
        weight: 1.2,
        patterns: [
            /(?:moreover|furthermore|additionally|nevertheless|in conclusion|to summarize|it is important to note|it is worth noting|lastly|first and foremost|on the other hand|consequently)/gi,
            /(?:варто зазначити|слід зазначити|важливо підкреслити|таким чином|у підсумку|на завершення|з огляду на це|по-перше|зокрема|з іншого боку|крім того|водночас)/gi
        ]
    },
    {
        label: "Роботична структура та синтаксис",
        category: "structure",
        weight: 1.15,
        patterns: [
            /not only\b[\s\S]{0,90}\bbut also/gi,
            /it's not just\b[\s\S]{0,90}\bit'?s/gi,
            /(?:не лише|не тільки)[\s\S]{0,90}(?:а й|але й)/gi,
            /(?:по-перше|по-друге|по-третє)/gi,
            /(?:firstly|secondly|thirdly)/gi,
            /\d\.\s.*\d\.\s.*\d\.\s/g // Списки 1. 2. 3.
        ]
    },
    {
        label: "Шаблон академічної генерації",
        category: "pattern",
        weight: 1.3,
        patterns: [
            /(?:у\s+роботі\s+(?:розглянуто|проаналізовано|досліджено|визначено|узагальнено))/gi,
            /(?:метою\s+(?:роботи|дослідження)\s+є|завданнями\s+(?:роботи|дослідження)\s+є|робота\s+складається\s+з)/gi,
            /(?:актуальність\s+(?:обраної\s+)?теми\s+(?:полягає|зумовлена)|предметом\s+дослідження\s+є|об['’]єктом\s+дослідження\s+є)/gi,
            /(?:на\s+основі\s+проведеного\s+аналізу|отримані\s+результати\s+дозволяють|доцільно\s+зазначити)/gi
        ]
    },
    {
        label: "Prompt-leak та ШІ-відмови",
        category: "pattern",
        weight: 1.5,
        patterns: [
            /(?:як штучний інтелект|я не можу|моя база знань|до моменту мого останнього оновлення|as an ai|as an artificial intelligence|i cannot|i don'?t have access|my knowledge cutoff)/gi,
            /(?:важливо пам'ятати|важливо зазначити|однак варто пам'ятати|необхідно враховувати|слід зауважити|it is important to remember|it is crucial to note)/gi,
            /(?:в епоху цифрових технологій|у сучасному світі|стрімкий розвиток|безперечно|підсумовуючи|бути свідченням|беззаперечно|яскравий приклад)/gi
        ]
    }
];
function looksLikePlaceholderText(text) {
    const normalized = text.toLowerCase();
    return /lorem ipsum|consectetur adipiscing|suspendisse potenti/.test(normalized);
}
function hasAcademicStructure(text) {
    return /(?<![\p{L}\p{N}_])(зміст|вступ|розділ\s+(?:[0-9]+|[ivx]+)|висновки|список\s+використаних\s+джерел)(?![\p{L}\p{N}_])/iu.test(text);
}
function sentenceStartRepetition(sentences) {
    const starts = sentences
        .map((sentence) => tokenize(sentence, true).slice(0, 3).join(" "))
        .filter((start) => start.length > 4);
    const counts = new Map();
    for (const start of starts)
        counts.set(start, (counts.get(start) ?? 0) + 1);
    const repeated = [...counts.entries()].filter(([, count]) => count >= 2);
    const score = clampScore((repeated.reduce((sum, [, count]) => sum + count, 0) / Math.max(1, starts.length)) * 170);
    return { score, evidence: repeated.map(([start, count]) => `${start} (${count}x)`).slice(0, 4) };
}
function ngramRepetition(tokens) {
    const counts = new Map();
    for (let index = 0; index <= tokens.length - 4; index += 1) {
        const gram = tokens.slice(index, index + 4).join(" ");
        counts.set(gram, (counts.get(gram) ?? 0) + 1);
    }
    const repeated = [...counts.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]);
    const score = clampScore((repeated.reduce((sum, [, count]) => sum + count - 1, 0) / Math.max(1, tokens.length / 100)) * 60);
    return { score, evidence: repeated.map(([gram, count]) => `${gram} (${count}x)`).slice(0, 4) };
}
function impersonalAcademicVoice(text, wordCount) {
    const matches = countRegexMatches(text, /(?<![\p{L}\p{N}_])(?:розглянуто|проаналізовано|досліджено|визначено|встановлено|узагальнено|систематизовано|обґрунтовано|виявлено|сформовано|запропоновано|охарактеризовано)(?![\p{L}\p{N}_])/giu);
    const density = matches.length / Math.max(1, wordCount / 240);
    return {
        score: clampScore(Math.min(1, density / 2.4) * 100),
        evidence: sampleEvidence(matches)
    };
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
    const score = clampScore(citations.length * 12 + Math.min(20, numbers.length * 2.5) + Math.min(15, firstPerson.length * 3.5) + quotes.length * 10 + (wordCount < 180 ? 15 : 0) + (placeholderText ? 85 : 0) + (academicStructure ? 25 : 0));
    return { score, evidence };
}
function calculateTextEntropy(tokens) {
    if (tokens.length < 10)
        return 0;
    const bigrams = new Map();
    for (let i = 0; i < tokens.length - 1; i++) {
        const bigram = `${tokens[i]} ${tokens[i + 1]}`;
        bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
    }
    let entropy = 0;
    const total = tokens.length - 1;
    for (const count of bigrams.values()) {
        const p = count / total;
        entropy -= p * Math.log2(p);
    }
    // Max entropy for bigrams is Math.log2(total)
    return entropy / Math.log2(total);
}
function analyzeSinglePass(text) {
    const normalized = normalizeWhitespace(text);
    const lower = normalized.toLowerCase();
    const words = tokenize(normalized, true);
    const contentWords = tokenize(normalized);
    const sentences = splitSentences(normalized);
    const wordCount = words.length;
    if (wordCount < 10)
        return { probability: 0, signals: [] };
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
    const impersonalVoice = impersonalAcademicVoice(normalized, wordCount);
    const safeguards = safeguardScore(normalized, wordCount, placeholderText, academicStructure);
    const entropy = calculateTextEntropy(words); // 0.85-0.95+ for human text, often lower for AI
    // Метрики "Burstiness" - як варіюється довжина речень
    const rhythmScore = clampScore((1 - Math.min(1, sentenceCv / 0.55)) * 100 * (sentences.length >= 4 ? 1 : 0.6));
    const lexicalScore = clampScore(Math.max(0, 0.65 - uniqueRatio) * 150 + repeatedNgrams.score * 0.3 + Math.max(0, 0.85 - entropy) * 200);
    const transitionScore = clampScore(transitionDensity * 3500);
    const hedgeScore = clampScore(hedgeDensity * 3500);
    const punctuationTypes = new Set((normalized.replace(/--|—|–/g, "").match(/[;:!?()[\]]/g) ?? []).map((value) => value));
    const punctuationScore = clampScore(sentences.length >= 6 && punctuationTypes.size <= 1 ? 25 : 0);
    const corroboratedFloor = repeatedNgrams.score > 60 ? repeatedNgrams.score * 0.6 : 0;
    const patternBased = AI_PATTERN_GROUPS.map((group) => {
        const matches = group.patterns.flatMap((pattern) => countRegexMatches(normalized, pattern));
        const density = matches.length / Math.max(1, wordCount / 100);
        const score = clampScore(Math.min(1, density / 2.0) * 100);
        return {
            label: group.label,
            score,
            category: group.category,
            evidence: sampleEvidence(matches),
            detail: matches.length > 0
                ? `Знайдено ${matches.length} маркерів. Вони часто зустрічаються у згенерованих текстах.`
                : "Явних маркерів цієї групи не знайдено.",
            weight: group.weight
        };
    });
    const signalDrafts = [
        {
            label: "Рівномірність речень (Low Burstiness)",
            score: rhythmScore,
            category: "statistical",
            detail: rhythmScore >= 50
                ? `Текст має надто рівномірну структуру речень (CV: ${sentenceCv.toFixed(2)}). Людський текст зазвичай чергує довгі й короткі речення, ШІ пише "гладко".`
                : "Варіативність довжини речень виглядає природною.",
            evidence: sentences.length >= 2 ? sentenceLengths.slice(0, 8).map((length) => `${length} слів`) : [],
            weight: 1.0 // Increased weight for burstiness
        },
        {
            label: "Лексична одноманітність",
            score: lexicalScore,
            category: "statistical",
            detail: lexicalScore >= 50
                ? `Словниковий запас та зв'язки слів досить передбачувані (Ентропія: ${entropy.toFixed(2)}). ШІ рідко використовує незвичні комбінації слів.`
                : "Текст має високу лексичну різноманітність та непередбачуваність (Ентропія висока).",
            evidence: repeatedNgrams.evidence,
            weight: 0.9
        },
        {
            label: "Часті формальні переходи",
            score: transitionScore,
            category: "pattern",
            detail: transitionScore >= 40 ? "Висока концентрація слів-зв'язок (тому, однак, крім того), що часто використовуються мовними моделями для логічної 'склейки'." : "Перехідні слова у нормі.",
            evidence: sampleEvidence(words.filter((word) => TRANSITIONS.has(word))),
            weight: 0.85
        },
        {
            label: "Повтори на початку речень",
            score: repeatedStarts.score,
            category: "structure",
            detail: repeatedStarts.score >= 40 ? "Виявлено шаблони у початку речень. ШІ схильний починати кілька речень поспіль однаковими конструкціями." : "Початки речень різноманітні.",
            evidence: repeatedStarts.evidence,
            weight: 0.75
        },
        {
            label: "Безособовий стиль",
            score: impersonalVoice.score,
            category: "pattern",
            detail: impersonalVoice.score >= 45 ? "Стиль написання відсторонений та надто об'єктивізований. Хоча це типово для науки, надмірна кількість таких слів — маркер ШІ." : "Стиль подачі не виглядає шаблонно-академічним.",
            evidence: impersonalVoice.evidence,
            weight: 0.95
        },
        {
            label: "Одноманітна пунктуація",
            score: punctuationScore,
            category: "structure",
            detail: punctuationScore >= 25 ? "Пунктуація надто проста або рівна. Людські автори частіше використовують дужки, крапки з комою, тире або окличні знаки (подвійні дефіси не рахуються)." : "Пунктуаційний малюнок не виглядає шаблонним.",
            evidence: punctuationTypes.size ? [`${punctuationTypes.size} типів пунктуації`] : [],
            weight: 0.5
        },
        ...patternBased
    ];
    const evidenceSignals = signalDrafts.filter((signal) => signal.score >= 30);
    const weightedSum = signalDrafts.reduce((sum, s) => sum + s.score * s.weight, 0);
    const weightTotal = signalDrafts.reduce((sum, s) => sum + s.weight, 0);
    const weightedRaw = weightedSum / weightTotal;
    const corroboration = evidenceSignals.length <= 1 ? 0.7 : evidenceSignals.length === 2 ? 0.9 : 1.1;
    const lengthAdjust = wordCount < 60 ? 0.6 : wordCount < 120 ? 0.8 : wordCount < 200 ? 0.95 : 1.0;
    let rawProbability = (weightedRaw * corroboration * lengthAdjust) - (safeguards.score * 0.18);
    // Бонуси за кластери ознак
    if (evidenceSignals.filter(s => s.category === "pattern").length >= 2)
        rawProbability += 15;
    if (evidenceSignals.filter(s => s.category === "pattern").length >= 3)
        rawProbability += 25;
    if (academicStructure && impersonalVoice.score > 50)
        rawProbability += 10;
    const probability = clampScore(placeholderText ? Math.min(10, weightedRaw) : Math.max(rawProbability, corroboratedFloor));
    const signals = signalDrafts
        .map(({ weight: _weight, ...signal }) => signal)
        .filter((signal) => signal.score >= 5 || signal.evidence?.length)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
    signals.push({
        label: "Запобіжники від false positive",
        score: safeguards.score,
        category: "safeguard",
        detail: "Фактори, що свідчать про людське авторство.",
        evidence: safeguards.evidence
    });
    return { probability, signals };
}
function buildAnalysisWindows(text, targetWords = 240, overlapWords = 48) {
    const words = normalizeWhitespace(text).split(/\s+/).filter(Boolean);
    if (words.length <= targetWords + overlapWords)
        return [words.join(" ")];
    const windows = [];
    const step = Math.max(80, targetWords - overlapWords);
    for (let start = 0; start < words.length; start += step) {
        const window = words.slice(start, start + targetWords);
        if (window.length < 80 && windows.length > 0) {
            const previousStart = Math.max(0, words.length - targetWords);
            const tail = words.slice(previousStart).join(" ");
            if (tail !== windows.at(-1))
                windows.push(tail);
            break;
        }
        windows.push(window.join(" "));
        if (start + targetWords >= words.length)
            break;
    }
    return windows;
}
function percentile(values, ratio) {
    if (values.length === 0)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
    return sorted[index];
}
function estimateReliability(wordCount, windowScores, evidenceSignals) {
    const segmentCount = windowScores.length;
    const minimum = windowScores.length ? Math.min(...windowScores) : 0;
    const maximum = windowScores.length ? Math.max(...windowScores) : 0;
    const segmentSpread = maximum - minimum;
    const lengthScore = clampScore(Math.min(1, Math.max(0, wordCount - 60) / 740) * 100);
    const segmentScore = clampScore(Math.min(1, segmentCount / 6) * 100);
    const agreementScore = clampScore(100 - Math.min(100, segmentSpread * 1.45));
    const strongEvidence = evidenceSignals.filter((signal) => signal.category !== "safeguard" && signal.score >= 30).length;
    const evidenceScore = clampScore(Math.min(1, strongEvidence / 4) * 100);
    let score = clampScore(lengthScore * 0.42 + segmentScore * 0.2 + agreementScore * 0.23 + evidenceScore * 0.15);
    if (wordCount < 120)
        score = Math.min(score, 30);
    else if (wordCount < 240)
        score = Math.min(score, 48);
    const level = score >= 72 ? "high" : score >= 45 ? "medium" : "low";
    const reason = wordCount < 120
        ? "Текст надто короткий для стійкого стилометричного висновку."
        : segmentSpread >= 45
            ? "Сегменти сильно відрізняються між собою; документ може мати змішане походження або різні жанри."
            : segmentCount < 3
                ? "Для перевірки доступно мало незалежних сегментів."
                : level === "high"
                    ? "Обсяг достатній, а сегментні оцінки узгоджені."
                    : "Оцінка має помірну доказовість і потребує ручної перевірки сигналів.";
    return { level, score, segmentCount, segmentSpread, reason };
}
export function detectAiSignals(text) {
    const documentResult = analyzeSinglePass(text);
    const windows = buildAnalysisWindows(text);
    const windowResults = windows.map((window) => analyzeSinglePass(window));
    const windowScores = windowResults.map((result) => result.probability);
    const reliability = estimateReliability(tokenize(text, true).length, windowScores, documentResult.signals);
    if (windows.length <= 1)
        return { ...documentResult, reliability };
    const median = percentile(windowScores, 0.5);
    const upperQuartile = percentile(windowScores, 0.75);
    const strongest = Math.max(...windowScores);
    const suspiciousWindows = windowScores.filter((score) => score >= 45).length;
    const suspiciousCoverage = suspiciousWindows / windowScores.length;
    const ensembleScore = documentResult.probability * 0.42 +
        median * 0.18 +
        upperQuartile * 0.28 +
        suspiciousCoverage * 100 * 0.12;
    const localizedFloor = suspiciousCoverage >= 0.25
        ? upperQuartile * 0.82
        : strongest >= 68
            ? strongest * 0.52
            : 0;
    const probability = clampScore(Math.max(ensembleScore, localizedFloor));
    const segmentSignal = {
        label: "Сегментна узгодженість AI-ознак",
        score: clampScore(upperQuartile),
        category: "statistical",
        detail: suspiciousWindows > 0
            ? `Підозрілі ознаки зосереджені у ${suspiciousWindows} з ${windowScores.length} повністю перевірених сегментів. Підсумок враховує весь документ і не маскує локальні ділянки середнім значенням.`
            : `У ${windowScores.length} сегментах немає стійкого кластера AI-ознак; оцінка залишається низькою або невизначеною.`,
        evidence: [...windowScores]
            .map((score, index) => ({ score, index }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 4)
            .map(({ score, index }) => `сегмент ${index + 1}: ${score}%`)
    };
    return {
        probability,
        signals: [segmentSignal, ...documentResult.signals].slice(0, 21),
        reliability
    };
}
