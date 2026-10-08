import type { Language } from "../context/LanguageContext";

const signalLabelsEn: Record<string, string> = {
  "Файлова перевірка": "File Inspection",
  "Формат документа": "Document Format",
  "Сегментна узгодженість AI-ознак": "Segment AI Consistency",
  "AI-лексика і канцелярит": "AI Lexicon and Formalisms",
  "Шаблонні переходи та зв'язки": "Formulaic Transitions",
  "Шаблонні переходи": "Formulaic Transitions",
  "Роботична структура та синтаксис": "Robotic Structure & Syntax",
  "Шаблон академічної генерації": "Academic Generation Pattern",
  "Prompt-leak та ШІ-відмови": "Prompt-leak & AI Disclaimers",
  "Рівномірність речень (Low Burstiness)": "Sentence Uniformity (Low Burstiness)",
  "Лексичний розподіл (Zipf & Hapax)": "Lexical Distribution (Zipf & Hapax)",
  "Лексична одноманітність": "Lexical Monotony",
  "Синтаксичний темпоритм": "Syntactic Pacing",
  "Часті формальні переходи": "Frequent Formal Transitions",
  "Обережні формулювання": "Hedging & Guardrails",
  "Повтори на початку речень": "Repetitive Sentence Openings",
  "Безособовий стиль": "Impersonal Style",
  "Одноманітна пунктуація": "Monotonous Punctuation",
  "Рівномірність абзаців": "Paragraph Uniformity",
  "Запобіжники від false positive": "False Positive Safeguards",
  "Вилучений неавторський вміст": "Excluded Non-Authorial Content",
  "Стилометрична однорідність": "Stylometric Uniformity",
  "Словникове різноманіття": "Vocabulary Diversity",
  "Тріадичні переліки (Rule of Three)": "Triadic Structures (Rule of Three)",
  "Діалектичне балансування": "Dialectical Balancing & Antithesis"
};

export function translateSignalLabel(label: string, lang: Language): string {
  if (lang === "uk") return label;
  return signalLabelsEn[label] || label;
}

export function translateSignalDetail(detail: string, lang: Language): string {
  if (lang === "uk") return detail;

  let text = detail;

  // File verification detail
  text = text.replace(
    /Документ перевірено як файл:\s*(.+?),\s*(\d+(?:\.\d+)?\s*KB),\s*метод читання\s*(\w+)\.?/i,
    "Document verified as file: $1, $2, read method $3."
  );

  // Document format detail
  text = text.replace(
    /Формат файлу сам по собі не доводить використання ШІ, але зберігається як контекст для звіту\.?/i,
    "File format alone does not prove AI usage, but is preserved as report context."
  );

  // Segment consistency detail
  text = text.replace(
    /Підозрілі ознаки зосереджені у (\d+) з (\d+) повністю перевірених сегментів\. Для ручної перевірки нижче наведено координати найсильніших ділянок\.?/i,
    "Suspicious markers concentrated in $1 of $2 verified segments. Coordinates of strongest sections listed below."
  );

  // Stylometric natural details
  text = text.replace(
    /Варіативність довжини речень виглядає природною\.?/i,
    "Sentence length variation appears natural."
  );

  text = text.replace(
    /Знайдено (\d+) маркер(?:а|ів)?\. Вони часто зустрічаються у згенерованих текстах\.?/i,
    "Found $1 markers commonly occurring in generated texts."
  );

  text = text.replace(
    /Перехідні слова у нормі\.?/i,
    "Transition words within normal range."
  );

  text = text.replace(
    /Базовий звіт згенеровано локально\.\s*AI-думка підвантажується після звіту\.?/i,
    "Base report generated locally. AI opinion loading in background."
  );

  // Generic phrase replacements
  text = text
    .replace(/слів\/КВ/g, "words/KB")
    .replace(/(\d+)\s*слів\b/g, "$1 words")
    .replace(/(\d+)\s*символів\b/g, "$1 chars")
    .replace(/сегмент (\d+):/g, "segment $1:");

  return text;
}

export function translateEvidenceItem(item: string, lang: Language): string {
  if (lang === "uk") return item;

  let text = item;
  text = text
    .replace(/Рівномірність речень \(Low Burstiness\):/g, "Sentence pacing (Low Burstiness):")
    .replace(/Лексична одноманітність:/g, "Lexical monotony:")
    .replace(/Безособовий стиль:/g, "Impersonal style:")
    .replace(/Часті формальні переходи:/g, "Formal transitions:")
    .replace(/Обережні формулювання:/g, "Hedging & guardrails:")
    .replace(/Повтори на початку речень:/g, "Repetitive openings:")
    .replace(/Одноманітна пунктуація:/g, "Monotonous punctuation:")
    .replace(/Рівномірність абзаців:/g, "Paragraph uniformity:")
    .replace(/сегмент (\d+):/g, "segment $1:")
    .replace(/(\d+)\s*слів\b/g, "$1 words")
    .replace(/(\d+)\s*символів\b/g, "$1 chars")
    .replace(/(\d+)\s*слів\/КВ/g, "$1 words/KB");

  return text;
}

