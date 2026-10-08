import { countWords, normalizeWhitespace } from "./chunking.js";
import { filterProseText } from "./proseFilter.js";
import { BIBLIOGRAPHY_PATTERNS } from "./documentPreprocess.js";
import type { AiContentExclusions } from "../shared/types.js";

type PreparedAiText = {
  text: string;
  exclusions: AiContentExclusions;
};

function stripReferenceTail(text: string): { text: string; removedWords: number } {
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
