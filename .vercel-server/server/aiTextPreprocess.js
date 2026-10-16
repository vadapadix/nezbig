import { countWords, normalizeWhitespace } from "./chunking.js";
import { filterProseText } from "./proseFilter.js";
import { BIBLIOGRAPHY_PATTERNS } from "./documentPreprocess.js";
// Citation metadata is neutral: adding a link must not change the style score.
export function stripInlineCitationMetadata(text) {
    return text
        .replace(/https?:\/\/[^\s<>"«»]+/giu, " ")
        .replace(/\bdoi:\s*\S+/giu, " ")
        .replace(/\[\s*\d{1,3}(?:\s*[-–,;]\s*\d{1,3})*\s*\]/gu, " ")
        .replace(/\([\p{L}'’-]+(?:\s+et\s+al\.?)?,\s*(?:19|20)\d{2}[a-z]?(?:,\s*p{1,2}\.\s*\d+(?:[-–]\d+)?)?\)/giu, " ");
}
function stripReferenceTail(text) {
    // A standalone reference list has no prose to assess. Require structured
    // entries on separate lines; a few URLs inside prose are never sufficient.
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length >= 2 && lines.every(line => /^\d{1,3}[.)]\s+[\p{L}]/u.test(line) &&
        /\b(?:19|20)\d{2}\b/u.test(line) &&
        /\bdoi\b|\bisbn\b|\bpp?\.\s*\d|с\.\s*\d/iu.test(line)))
        return { text: "", removedWords: countWords(text) };
    const minPos = Math.floor(text.length * 0.35);
    for (const pattern of BIBLIOGRAPHY_PATTERNS) {
        const slice = text.slice(minPos);
        const match = pattern.exec(slice);
        if (match && match.index !== undefined) {
            const splitIdx = minPos + match.index;
            const tail = text.slice(splitIdx);
            const tailWords = countWords(tail);
            const bodyWords = countWords(text.slice(0, splitIdx));
            if (tailWords >= 8 && bodyWords >= 20) {
                return {
                    text: text.slice(0, splitIdx),
                    removedWords: tailWords
                };
            }
        }
    }
    return { text, removedWords: 0 };
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
    const text = normalizeWhitespace(stripInlineCitationMetadata(prose.text));
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