export function translateScanNote(note: string, lang: Language): string {
  if (lang === "uk") return note;

  let text = note;

  // Title page note
  text = text.replace(
    /Титульну або службову частину курсової роботи автоматично пропущено\.?/i,
    "Title page or front matter was automatically skipped."
  );
  text = text.replace(
    /Титулку пропущено:\s*(\d+)\s*слів/i,
    "Title page skipped: $1 words"
  );

  // Page verification note
  text = text.replace(
    /Перевірка сторінок:\s*підтверджено\s*(\d+),\s*недоступно\s*(\d+),\s*кеш-влучень\s*(\d+),\s*повторно не завантажувались\s*(\d+)\.?/i,
    "Page verification: $1 verified, $2 unavailable, $3 cache hits, $4 re-downloads."
  );

  // Direct file check note
  text = text.replace(
    /Файл перевірено напряму:\s*(.+?),\s*(\d+(?:\.\d+)?\s*KB),\s*метод\s*(\w+),\s*витягнуто\s*(\d+)\s*слів\.?/i,
    "Direct file inspection: $1, $2, method $3, extracted $4 words."
  );

  // Full coverage note
  text = text.replace(
    /Повне покриття:\s*перевірено\s*(\d+)\s*фрагментів,\s*включно з кінцем документа\.?/i,
    "Full coverage: verified $1 chunks including end of document."
  );

  // Two-phase search note
  text = text.replace(
    /Для довгого тексту застосовано двофазний пошук:\s*швидкий прохід по всіх фрагментах і точне дочитування найсильніших збігів\.?/i,
    "Two-phase search applied for long document: fast multi-chunk pass followed by full-page verification."
  );

  // Web indexes diagnostic note
  if (text.startsWith("Вебіндекси:")) {
    text = text
      .replace(/^Вебіндекси:\s*/, "Web indexes: ")
      .replace(/пропущено/g, "skipped")
      .replace(/не підключено/g, "not connected")
      .replace(/(\d+)\s*рез\./g, "$1 results")
      .replace(/(\d+)\s*пом\./g, "$1 errors");
  }

  return text;
}

export function translateReportSummary(summary: string, lang: Language): string {
  if (lang === "uk") return summary;

  let text = summary;

  // Common summary templates
  text = text.replace(
    /Сильних збігів у відкритих вебджерелах не знайдено\.\s*Локальний AI-аналіз виявив неоднорідні сегменти;\s*індикатор ризику:\s*(\d+)%\.?/i,
    "No strong matches found in open web sources. Local AI analysis detected heterogeneous segments; risk indicator: $1%."
  );

  text = text.replace(
    /Сильних збігів у відкритих вебджерелах не знайдено\.\s*Локальний AI-аналіз не виявив стійких штучних патернів;\s*індикатор ризику:\s*(\d+)%\.?/i,
    "No strong matches found in open web sources. Local AI analysis found no persistent artificial patterns; risk indicator: $1%."
  );

  text = text.replace(
    /Сильних збігів у відкритих вебджерелах не знайдено\.\s*Локальний AI-аналіз показує низький ризик;\s*індикатор:\s*(\d+)%\.?/i,
    "No strong matches found in open web sources. Local AI analysis indicates low risk; indicator: $1%."
  );

  text = text.replace(
    /Сильних збігів у відкритих вебджерелах не знайдено\.\s*Локальний AI-аналіз показав підвищений ризик штучної генерації;\s*індикатор ризику:\s*(\d+)%\.?/i,
    "No strong matches found in open web sources. Local AI analysis indicates elevated risk of AI generation; risk indicator: $1%."
  );

  text = text.replace(
    /Сильних збігів у відкритих вебджерелах не знайдено\.\s*Локальний AI-аналіз показав високий ризик штучної генерації;\s*індикатор ризику:\s*(\d+)%\.?/i,
    "No strong matches found in open web sources. Local AI analysis indicates high risk of AI generation; risk indicator: $1%."
  );

  text = text.replace(
    /Знайдено текстові збіги\s*\((\d+)%\)\s*у відкритих джерелах\./i,
    "Found text matches ($1%) in open sources."
  );

  text = text.replace(
    /AI-думка показана окремо:\s*(\d+)%\.?/i,
    "AI opinion shown separately: $1%."
  );

  return text;
}

export function translateReliabilityReason(reason: string, lang: Language): string {
  if (lang === "uk") return reason;

  let text = reason;

  text = text.replace(
    /Сегменти сильно відрізняються між собою;\s*документ може мати змішане походження або різні жанри\.\s*Неавторський або технічний вміст вилучено:\s*(\d+)\s*слів\.?/i,
    "Segments vary significantly; document may have mixed origin or styles. Non-authorial / technical content excluded: $1 words."
  );

  text = text.replace(
    /Сегменти сильно відрізняються між собою;\s*документ може мати змішане походження або різні жанри\.?/i,
    "Segments vary significantly; document may have mixed origin or different styles."
  );

  text = text.replace(
    /Обсяг достатній,\s*а сегментні оцінки узгоджені\.?/i,
    "Sufficient text volume and consistent segment scores."
  );

  text = text.replace(
    /Оцінка має помірну доказовість і потребує ручної перевірки сигналів\.?/i,
    "Assessment has moderate evidential weight and requires manual review of signals."
  );

  text = text.replace(
    /Достатній обсяг тексту та висока узгодженість між сегментами\.?/i,
    "Sufficient text volume and high consistency across segments."
  );

  text = text.replace(
    /Короткий текст;\s*точність оцінки може бути обмеженою\.?/i,
    "Short text; assessment accuracy may be limited."
  );

  text = text.replace(
    /Неавторський або технічний вміст вилучено:\s*(\d+)\s*слів\.?/i,
    "Non-authorial or technical content excluded: $1 words."
  );

  return text;
}
