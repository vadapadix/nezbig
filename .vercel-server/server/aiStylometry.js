import { clampScore, tokenize, coefficientOfVariation } from "./utils/textUtils.js";
/**
 * Calculates Shannon Entropy of a frequency map
 */
function shannonEntropy(counts, total) {
    if (total <= 0)
        return 0;
    let entropy = 0;
    for (const count of counts.values()) {
        if (count <= 0)
            continue;
        const p = count / total;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}
/**
 * Evaluates deviation from Zipf's Law and the ratio of Hapax Legomena (words occurring exactly once).
 * Natural human language exhibits a steep Zipf power curve with a rich tail of unique words (hapax legomena > 45%).
 * AI generated text under-samples tail vocabulary and over-samples middle-frequency generic words.
 */
export function analyzeZipfAndVocabulary(tokens) {
    if (tokens.length < 30) {
        return { score: 0, hapaxRatio: 0.5, evidence: [] };
    }
    const frequency = new Map();
    for (const token of tokens) {
        frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
    const totalTypes = frequency.size;
    if (totalTypes === 0)
        return { score: 0, hapaxRatio: 0.5, evidence: [] };
    let hapaxCount = 0;
    for (const count of frequency.values()) {
        if (count === 1)
            hapaxCount += 1;
    }
    const hapaxRatio = hapaxCount / totalTypes;
    // Expected natural Hapax Legomena ratio for human texts of length >= 60 is typically 0.50 - 0.75.
    // AI texts frequently drop to 0.25 - 0.40 due to repetitive lemma selection.
    let zipfAnomaly = 0;
    if (hapaxRatio < 0.42 && tokens.length >= 60) {
        zipfAnomaly = clampScore((0.42 - hapaxRatio) * 260);
    }
    const evidence = [];
    if (zipfAnomaly >= 35) {
        evidence.push(`Низька частка унікальних слів (Hapax: ${Math.round(hapaxRatio * 100)}%)`);
    }
    return { score: zipfAnomaly, hapaxRatio, evidence };
}
/**
 * Calculates Shannon entropy over punctuation mark distributions.
 * AI models predominantly use standard periods and commas with low diversity of dashes, colons, semicolons, or parentheses.
 */
export function analyzePunctuationEntropy(text, sentenceCount) {
    if (sentenceCount < 4) {
        return { score: 0, entropy: 2.0, evidence: [] };
    }
    const cleanText = text.replace(/--/g, "—");
    const punctuationMatches = cleanText.match(/[,;:\-—–()[\]!?"'«»]/gu) ?? [];
    if (punctuationMatches.length < 5) {
        return { score: 0, entropy: 1.0, evidence: [] };
    }
    const counts = new Map();
    for (const p of punctuationMatches) {
        // Group dashes and quotes together for fair entropy
        const normalized = /[—–\-]/.test(p) ? "—" : /["'«»]/.test(p) ? '"' : p;
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
    // If the text contains dashes, colons, semicolons, brackets, or questions/exclamations, it has expressive human diversity
    const hasExpressivePunctuation = counts.has("—") || counts.has(";") || counts.has(":") || counts.has("(") || counts.has("!") || counts.has("?");
    if (hasExpressivePunctuation) {
        return { score: 0, entropy: 2.0, evidence: [] };
    }
    const entropy = shannonEntropy(counts, punctuationMatches.length);
    // If text ONLY has commas and periods (low diversity)
    let punctuationScore = 0;
    if (entropy < 1.15 && sentenceCount >= 5 && punctuationMatches.length >= 10) {
        punctuationScore = clampScore((1.15 - entropy) * 90);
    }
    const evidence = [];
    if (punctuationScore >= 30) {
        evidence.push(`Однотипна пунктуація (ентропія: ${entropy.toFixed(2)})`);
    }
    return { score: punctuationScore, entropy, evidence };
}
/**
 * Evaluates paragraph length uniformity.
 * AI text frequently produces paragraphs of nearly identical word count (e.g. 50-60 words per paragraph),
 * whereas human writing has high variance across paragraphs.
 */
export function analyzeParagraphUniformity(paragraphs) {
    const substantive = paragraphs.filter((p) => tokenize(p, true).length >= 15);
    if (substantive.length < 3) {
        return { score: 0, evidence: [] };
    }
    const lengths = substantive.map((p) => tokenize(p, true).length);
    const cv = coefficientOfVariation(lengths);
    // If CV of paragraph lengths is very low (< 0.22), paragraphs are suspiciously uniform
    let uniformityScore = 0;
    if (cv < 0.24 && substantive.length >= 3) {
        uniformityScore = clampScore((0.24 - cv) * 280);
    }
    const evidence = [];
    if (uniformityScore >= 35) {
        evidence.push(`Штучна рівномірність абзаців (CV: ${cv.toFixed(2)})`);
    }
    return { score: uniformityScore, evidence };
}
/**
 * Calculates consecutive sentence length differences (Rhythm Delta / Burstiness).
 * Humans naturally fluctuate between punchy short sentences and long complex clauses.
 * AI produces very small deltas between consecutive sentences.
 */
export function analyzeSentencePacing(sentenceLengths) {
    if (sentenceLengths.length < 4) {
        return { score: 0, meanDelta: 10, evidence: [] };
    }
    let totalDelta = 0;
    for (let i = 1; i < sentenceLengths.length; i += 1) {
        totalDelta += Math.abs(sentenceLengths[i] - sentenceLengths[i - 1]);
    }
    const meanDelta = totalDelta / (sentenceLengths.length - 1);
    const avgLength = sentenceLengths.reduce((sum, l) => sum + l, 0) / sentenceLengths.length;
    // Normalized pacing delta relative to average sentence length
    const normalizedDelta = avgLength > 0 ? meanDelta / avgLength : 1;
    // If normalized delta < 0.28, sentences are paced with robotic monotony
    let pacingScore = 0;
    if (normalizedDelta < 0.32 && sentenceLengths.length >= 5) {
        pacingScore = clampScore((0.32 - normalizedDelta) * 240);
    }
    const evidence = [];
    if (pacingScore >= 35) {
        evidence.push(`Монотонний темпоритм (середня різниця: ${meanDelta.toFixed(1)} слів)`);
    }
    return { score: pacingScore, meanDelta, evidence };
}
/**
 * Analyzes Triadic Enumerations and Rule-of-Three Bias.
 * State-of-the-art research (2024-2026) demonstrates that LLMs exhibit a pronounced bias toward grouping arguments,
 * adjectives, and items in sets of three ("X, Y, and Z" / "X, Y та Z").
 */
export function analyzeTriadicStructures(text, wordCount) {
    if (wordCount < 45)
        return { score: 0, evidence: [] };
    const matches = text.match(/[\p{L}\p{N}'-]+,\s+[\p{L}\p{N}'-]+,?\s+(?:та|і|й|або|and|or)\s+[\p{L}\p{N}'-]+/giu) ?? [];
    const density = matches.length / Math.max(1, wordCount / 100);
    let score = 0;
    if (density >= 0.9 && matches.length >= 2) {
        score = clampScore(Math.min(1, (density - 0.4) / 1.4) * 100);
    }
    const evidence = [];
    if (score >= 35) {
        evidence.push(`Тріадичні переліки (Rule of Three): ${matches.length} груп`);
    }
    return { score, evidence };
}
/**
 * Analyzes Dialectical Balancing and Antithetical Hedging.
 * Recent LLM studies identify reflexive structural hedging where statements are consistently balanced with opposing clauses
 * ("з одного боку ... з іншого боку", "попри ... водночас", "while ... nonetheless").
 */
export function analyzeAntitheticalBalance(text, wordCount) {
    if (wordCount < 50)
        return { score: 0, evidence: [] };
    const matches = text.match(/(?:з одного боку[\s\S]{10,140}з іншого боку|on the one hand[\s\S]{10,140}on the other hand|попри[\s\S]{5,80}(?:водночас|проте|однак|разом з тим)|хоча[\s\S]{5,80}(?:проте|однак|але й)|незважаючи на[\s\S]{5,80}(?:важливо|залишається|потрібно)|while[\s\S]{5,80}(?:it is crucial|it remains|nonetheless|however))/giu) ?? [];
    const density = matches.length / Math.max(1, wordCount / 100);
    let score = 0;
    if (matches.length >= 2 || (matches.length >= 1 && density >= 0.8)) {
        score = clampScore(Math.min(1, density / 1.1) * 100);
    }
    const evidence = [];
    if (score >= 35) {
        evidence.push(`Діалектичне балансування (${matches.length} антитетичних конструкцій)`);
    }
    return { score, evidence };
}
/**
 * Comprehensive Stylometric Analysis
 */
export function performStylometryAnalysis(text, proseSentences, paragraphs) {
    const words = tokenize(text, true);
    const sentenceLengths = proseSentences.map((s) => tokenize(s, true).length).filter(Boolean);
    const zipf = analyzeZipfAndVocabulary(words);
    const punctuation = analyzePunctuationEntropy(text, proseSentences.length);
    const paragraph = analyzeParagraphUniformity(paragraphs);
    const pacing = analyzeSentencePacing(sentenceLengths);
    const triadic = analyzeTriadicStructures(text, words.length);
    const antithesis = analyzeAntitheticalBalance(text, words.length);
    const allEvidence = [
        ...zipf.evidence,
        ...punctuation.evidence,
        ...paragraph.evidence,
        ...pacing.evidence,
        ...triadic.evidence,
        ...antithesis.evidence
    ];
    return {
        zipfScore: zipf.score,
        hapaxRatio: zipf.hapaxRatio,
        punctuationEntropyScore: punctuation.score,
        paragraphUniformityScore: paragraph.score,
        rhythmDeltaScore: pacing.score,
        triadicScore: triadic.score,
        antithesisScore: antithesis.score,
        evidence: allEvidence
    };
}
