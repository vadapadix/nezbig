import { normalizeWhitespace } from "./chunking.js";
import { detectAiLanguageCoverage } from "./aiLanguage.js";
import { prepareAiAnalysisText } from "./aiTextPreprocess.js";
import { performStylometryAnalysis } from "./aiStylometry.js";
import type { AiContentExclusions, AiLanguageCoverage, AiReliability, AiSignal, AiSuspiciousSegment, AiVerdict } from "../shared/types.js";
import { tokenize, splitSentences, clampScore, coefficientOfVariation, countRegexMatches, sampleEvidence } from "./utils/textUtils.js";

type SignalDraft = AiSignal & {
  weight: number;
};

export type AiDetectionResult = {
  probability: number;
  verdict: AiVerdict;
  signals: AiSignal[];
  reliability: AiReliability;
  language: AiLanguageCoverage;
  exclusions: AiContentExclusions;
  suspiciousSegments: AiSuspiciousSegment[];
};

export const AI_SCORING_WEIGHTS = {
  statistical: 0.38,
  pattern: 0.42,
  structure: 0.2
};

export const AI_ENSEMBLE_WEIGHTS = {
  document: 0.36,
  median: 0.14,
  upperQuartile: 0.2,
  topAverage: 0.22,
  suspiciousCoverage: 0.08,
  localizedFloorFactor: 0.56,
  localizedTopAverageFactor: 0.48
};

export const AI_WINDOW_CONFIG = {
  targetWords: 220,
  overlapWords: 55
};

export const AI_VERDICT_THRESHOLDS = {
  highProbability: 70,
  elevatedProbability: 45,
  mixedStrongest: 35,
  mixedMinimum: 28,
  mixedSpread: 28,
  uncertainFloorProbability: 12,
  insufficientWords: 80
};

const EN_TRANSITIONS = new Set(["therefore", "however", "moreover", "furthermore", "additionally", "consequently", "overall", "in conclusion", "further", "notably"]);

const UA_TRANSITIONS = new Set(["важливо", "отже", "проте", "однак", "таким", "загалом", "водночас", "натомість", "по-перше", "по-друге", "насамкінець", "зокрема"]);

const TRANSITIONS = new Set([...EN_TRANSITIONS, ...UA_TRANSITIONS]);

const EN_HEDGES = new Set(["may", "might", "could", "typically", "often", "arguably", "potentially"]);

const UA_HEDGES = new Set("може ймовірно зазвичай часто можливо потенційно як правило".split(" "));

const HEDGES = new Set([...EN_HEDGES, ...UA_HEDGES]);

