import type { PreparedAiText } from "../../types/aiTextPreprocess.types.js";
export type { PreparedAiText } from "../../types/aiTextPreprocess.types.js";
import { countWords } from "./chunking.js";
import { filterProseText, normalizeProseLayout } from "./proseFilter.js";
import { findBibliographyStart } from "./documentPreprocess.js";

import { removeStructuralAiContent } from "./aiStructuralContent.js";

// Citation metadata is neutral: adding a link must not change the style score.
export function stripInlineCitationMetadata(text: string): string {
  return text
    .replace(/https?:\/\/[^\s<>"«»]+/giu, " ")
    .replace(/\bdoi:\s*\S+/giu, " ")
    .replace(/\[\s*\d{1,3}(?:\s*[-–,;]\s*\d{1,3})*\s*\]/gu, " ")
    .replace(/\([\p{L}'’-]+(?:\s+et\s+al\.?)?,\s*(?:19|20)\d{2}[a-z]?(?:,\s*p{1,2}\.\s*\d+(?:[-–]\d+)?)?\)/giu, " ");
}

function stripReferenceTail(text: string): { text: string; removedWords: number } {
  // A standalone reference list has no prose to assess. Require structured
  // entries on separate lines; a few URLs inside prose are never sufficient.
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const entries = /^(?:список\s+(?:використаних\s+)?джерел|бібліографія|references|bibliography)\s*[:.]?$/iu.test(lines[0] ?? "") ? lines.slice(1) : lines;
  if (
    entries.length >= 2 &&
    entries.every((line) => /^\d{1,3}[.)]\s+[\p{L}]/u.test(line) && /\b(?:19|20)\d{2}\b/u.test(line) && /\bdoi\b|\bisbn\b|\bpp?\.\s*\d|с\.\s*\d/iu.test(line))
  )
    return { text: "", removedWords: countWords(text) };
  const splitIdx = findBibliographyStart(text);
  if (splitIdx >= 0) {
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
  return { text, removedWords: 0 };
}

function stripLongQuotations(text: string): { text: string; removedWords: number } {
  let removedWords = 0;
  const cleaned = text.replace(/["“„«][^"”»]{40,}["”»]/gu, (quotation) => {
    removedWords += countWords(quotation);
    return " ";
  });
  return { text: cleaned, removedWords };
}

export function prepareAiAnalysisText(rawText: string): PreparedAiText {
  const withoutReferences = stripReferenceTail(rawText);
  const withoutQuotes = stripLongQuotations(withoutReferences.text);
  const structural = removeStructuralAiContent(withoutQuotes.text);
  const prose = filterProseText(structural.text);
  const text = normalizeProseLayout(stripInlineCitationMetadata(prose.text));

  return {
    text,
    exclusions: {
      analyzedWords: countWords(text),
      codeWords: prose.removedCodeWords,
      quotedWords: withoutQuotes.removedWords,
      referenceWords: withoutReferences.removedWords,
      structuralWords: structural.removedWords
    }
  };
}
