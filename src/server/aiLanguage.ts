import type { AiLanguageCoverage } from "../shared/types.js";

const UKRAINIAN_STOP_WORDS = new Set([
  "і", "й", "та", "у", "в", "на", "до", "з", "із", "що", "це", "для", "як", "не", "є", "від", "або", "які", "при", "ми", "наш"
]);

const RUSSIAN_STOP_WORDS = new Set([
  "и", "в", "на", "до", "с", "из", "что", "это", "для", "как", "не", "по", "к", "а", "но", "мы", "наш"
]);

const ENGLISH_STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "that", "this", "is", "are", "was", "were", "be", "by", "from", "as", "we", "our", "i"
]);

function countSetMatches(words: string[], vocabulary: Set<string>): number {
  return words.reduce((count, word) => count + Number(vocabulary.has(word)), 0);
}

export function detectAiLanguageCoverage(text: string): AiLanguageCoverage {
  const words = text.toLocaleLowerCase("uk-UA").match(/[\p{L}]{2,}/gu) ?? [];
  if (words.length === 0) {
    return { code: "limited", supportedPercent: 0, reason: "У тексті недостатньо мовного матеріалу для визначення покриття." };
  }

  const cyrillicWords = words.filter((word) => /\p{Script=Cyrillic}/u.test(word));
  const latinWords = words.filter((word) => /\p{Script=Latin}/u.test(word));
  const cyrillicShare = cyrillicWords.length / words.length;
  const latinShare = latinWords.length / words.length;
  const ukrainianMarkers = countSetMatches(cyrillicWords, UKRAINIAN_STOP_WORDS) + (text.match(/[іїєґ]/giu)?.length ?? 0);
  const russianMarkers = countSetMatches(cyrillicWords, RUSSIAN_STOP_WORDS) + (text.match(/[ыэёъ]/giu)?.length ?? 0) * 3;
  const englishMarkers = countSetMatches(latinWords, ENGLISH_STOP_WORDS);
  const ukrainianSupported = ukrainianMarkers >= Math.max(2, cyrillicWords.length * 0.025) && russianMarkers <= ukrainianMarkers * 1.15;
  const englishSupported = englishMarkers >= Math.max(2, latinWords.length * 0.025);

  if (cyrillicShare >= 0.72) {
    if (ukrainianSupported) {
      return { code: "uk", supportedPercent: Math.round(cyrillicShare * 100), reason: "Основна мова схожа на українську; для неї доступні статистичні та словникові ознаки." };
    }
    return { code: "limited", supportedPercent: 35, reason: "Кириличний текст не схожий на підтримувану українську вибірку; числовий індикатор має обмежену мовну валідність." };
  }

  if (latinShare >= 0.72) {
    if (englishSupported) {
      return { code: "en", supportedPercent: Math.round(latinShare * 100), reason: "Основна мова схожа на англійську; для неї доступні статистичні та словникові ознаки." };
    }
    return { code: "limited", supportedPercent: 35, reason: "Латинський текст не має достатньо англійських мовних маркерів; висновок лишається невизначеним." };
  }

  if (cyrillicShare >= 0.18 && latinShare >= 0.18 && ukrainianSupported && englishSupported) {
    return {
      code: "mixed",
      supportedPercent: Math.round((cyrillicShare + latinShare) * 100),
      reason: "Документ поєднує український та англійський текст; сегменти оцінюються разом, тому надійність нижча."
    };
  }

  return { code: "limited", supportedPercent: Math.round(Math.max(cyrillicShare, latinShare) * 45), reason: "Мовне покриття детектора обмежене; результат слід читати як невизначений сигнал." };
}