const AI_PATTERN_GROUPS = [
  {
    label: "AI-лексика і канцелярит",
    category: "pattern" as const,
    weight: 0.75,
    patterns: [
      /(?:crucial|pivotal|vibrant|valuable|seamless|robust|innovative|transformative|groundbreaking|comprehensive|meticulous|unwavering|versatile|alignment|synergy|multifaceted|beacon of|tapestry of|testament to)/gi,
      /(?:delve|leverage|utilize|enhance|underscore|showcase|foster|facilitate|optimize|navigate the complexities|evolving landscape|rapidly changing|it is important to note|in essence)/gi,
      /(?:ключов(?:ий|а|е|і)|важлив(?:ий|а|е|і)|комплексн(?:ий|а|е|і)|ефективн(?:ий|а|е|і)|інноваційн(?:ий|а|е|і))[^.!?]{0,70}(?:підхід|рішення|роль|значення|розвиток|система|чинник|аспект)/gi,
      /(?:підкреслює|відіграє (?:ключову|вирішальну|важливу) роль|розкриває потенціал|важливо розуміти|варто відмітити|варто зауважити|вимагає уваги|нерозривно пов'язан|створює міцне підґрунтя)/gi,
      /(?:трансформаційний потенціал|гармонійне поєднання|широкий спектр|динамічний розвиток|невіддільна частина|покликаний забезпечити|відкриває нові горизонти)/gi
    ]
  },
  {
    label: "Шаблонні переходи та зв'язки",
    category: "pattern" as const,
    weight: 0.85,
    patterns: [
      /(?:moreover|furthermore|additionally|nevertheless|in conclusion|to summarize|it is important to note|it is worth noting|lastly|first and foremost|on the other hand|consequently|in light of this)/gi,
      /(?:варто зазначити|слід зазначити|важливо підкреслити|таким чином|у підсумку|на завершення|з огляду на це|по-перше|зокрема|з іншого боку|крім того|водночас|разом з тим|насамкінець)/gi
    ]
  },
  {
    label: "Роботична структура та синтаксис",
    category: "structure" as const,
    weight: 1.15,
    patterns: [
      /not only\b[\s\S]{0,90}\bbut also/gi,
      /it's not just\b[\s\S]{0,90}\bit'?s/gi,
      /(?:не лише|не тільки)[\s\S]{0,90}(?:а й|але й|а також)/gi,
      /(?:по-перше|по-друге|по-третє)/gi,
      /(?:firstly|secondly|thirdly)/gi,
      /\d\.\s.*\d\.\s.*\d\.\s/g // Списки 1. 2. 3.
    ]
  },
  {
    label: "Шаблон академічної генерації",
    category: "pattern" as const,
    weight: 0.55,
    patterns: [
      /(?:у\s+роботі\s+(?:розглянуто|проаналізовано|досліджено|визначено|узагальнено|висвітлено))/gi,
      /(?:метою\s+(?:роботи|дослідження)\s+є|завданнями\s+(?:роботи|дослідження)\s+є|робота\s+складається\s+з|структура\s+роботи\s+передбачає)/gi,
      /(?:актуальність\s+(?:обраної\s+)?теми\s+(?:полягає|зумовлена)|предметом\s+дослідження\s+є|об['’]єктом\s+дослідження\s+є)/gi,
      /(?:на\s+основі\s+проведеного\s+аналізу|отримані\s+результати\s+дозволяють|доцільно\s+зазначити|підсумовуючи\s+викладене)/gi
    ]
  },
  {
    label: "Prompt-leak та ШІ-відмови",
    category: "pattern" as const,
    weight: 1.5,
    patterns: [
      /(?:як штучний інтелект|я не можу|моя база знань|до моменту мого останнього оновлення|as an ai|as an artificial intelligence|i cannot|i don'?t have access|my knowledge cutoff)/gi,
      /(?:важливо пам'ятати|важливо зазначити|однак варто пам'ятати|необхідно враховувати|слід зауважити|it is important to remember|it is crucial to note)/gi,
      /(?:в епоху цифрових технологій|у сучасному світі|стрімкий розвиток|безперечно|підсумовуючи|бути свідченням|беззаперечно|яскравий приклад)/gi
    ]
  }
];

function looksLikePlaceholderText(text: string): boolean {
  const normalized = text.toLowerCase();
  return /lorem ipsum|consectetur adipiscing|suspendisse potenti/.test(normalized);
}

function hasAcademicStructure(text: string): boolean {
  return /(?<![\p{L}\p{N}_])(зміст|вступ|розділ\s+(?:[0-9]+|[ivx]+)|висновки|список\s+використаних\s+джерел)(?![\p{L}\p{N}_])/iu.test(text);
}

function isSectionHeading(sentence: string): boolean {
  const normalized = sentence
    .toLowerCase()
    .replace(/[.!?:;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (tokenize(normalized, true).length > 8) return false;
  return /^(?:зміст|вступ|висновки|список використаних джерел|розділ\s+(?:[0-9]+|[ivx]+)(?:\s+.+)?|introduction|conclusion|references|chapter\s+(?:[0-9]+|[ivx]+)(?:\s+.+)?)$/iu.test(
    normalized
  );
}

function sentenceStartRepetition(sentences: string[]): { score: number; evidence: string[] } {
  const starts = sentences.map((sentence) => tokenize(sentence, true).slice(0, 3).join(" ")).filter((start) => start.length > 4);
  const counts = new Map<string, number>();
  for (const start of starts) counts.set(start, (counts.get(start) ?? 0) + 1);
  const repeated = [...counts.entries()].filter(([, count]) => count >= 2);
  const score = clampScore((repeated.reduce((sum, [, count]) => sum + count, 0) / Math.max(1, starts.length)) * 170);
  return { score, evidence: repeated.map(([start, count]) => `${start} (${count}x)`).slice(0, 4) };
}

function ngramRepetition(tokens: string[]): { score: number; evidence: string[] } {
  const counts = new Map<string, number>();
  for (let index = 0; index <= tokens.length - 4; index += 1) {
    const gram = tokens.slice(index, index + 4).join(" ");
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  const repeated = [...counts.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]);
  const score = clampScore((repeated.reduce((sum, [, count]) => sum + count - 1, 0) / Math.max(1, tokens.length / 100)) * 60);
  return { score, evidence: repeated.map(([gram, count]) => `${gram} (${count}x)`).slice(0, 4) };
}

function languageWordShares(words: string[]): { cyrillicShare: number; latinShare: number } {
  let cyrillic = 0;
  let latin = 0;
  for (const word of words) {
    if (/[\p{Script=Cyrillic}]/u.test(word)) cyrillic += 1;
    else if (/[\p{Script=Latin}]/u.test(word)) latin += 1;
  }
  const total = Math.max(1, words.length);
  return { cyrillicShare: cyrillic / total, latinShare: latin / total };
}

function perLanguageDensity(counts: { cyrillic: number; latin: number }, words: string[], shares: { cyrillicShare: number; latinShare: number }): number {
  const cyrillicWords = Math.max(1, words.length * shares.cyrillicShare);
  const latinWords = Math.max(1, words.length * shares.latinShare);
  const cyrDensity = counts.cyrillic / cyrillicWords;
  const latDensity = counts.latin / latinWords;
  return Math.max(cyrDensity, latDensity);
}

function englishPassiveVoice(text: string, latinWordCount: number): { score: number; evidence: string[] } {
  const matches = countRegexMatches(text, /\b(?:is|are|was|were|be|been|being)\s+(?:\w+\s+)?\w+(?:ed|en)\b/gi);
  const density = matches.length / Math.max(1, latinWordCount / 240);
  return {
    score: clampScore(Math.min(1, density / 2.6) * 100),
    evidence: sampleEvidence(matches)
  };
}

function impersonalAcademicVoice(text: string, wordCount: number): { score: number; evidence: string[] } {
  const matches = countRegexMatches(
    text,
    /(?<![\p{L}\p{N}_])(?:розглянуто|проаналізовано|досліджено|визначено|встановлено|узагальнено|систематизовано|обґрунтовано|виявлено|сформовано|запропоновано|охарактеризовано)(?![\p{L}\p{N}_])/giu
  );
  const density = matches.length / Math.max(1, wordCount / 240);
  return {
    score: clampScore(Math.min(1, density / 2.4) * 100),
    evidence: sampleEvidence(matches)
  };
}

function safeguardScore(normalized: string, wordCount: number, placeholderText: boolean, academicStructure: boolean): { score: number; evidence: string[] } {
  const citations = countRegexMatches(
    normalized,
    /\[[0-9]{1,3}\]|\([A-ZА-ЯІЇЄҐ][\p{L}'-]+,\s*20[0-9]{2}\)|https?:\/\/\S+|doi:\s*\S+|дсту\s+[0-9]+|режим\s+доступу:|с\.\s*[0-9]+-[0-9]+|т\.\s*[0-9]+|№\s*[0-9]+/giu
  );
  const figuresAndTables = countRegexMatches(normalized, /(?:рис\.|рисунок|табл\.|таблиця|схема|формула)\s*(?:[0-9]+|\([0-9]+\))/giu);
  const numbers = countRegexMatches(normalized, /\b\d+(?:[.,]\d+)?\s*(?:%|грн|uah|usd|eur|км|м|см|мм|року|р\.|рік|years?|с|хв|год)\b/giu);
  const firstPerson = countRegexMatches(normalized, /(?<![\p{L}\p{N}_])(?:я|мені|мою|моє|ми|наш|наша|нашому|наших|i|my|we|our)(?![\p{L}\p{N}_])/giu);
  const quotes = countRegexMatches(normalized, /["“„«][^"”»]{12,}["”»]/gu);

  const evidence = [
    citations.length ? `${citations.length} посилань або бібліографічних маркерів` : "",
    figuresAndTables.length ? `${figuresAndTables.length} посилань на таблиці/рисунки` : "",
    numbers.length >= 3 ? `${numbers.length} числових/фактичних маркерів` : "",
    firstPerson.length >= 2 ? `${firstPerson.length} маркерів авторської позиції` : "",
    quotes.length ? `${quotes.length} довгих цитат` : "",
    wordCount < 180 ? "короткий текст: нижча надійність AI-оцінки" : "",
    placeholderText ? "lorem ipsum / шаблонний наповнювач" : "",
    academicStructure ? "академічна структура: вступ, розділи або висновки не вважаються AI-ознакою" : ""
  ].filter(Boolean);

  const score = clampScore(
    citations.length * 14 +
      figuresAndTables.length * 10 +
      Math.min(22, numbers.length * 2.5) +
      Math.min(18, firstPerson.length * 3.5) +
      quotes.length * 10 +
      (wordCount < 180 ? 15 : 0) +
      (placeholderText ? 85 : 0) +
      (academicStructure ? 25 : 0)
  );
  return { score, evidence };
}

function movingAverageTypeTokenRatio(tokens: string[], windowSize = 50): number {
  if (tokens.length === 0) return 0;
  if (tokens.length <= windowSize) return new Set(tokens).size / tokens.length;
  const step = Math.max(10, Math.floor(windowSize / 2));
  const ratios: number[] = [];
  for (let start = 0; start + windowSize <= tokens.length; start += step) {
    ratios.push(new Set(tokens.slice(start, start + windowSize)).size / windowSize);
  }
  const tail = tokens.slice(-windowSize);
  ratios.push(new Set(tail).size / tail.length);
  return ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
}

function strongestChannelScore(signals: SignalDraft[], category: NonNullable<AiSignal["category"]>): number {
  const scores = signals
    .filter((signal) => signal.category === category && signal.score > 0)
    .map((signal) => signal.score * Math.min(1.15, Math.max(0.45, signal.weight)))
    .sort((left, right) => right - left)
    .slice(0, 3);
  return clampScore((scores[0] ?? 0) * 0.55 + (scores[1] ?? 0) * 0.3 + (scores[2] ?? 0) * 0.15);
}

function analyzeSinglePass(text: string): { probability: number; signals: AiSignal[] } {
  const normalized = normalizeWhitespace(text);
  const words = tokenize(normalized, true);
  const contentWords = tokenize(normalized);
  const sentences = splitSentences(normalized);
  const proseSentences = sentences.filter((sentence) => !isSectionHeading(sentence));
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const wordCount = words.length;

  if (wordCount < 10) return { probability: 0, signals: [] };

  const mattr = movingAverageTypeTokenRatio(words);
  const sentenceLengths = proseSentences.map((sentence) => tokenize(sentence, true).length).filter(Boolean);
  const sentenceCv = coefficientOfVariation(sentenceLengths);

  const stylometry = performStylometryAnalysis(normalized, proseSentences, paragraphs);

  const shares = languageWordShares(words);
  const transitionCounts = { cyrillic: 0, latin: 0 };
  const hedgeCounts = { cyrillic: 0, latin: 0 };
  for (const word of words) {
    if (!TRANSITIONS.has(word) && !HEDGES.has(word)) continue;
    const isCyrillic = /[\p{Script=Cyrillic}]/u.test(word);
    if (TRANSITIONS.has(word)) {
      if (isCyrillic) transitionCounts.cyrillic += 1;
      else transitionCounts.latin += 1;
    }
    if (HEDGES.has(word)) {
      if (isCyrillic) hedgeCounts.cyrillic += 1;
      else hedgeCounts.latin += 1;
    }
  }
  const transitionDensity = perLanguageDensity(transitionCounts, words, shares);
  const hedgeDensity = perLanguageDensity(hedgeCounts, words, shares);

  const placeholderText = looksLikePlaceholderText(normalized);
  const academicStructure = hasAcademicStructure(normalized);
  const repeatedStarts = sentenceStartRepetition(proseSentences);
  const repeatedNgrams = ngramRepetition(contentWords);
  const uaImpersonal = impersonalAcademicVoice(normalized, wordCount);
  const enPassive = englishPassiveVoice(normalized, Math.max(1, Math.round(words.length * shares.latinShare)));
  const impersonalVoice = {
    score: Math.max(uaImpersonal.score, enPassive.score),
    evidence: [...uaImpersonal.evidence, ...enPassive.evidence].slice(0, 4)
  };
  const safeguards = safeguardScore(normalized, wordCount, placeholderText, academicStructure);

  const rhythmScore = clampScore((1 - Math.min(1, sentenceCv / 0.55)) * 100 * (proseSentences.length >= 4 ? 1 : 0.6));
  const lexicalScore = clampScore(Math.max(0, 0.82 - mattr) * 190 + repeatedNgrams.score * 0.45);
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
      detail: matches.length > 0 ? `Знайдено ${matches.length} маркерів. Вони часто зустрічаються у згенерованих текстах.` : "Явних маркерів цієї групи не знайдено.",
      weight: group.weight
    };
  });

  const signalDrafts: SignalDraft[] = [
    {
      label: "Рівномірність речень (Low Burstiness)",
      score: rhythmScore,
      category: "statistical",
      detail:
        rhythmScore >= 50
          ? `Текст має надто рівномірну структуру речень (CV: ${sentenceCv.toFixed(2)}). Людський текст зазвичай чергує довгі й короткі речення, ШІ пише "гладко".`
          : "Варіативність довжини речень виглядає природною.",
      evidence: sentences.length >= 2 ? sentenceLengths.slice(0, 8).map((length) => `${length} слів`) : [],
      weight: 1.0
    },
    {
      label: "Лексичний розподіл (Zipf & Hapax)",
      score: stylometry.zipfScore,
      category: "statistical",
      detail:
        stylometry.zipfScore >= 35
          ? `Текст має аномально низьку частку унікальних слів (${Math.round(stylometry.hapaxRatio * 100)}%), що характерно для генерацій ШІ із зацикленням на середньочастотній лексиці.`
          : `Лексичний розподіл відповідає природній кривій (Hapax: ${Math.round(stylometry.hapaxRatio * 100)}%).`,
      evidence: stylometry.zipfScore >= 30 ? [`частка Hapax Legomena ${Math.round(stylometry.hapaxRatio * 100)}%`] : [],
      weight: 0.85
    },
    {
      label: "Лексична одноманітність",
      score: lexicalScore,
      category: "statistical",
      detail:
        lexicalScore >= 50
          ? `Локальна різноманітність словника низька або є повторювані фрази (MATTR: ${Math.round(mattr * 100)}%).`
          : `Локальна різноманітність словника не виглядає підозрілою (MATTR: ${Math.round(mattr * 100)}%).`,
      evidence: [`локальна унікальність словника ${Math.round(mattr * 100)}%`, ...repeatedNgrams.evidence].slice(0, 5),
      weight: 0.8
    },
    {
      label: "Синтаксичний темпоритм",
      score: stylometry.rhythmDeltaScore,
      category: "structure",
      detail:
        stylometry.rhythmDeltaScore >= 35
          ? "Сусідні речення мають майже ідентичну довжину без динамічних пауз та контрастів, типових для людини."
          : "Темпоритм речень виглядає природно.",
      evidence: stylometry.rhythmDeltaScore >= 30 ? ["низька різниця між сусідніми реченнями"] : [],
      weight: 0.8
    },
    {
      label: "Часті формальні переходи",
      score: transitionScore,
      category: "pattern",
      detail:
        transitionScore >= 40
          ? "Висока концентрація слів-зв'язок (тому, однак, крім того), що часто використовуються мовними моделями для логічної 'склейки'."
          : "Перехідні слова у нормі.",
      evidence: sampleEvidence(words.filter((word) => TRANSITIONS.has(word))),
      weight: 0.85
    },
    {
      label: "Обережні формулювання",
      score: hedgeScore,
      category: "pattern",
      detail:
        hedgeScore >= 40 ? "У тексті часто повторюються модальні або обережні слова; ця ознака враховується лише разом з іншими сигналами." : "Обережні формулювання не домінують.",
      evidence: sampleEvidence(words.filter((word) => HEDGES.has(word))),
      weight: 0.45
    },
    {
      label: "Повтори на початку речень",
      score: repeatedStarts.score,
      category: "structure",
      detail:
        repeatedStarts.score >= 40 ? "Виявлено шаблони у початку речень. ШІ схильний починати кілька речень поспіль однаковими конструкціями." : "Початки речень різноманітні.",
      evidence: repeatedStarts.evidence,
      weight: 0.75
    },
    {
      label: "Безособовий стиль",
      score: impersonalVoice.score,
      category: "pattern",
      detail:
        impersonalVoice.score >= 45
          ? "Стиль написання відсторонений та надто об'єктивізований. Хоча це типово для науки, надмірна кількість таких слів — маркер ШІ."
          : "Стиль подачі не виглядає шаблонно-академічним.",
      evidence: impersonalVoice.evidence,
      weight: 0.95
    },
    {
      label: "Одноманітна пунктуація",
      score: Math.max(punctuationScore, stylometry.punctuationEntropyScore),
      category: "structure",
      detail:
        punctuationScore >= 25 || stylometry.punctuationEntropyScore >= 30
          ? "Пунктуація надто проста або рівна. Людські автори частіше використовують дужки, крапки з комою, тире або окличні знаки (подвійні дефіси не рахуються)."
          : "Пунктуаційний малюнок не виглядає шаблонним (подвійні дефіси не рахуються).",
      evidence: punctuationTypes.size ? [`${punctuationTypes.size} типів пунктуації`] : [],
      weight: 0.5
    },
    {
      label: "Рівномірність абзаців",
      score: stylometry.paragraphUniformityScore,
      category: "structure",
      detail:
        stylometry.paragraphUniformityScore >= 35
          ? "Абзаци мають штучно однакову кількість слів, що є характерною ознакою генерацій мовних моделей."
          : "Довжина абзаців варіюється природно.",
      evidence: stylometry.paragraphUniformityScore >= 30 ? stylometry.evidence.filter((e) => e.includes("абзаців")) : [],
      weight: 0.65
    },
    ...patternBased
  ];

  const evidenceSignals = signalDrafts.filter((signal) => signal.score >= 30);
  const weakEvidenceSignals = signalDrafts.filter((signal) => signal.score >= 12);
  const statisticalChannel = strongestChannelScore(signalDrafts, "statistical");
  const patternChannel = strongestChannelScore(signalDrafts, "pattern");
  const structureChannel = strongestChannelScore(signalDrafts, "structure");
  const activeChannels = [statisticalChannel, patternChannel, structureChannel].filter((score) => score >= 14).length;
  const weightedRaw = statisticalChannel * AI_SCORING_WEIGHTS.statistical + patternChannel * AI_SCORING_WEIGHTS.pattern + structureChannel * AI_SCORING_WEIGHTS.structure;
  const corroboration = activeChannels >= 3 ? 1.1 : activeChannels === 2 ? 1 : 0.78;
  const lengthAdjust = wordCount < 60 ? 0.6 : wordCount < 120 ? 0.8 : wordCount < 200 ? 0.95 : 1.0;
  let rawProbability = weightedRaw * corroboration * lengthAdjust;
  rawProbability += Math.max(0, evidenceSignals.length - 1) * 4;
  rawProbability += Math.max(0, weakEvidenceSignals.length - 3) * 1.5;

  const promptLeak = signalDrafts.find((signal) => signal.label === "Prompt-leak та ШІ-відмови")?.score ?? 0;
  const strongAverage = evidenceSignals
    .map((signal) => signal.score)
    .sort((left, right) => right - left)
    .slice(0, 3)
    .reduce((sum, score, _index, scores) => sum + score / Math.max(1, scores.length), 0);
  const evidenceFloor =
    promptLeak >= 40 ? 45 : evidenceSignals.length >= 3 ? Math.max(22, strongAverage * 0.5) : weakEvidenceSignals.length >= 5 ? 8 : weakEvidenceSignals.length >= 2 ? 3 : 0;
  const probability = clampScore(placeholderText ? Math.min(10, weightedRaw) : Math.max(rawProbability, corroboratedFloor, evidenceFloor));

  const signals: AiSignal[] = signalDrafts
    .map(({ weight: _weight, ...signal }) => signal)
    .filter((signal) => signal.score >= 5 || signal.evidence?.length)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  signals.push({
    label: "Запобіжники від false positive",
    score: safeguards.score,
    category: "safeguard",
    detail: "Контекстні фактори, що знижують надійність автоматичного висновку, але не доводять людське авторство.",
    evidence: safeguards.evidence
  });

  return { probability, signals };
}

type AnalysisWindow = {
  index: number;
  startWord: number;
  endWord: number;
  text: string;
};

function buildAnalysisWindows(text: string, targetWords = AI_WINDOW_CONFIG.targetWords, overlapWords = AI_WINDOW_CONFIG.overlapWords): AnalysisWindow[] {
  const words = normalizeWhitespace(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length <= targetWords) {
    return [{ index: 0, startWord: 1, endWord: words.length, text: words.join(" ") }];
  }

  const step = Math.max(80, targetWords - overlapWords);
  const starts: number[] = [];
  for (let start = 0; start + targetWords < words.length; start += step) starts.push(start);
  const tailStart = Math.max(0, words.length - targetWords);
  if (!starts.includes(tailStart)) starts.push(tailStart);

  return starts
    .sort((left, right) => left - right)
    .map((startWord, index) => ({
      index,
      startWord: startWord + 1,
      endWord: Math.min(words.length, startWord + targetWords),
      text: words.slice(startWord, startWord + targetWords).join(" ")
    }));
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function estimateReliability(wordCount: number, windowScores: number[], evidenceSignals: AiSignal[], language: AiLanguageCoverage, exclusions: AiContentExclusions): AiReliability {
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
  if (wordCount < 80) score = Math.min(score, 18);
  else if (wordCount < 120) score = Math.min(score, 30);
  else if (wordCount < 240) score = Math.min(score, 48);
  if (language.code === "limited") score = Math.min(score, 28);
  else if (language.code === "mixed") score = Math.min(score, 58);

  const level: AiReliability["level"] = score >= 72 ? "high" : score >= 45 ? "medium" : "low";
  const excludedWords = exclusions.codeWords + exclusions.quotedWords + exclusions.referenceWords;
  let reason =
    wordCount < 80
      ? "Після вилучення коду, цитат і службових частин лишилося замало авторського тексту для стилометричного висновку."
      : language.code === "limited"
        ? language.reason
        : wordCount < 120
          ? "Текст надто короткий для стійкого стилометричного висновку."
          : segmentSpread >= 45
            ? "Сегменти сильно відрізняються між собою; документ може мати змішане походження або різні жанри."
            : segmentCount < 3
              ? "Для перевірки доступно мало незалежних сегментів."
              : level === "high"
                ? "Обсяг достатній, а сегментні оцінки узгоджені."
                : "Оцінка має помірну доказовість і потребує ручної перевірки сигналів.";
  if (excludedWords > 0 && wordCount >= 80) {
    reason += ` Неавторський або технічний вміст вилучено: ${excludedWords} слів.`;
  }

  return { level, score, segmentCount, segmentSpread, reason };
}

function suspiciousSegments(windows: AnalysisWindow[], results: Array<{ probability: number; signals: AiSignal[] }>): AiSuspiciousSegment[] {
  return results
    .map((result, index): AiSuspiciousSegment => {
      const window = windows[index];
      const evidence = result.signals
        .filter((signal) => signal.category !== "safeguard" && signal.score >= 12)
        .slice(0, 4)
        .map((signal) => `${signal.label}: ${signal.score}%`);
      const excerpt = window.text.length > 280 ? `${window.text.slice(0, 277).trimEnd()}…` : window.text;
      return { index: window.index, startWord: window.startWord, endWord: window.endWord, score: result.probability, excerpt, evidence };
    })
    .filter((segment) => segment.score >= 18 && segment.evidence.length > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

function determineVerdict(
  wordCount: number,
  probability: number,
  reliability: AiReliability,
  language: AiLanguageCoverage,
  windowScores: number[],
  segments: AiSuspiciousSegment[]
): AiVerdict {
  const thresholds = AI_VERDICT_THRESHOLDS;
  if (wordCount < thresholds.insufficientWords) return "insufficient";
  if (language.code === "limited") return "uncertain";
  const minimum = windowScores.length ? Math.min(...windowScores) : probability;
  const strongest = windowScores.length ? Math.max(...windowScores) : probability;
  // Mixed verdict requires at least 2 windows to avoid false positives on short texts
  if (windowScores.length >= 2 && strongest >= thresholds.mixedStrongest && minimum <= thresholds.mixedMinimum && strongest - minimum >= thresholds.mixedSpread) return "mixed";
  if (probability >= thresholds.highProbability) return "high";
  if (probability >= thresholds.elevatedProbability) return "elevated";
  // Clean human texts with very low probability (<12%) and no strong suspicious segments
  if (probability < thresholds.uncertainFloorProbability && strongest < 20 && segments.length === 0) return "low";
  if (reliability.level === "low" || probability >= thresholds.uncertainFloorProbability || segments.length > 0) return "uncertain";
  return "low";
}

export function detectAiSignals(rawText: string): AiDetectionResult {
  const prepared = prepareAiAnalysisText(rawText);
  const text = prepared.text;
  const language = detectAiLanguageCoverage(text);
  const documentResult = analyzeSinglePass(text);
  const windows = buildAnalysisWindows(text);
  const windowResults = windows.map((window) => analyzeSinglePass(window.text));
  const windowScores = windowResults.map((result) => result.probability);
  const wordCount = tokenize(text, true).length;
  const reliability = estimateReliability(wordCount, windowScores, documentResult.signals, language, prepared.exclusions);
  const segments = suspiciousSegments(windows, windowResults);

  const exclusionSignal: AiSignal | null =
    prepared.exclusions.codeWords + prepared.exclusions.quotedWords + prepared.exclusions.referenceWords > 0
      ? {
          label: "Вилучений неавторський вміст",
          score: 0,
          category: "safeguard",
          detail: "Код, довгі цитати та бібліографічний хвіст не беруть участі в оцінці авторського стилю.",
          evidence: [
            prepared.exclusions.codeWords ? `${prepared.exclusions.codeWords} слів коду` : "",
            prepared.exclusions.quotedWords ? `${prepared.exclusions.quotedWords} слів у довгих цитатах` : "",
            prepared.exclusions.referenceWords ? `${prepared.exclusions.referenceWords} слів у списку джерел` : ""
          ].filter(Boolean)
        }
      : null;

  if (windows.length <= 1) {
    const signals = exclusionSignal ? [...documentResult.signals, exclusionSignal] : documentResult.signals;
    const verdict = determineVerdict(wordCount, documentResult.probability, reliability, language, windowScores, segments);
    return { ...documentResult, verdict, signals, reliability, language, exclusions: prepared.exclusions, suspiciousSegments: segments };
  }

  const median = percentile(windowScores, 0.5);
  const upperQuartile = percentile(windowScores, 0.75);
  const strongest = Math.max(...windowScores);
  const suspiciousThreshold = AI_VERDICT_THRESHOLDS.mixedStrongest;
  const suspiciousWindows = windowScores.filter((score) => score >= suspiciousThreshold).length;
  const suspiciousCoverage = suspiciousWindows / windowScores.length;
  const topScores = [...windowScores].sort((left, right) => right - left).slice(0, Math.min(3, windowScores.length));
  const topAverage = topScores.reduce((sum, score) => sum + score, 0) / Math.max(1, topScores.length);

  const ensembleScore =
    documentResult.probability * AI_ENSEMBLE_WEIGHTS.document +
    median * AI_ENSEMBLE_WEIGHTS.median +
    upperQuartile * AI_ENSEMBLE_WEIGHTS.upperQuartile +
    topAverage * AI_ENSEMBLE_WEIGHTS.topAverage +
    suspiciousCoverage * 100 * AI_ENSEMBLE_WEIGHTS.suspiciousCoverage;
  const localizedFloor = strongest >= AI_VERDICT_THRESHOLDS.mixedStrongest ? strongest * AI_ENSEMBLE_WEIGHTS.localizedFloorFactor : topAverage >= 24 ? topAverage * AI_ENSEMBLE_WEIGHTS.localizedTopAverageFactor : 0;
  const probability = clampScore(Math.max(ensembleScore, localizedFloor));

  const segmentSignal: AiSignal = {
    label: "Сегментна узгодженість AI-ознак",
    score: clampScore(upperQuartile),
    category: "statistical",
    detail:
      suspiciousWindows > 0
        ? `Підозрілі ознаки зосереджені у ${suspiciousWindows} з ${windowScores.length} повністю перевірених сегментів. Для ручної перевірки нижче наведено координати найсильніших ділянок.`
        : `У ${windowScores.length} сегментах немає стійкого кластера AI-ознак; оцінка залишається низькою або невизначеною.`,
    evidence: [...windowScores]
      .map((score, index) => ({ score, index }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ score, index }) => `сегмент ${index + 1}: ${score}%`)
  };

  const signals = [segmentSignal, ...documentResult.signals, ...(exclusionSignal ? [exclusionSignal] : [])].slice(0, 22);
  const verdict = determineVerdict(wordCount, probability, reliability, language, windowScores, segments);
  return { probability, verdict, signals, reliability, language, exclusions: prepared.exclusions, suspiciousSegments: segments };
}
