import { franc } from "franc-min";
import type { AiLanguageCoverage } from "../../../shared/types/index.js";

export function detectAiLanguageCoverage(text: string): AiLanguageCoverage {
  if (text.length < 50) {
    return { code: "limited", supportedPercent: 0, reason: "У тексті недостатньо мовного матеріалу для визначення покриття." };
  }

  const langCode = franc(text);

  if (langCode === "ukr") {
    return { code: "uk", supportedPercent: 95, reason: "Основна мова визначена як українська (через franc)." };
  }

  if (langCode === "eng") {
    return { code: "en", supportedPercent: 95, reason: "Основна мова визначена як англійська (через franc)." };
  }

  if (langCode === "rus") {
    return { code: "limited", supportedPercent: 30, reason: "Російська мова має обмежену підтримку та не рекомендується для аналізу." };
  }

  // Fallback for mixed or other
  const cyrillicWords = text.match(/[\p{Script=Cyrillic}]{2,}/gu) ?? [];
  const latinWords = text.match(/[\p{Script=Latin}]{2,}/gu) ?? [];
  const totalWords = text.match(/[\p{L}]{2,}/gu) ?? [];

  if (totalWords.length > 0) {
    const cyrillicShare = cyrillicWords.length / totalWords.length;
    const latinShare = latinWords.length / totalWords.length;

    if (cyrillicShare >= 0.18 && latinShare >= 0.18) {
      return {
        code: "mixed",
        supportedPercent: Math.round((cyrillicShare + latinShare) * 100),
        reason: "Документ поєднує український/кириличний та англійський/латинський текст; сегменти оцінюються разом, тому надійність нижча."
      };
    }
  }

  return { code: "limited", supportedPercent: 35, reason: "Мовне покриття детектора обмежене; результат слід читати як невизначений сигнал." };
}
