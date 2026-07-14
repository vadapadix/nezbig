import { countWords, normalizeWhitespace } from "./chunking.js";
import { filterProseText } from "./proseFilter.js";
function stripReferenceTail(text) {
    const marker = /(?<![\p{L}\p{N}_])(?:список\s+(?:використаних\s+)?джерел|бібліографія|references|bibliography)(?![\p{L}\p{N}_])\s*[.:</—-]*/iu;
    const match = marker.exec(text);
    if (!match || match.index < text.length * 0.45)
        return { text, removedWords: 0 };
    return {
        text: text.slice(0, match.index),
        removedWords: countWords(text.slice(match.index))
    };
}
function stripLongQuotations(text) {
    let removedWords = 0;
    const cleaned = text.replace(/["“„«][^"”»]{40,}["”»]/gu, (quotation) => {
        removedWords += countWords(quotation);
        return " ";
    });
    return { text: cleaned, removedWords };
}
export function prepareAiAnalysisText(rawText) {
    const withoutReferences = stripReferenceTail(rawText);
    const withoutQuotes = stripLongQuotations(withoutReferences.text);
    const prose = filterProseText(withoutQuotes.text);
    const text = normalizeWhitespace(prose.text);
    return {
        text,
        exclusions: {
            analyzedWords: countWords(text),
            codeWords: prose.removedCodeWords,
            quotedWords: withoutQuotes.removedWords,
            referenceWords: withoutReferences.removedWords
        }
    };
}
