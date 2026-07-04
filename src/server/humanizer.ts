import { countWords, normalizeWhitespace } from "./chunking.js";
import type { HumanizeChange, HumanizeResult } from "../shared/types.js";

type Rule = {
  label: string;
  detail: string;
  pattern: RegExp;
  replacement: string | ((match: string) => string);
};

const RULES: Rule[] = [
  {
    label: "Прибрано чат-артефакти",
    detail: "Вилучено фрази на кшталт привітання, службового пояснення або запрошення продовжити діалог.",
    pattern: /\b(?:great question|of course|certainly|i hope this helps|let me know if you(?:'|’)d like|here is an?|let'?s dive in|let'?s explore)\b[.!?\s]*/gi,
    replacement: ""
  },
  {
    label: "Спрощено AI-канцелярит",
    detail: "Замінено надуті формули на простіші конструкції.",
    pattern: /\b(?:serves as|stands as|acts as)\b/gi,
    replacement: "is"
  },
  {
    label: "Спрощено зайві вступи",
    detail: "Фрази-розігріви прибрано або скорочено.",
    pattern: /\b(?:it is important to note that|it is worth noting that|in order to|at this point in time|due to the fact that)\b/gi,
    replacement: (match) => {
      const lower = match.toLowerCase();
      if (lower.includes("in order")) return "to";
      if (lower.includes("due")) return "because";
      if (lower.includes("point")) return "now";
      return "";
    }
  },
  {
    label: "Прибрано рекламну лексику",
    detail: "Зменшено надмірну урочистість і типові слова LLM.",
    pattern: /\b(?:crucial|pivotal|vibrant|groundbreaking|transformative|seamless|robust|innovative|comprehensive|unique|valuable)\b/gi,
    replacement: (match) => {
      const map: Record<string, string> = {
        crucial: "important",
        pivotal: "important",
        vibrant: "active",
        groundbreaking: "new",
        transformative: "useful",
        seamless: "simple",
        robust: "stable",
        innovative: "new",
        comprehensive: "broad",
        unique: "specific",
        valuable: "useful"
      };
      return map[match.toLowerCase()] ?? match;
    }
  },
  {
    label: "Очищено українські шаблони",
    detail: "Скорочено типові академічні AI-звороти без втрати змісту.",
    pattern: /(?:варто зазначити,?\s*що|слід зазначити,?\s*що|важливо підкреслити,?\s*що|доцільно зазначити,?\s*що|на основі проведеного аналізу встановлено,?\s*що|отримані результати дозволяють зробити висновок,?\s*що|необхідно зауважити,?\s*що|цікаво відзначити,?\s*що)/giu,
    replacement: (match) => {
      const lower = match.toLowerCase();
      if (lower.includes("аналіз")) return "аналіз показав, що";
      if (lower.includes("результати")) return "це дозволяє стверджувати, що";
      return "";
    }
  },
  {
    label: "Переписано академічні заготовки",
    detail: "Службові формули курсової замінено на коротші конструкції без шаблонного вступу.",
    pattern: /(?:метою\s+(?:роботи|дослідження)\s+є|завданнями\s+(?:роботи|дослідження)\s+є|актуальність\s+(?:обраної\s+)?теми\s+(?:полягає|зумовлена)\s+(?:у\s+тому,?\s*що|тим,?\s*що|у)|предметом\s+дослідження\s+є|об['’]єктом\s+дослідження\s+є|робота\s+складається\s+з)/giu,
    replacement: (match) => {
      const lower = match.toLowerCase();
      if (lower.startsWith("метою")) return "Мета:";
      if (lower.startsWith("завданнями")) return "Завдання:";
      if (lower.startsWith("актуальність")) return "Тема актуальна через те, що";
      if (lower.startsWith("предметом")) return "Предмет дослідження:";
      if (lower.startsWith("об'єктом") || lower.startsWith("об’єктом")) return "Об'єкт дослідження:";
      return "Структура роботи:";
    }
  },
  {
    label: "Послаблено безособову академічну подачу",
    detail: "Безособові дієслова замінено на активніші формулювання, щоб текст не звучав як згенерована заготовка.",
    pattern: /(?<![\p{L}\p{N}_])(?:розглянуто|проаналізовано|досліджено|визначено|встановлено|узагальнено|систематизовано|обґрунтовано|виявлено|сформовано|запропоновано|охарактеризовано)(?![\p{L}\p{N}_])/giu,
    replacement: (match) => {
      const map: Record<string, string> = {
        розглянуто: "розглядається",
        проаналізовано: "аналіз подано",
        досліджено: "досліджується",
        визначено: "названо окремо",
        встановлено: "показано",
        узагальнено: "зібрано",
        систематизовано: "упорядковано",
        обґрунтовано: "пояснено",
        виявлено: "помітно",
        сформовано: "підготовлено",
        запропоновано: "подано",
        охарактеризовано: "описано"
      };
      return map[match.toLowerCase()] ?? match;
    }
  },
  {
    label: "Зменшено обережні формулювання",
    detail: "Послаблено часті 'може...', які детектори сприймають як розмиту позицію.",
    pattern: /(?<![\p{L}\p{N}_])(може|можуть)\s+(?:містити|використовувати|показувати|забезпечувати|впливати|свідчити|бути|розмивати|створювати|мати)(?![\p{L}\p{N}_])/giu,
    replacement: (match) => {
      const lower = match.toLowerCase();
      if (lower.includes("містити")) return lower.includes("можуть") ? "містять" : "містить";
      if (lower.includes("використовувати")) return lower.includes("можуть") ? "використовують" : "використовує";
      if (lower.includes("показувати")) return lower.includes("можуть") ? "показують" : "показує";
      if (lower.includes("забезпечувати")) return lower.includes("можуть") ? "забезпечують" : "забезпечує";
      if (lower.includes("впливати")) return lower.includes("можуть") ? "впливають" : "впливає";
      if (lower.includes("свідчити")) return lower.includes("можуть") ? "свідчать" : "свідчить";
      if (lower.includes("бути")) return lower.includes("можуть") ? "є" : "є";
      if (lower.includes("розмивати")) return lower.includes("можуть") ? "розмивають" : "розмиває";
      if (lower.includes("створювати")) return lower.includes("можуть") ? "створюють" : "створює";
      if (lower.includes("мати")) return lower.includes("можуть") ? "мають" : "має";
      return match;
    }
  },
  {
    label: "Спрощено типову AI-лексику",
    detail: "Замінено слова, які часто створюють канцелярний або згенерований тон.",
    pattern: /(?<![\p{L}\p{N}_])(?:важливий|важлива|важливе|важливі|ефективний|ефективна|ефективне|ефективні|комплексний|комплексна|комплексне|комплексні|практичне значення|теоретичне значення|ключовий|ключова|ключове|ключові|унікальний|унікальна|унікальне|унікальні|інноваційний|інноваційна|інноваційне|інноваційні)(?![\p{L}\p{N}_])/giu,
    replacement: (match) => {
      const map: Record<string, string> = {
        важливий: "потрібний",
        важлива: "потрібна",
        важливе: "потрібне",
        важливі: "потрібні",
        ефективний: "дієвий",
        ефективна: "дієва",
        ефективне: "дієве",
        ефективні: "дієві",
        комплексний: "цілісний",
        комплексна: "цілісна",
        комплексне: "цілісне",
        комплексні: "цілісні",
        "практичне значення": "користь",
        "теоретичне значення": "теоретична користь",
        ключовий: "головний",
        ключова: "головна",
        ключове: "головне",
        ключові: "головні",
        унікальний: "окремий",
        унікальна: "окрема",
        унікальне: "окреме",
        унікальні: "окремі",
        інноваційний: "новий",
        інноваційна: "нова",
        інноваційне: "нове",
        інноваційні: "нові"
      };
      return map[match.toLowerCase()] ?? match;
    }
  },
  {
    label: "Прибрано гладкі LLM-дієслова",
    detail: "Заміщено дієслова, які часто створюють надто загальний управлінський тон.",
    pattern: /(?<![\p{L}\p{N}_])(?:сприяє|забезпечує|оптимізує|покращує|розкриває потенціал|відіграє ключову роль|підкреслює)(?![\p{L}\p{N}_])/giu,
    replacement: (match) => {
      const map: Record<string, string> = {
        сприяє: "допомагає",
        забезпечує: "дає",
        оптимізує: "спрощує",
        покращує: "поліпшує",
        "розкриває потенціал": "показує можливості",
        "відіграє ключову роль": "має значення",
        підкреслює: "показує"
      };
      return map[match.toLowerCase()] ?? match;
    }
  },
  {
    label: "Прибрано нечіткі авторитетні твердження",
    detail: "Розмиті посилання на експертів або дослідження замінено на нейтральніші формулювання.",
    pattern: /(?<![\p{L}\p{N}_])(?:експерти вважають|дослідження показують|численні фактори|різноманітні аспекти|багато джерел|широкий спектр|experts argue|observers note|studies show|research suggests|various factors|numerous examples)(?![\p{L}\p{N}_])/giu,
    replacement: (match) => {
      const lower = match.toLowerCase();
      if (lower.includes("експерти") || lower.includes("experts")) return "у джерелах зазначають";
      if (lower.includes("дослідження") || lower.includes("studies") || lower.includes("research")) return "дані показують";
      if (lower.includes("фактор") || lower.includes("factor")) return "причини";
      if (lower.includes("аспект")) return "деталі";
      if (lower.includes("джерел")) return "джерела";
      if (lower.includes("спектр")) return "кілька варіантів";
      return "приклади";
    }
  },
  {
    label: "Зменшено негативний паралелізм",
    detail: "Переписано характерні конструкції 'не лише..., а й...' у простішу форму.",
    pattern: /не\s+(?:лише|тільки)\s+([^,.]{3,90}?),\s*а\s+й\s+/giu,
    replacement: "$1 і "
  },
  {
    label: "Прибрано зайве форматування",
    detail: "Знято механічний markdown-жирний, emoji та декоративні довгі тире.",
    pattern: /(\*\*|__|[🚀✅💡🔥⭐️✨]|—|–)/gu,
    replacement: (match) => (match === "—" || match === "–" ? "," : "")
  },
  {
    label: "Нормалізовано лапки",
    detail: "Криві лапки замінено на прості.",
    pattern: /[“”„«»]/gu,
    replacement: "\""
  },
  {
    label: "Розширено українські синоніми",
    detail: "Замінено заїжджені слова на більш природні синоніми.",
    pattern: /(?<![\p{L}\p{N}_])(?:даний|дана|дане|дані|вищезазначений|вищезазначена|вищевказаний|вищевказана|зокрема|безпосередньо|власне)(?![\p{L}\p{N}_])/giu,
    replacement: (match) => {
      const map: Record<string, string> = {
        даний: "цей",
        дана: "ця",
        дане: "це",
        дані: "ці",
        вищезазначений: "цей",
        вищезазначена: "ця",
        вищевказаний: "цей",
        вищевказана: "ця",
        зокрема: "наприклад",
        безпосередньо: "прямо",
        власне: "саме"
      };
      return map[match.toLowerCase()] ?? match;
    }
  },
  {
    label: "Олюднення структури речень",
    detail: "Додано розмовні частки або змінено порядок для менш формального тону.",
    pattern: /(?<![\p{L}\p{N}_])(загалом|насправді|очевидно|безумовно),?\s+/giu,
    replacement: (match: string) => {
       const word = match.trim().replace(/,$/, "");
       const map: Record<string, string> = {
         загалом: "як правило,",
         насправді: "як виявилося,",
         очевидно: "мабуть,",
         безумовно: "звісно,"
       };
       return map[word.toLowerCase()] ?? match;
    }
  },
  {
    label: "Згладжування категоричних тверджень",
    detail: "Додано вставні слова для створення менш штучного тону.",
    pattern: /(?<![\p{L}\p{N}_])(?:це\s+свідчить|це\s+доводить|це\s+підтверджує|це\s+означає|що\s+свідчить|що\s+підтверджує)(?![\p{L}\p{N}_])/giu,
    replacement: (match: string) => {
      const lower = match.toLowerCase();
      if (lower.startsWith("що")) return `${lower}, ймовірно,`;
      return `${lower}, скоріш за все,`;
    }
  },
  {
    label: "Урізноманітнення дієслів",
    detail: "Заміна частих дієслів на більш живі аналоги.",
    pattern: /(?<![\p{L}\p{N}_])(?:використовувати|використовується|використовуються|дозволяє|дозволяють|забезпечує|забезпечують)(?![\p{L}\p{N}_])/giu,
    replacement: (match: string) => {
      const map: Record<string, string> = {
        використовувати: "застосовувати",
        використовується: "застосовується",
        використовуються: "застосовуються",
        дозволяє: "дає змогу",
        дозволяють: "дають змогу",
        забезпечує: "гарантує",
        забезпечують: "гарантують"
      };
      return map[match.toLowerCase()] ?? match;
    }
  }
];

function applyRule(text: string, rule: Rule): { text: string; count: number } {
  let count = 0;
  const revised = text.replace(rule.pattern, (...args) => {
    count += 1;
    const match = String(args[0]);
    if (typeof rule.replacement === "function") return rule.replacement(match);

    return rule.replacement.replace(/\$(\d+)/g, (_token, index: string) => String(args[Number(index)] ?? ""));
  });

  return { text: revised, count };
}

function softenRigidSentences(text: string): { text: string; count: number } {
  let count = 0;
  const revised = text.replace(/([.!?])\s+(Furthermore|Moreover|Additionally|Therefore|Отже|Таким чином|Крім того),?\s+/gu, (_match, punctuation: string, transition: string) => {
    count += 1;
    const lower = transition === "Отже" || transition === "Таким чином" ? "Отже" : "";
    return lower ? `${punctuation} ${lower}: ` : `${punctuation} `;
  });

  return { text: revised, count };
}

function removeDuplicateSentences(text: string): { text: string; count: number } {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/gu) ?? [text];
  const seen = new Set<string>();
  const kept: string[] = [];
  let count = 0;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    const normalized = trimmed
      .toLowerCase()
      .replace(/\d+/g, "#")
      .replace(/[^\p{L}\p{N}\s#]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (normalized.split(" ").length >= 7 && seen.has(normalized)) {
      count += 1;
      continue;
    }

    if (normalized) seen.add(normalized);
    kept.push(trimmed);
  }

  return { text: kept.join(" "), count };
}

function varyRepeatedSentenceStarts(text: string): { text: string; count: number } {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/gu) ?? [text];
  const counts = new Map<string, number>();
  const revised: string[] = [];
  let count = 0;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    const tokens = trimmed
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
      .split(/\s+/)
      .filter(Boolean);
    const start = tokens.slice(0, 3).join(" ");
    const seen = counts.get(start) ?? 0;
    counts.set(start, seen + 1);

    if (seen > 0 && start.length > 6) {
      const words = trimmed.split(/\s+/);
      if (/^(у|в)\s+роботі\b/iu.test(trimmed)) {
        revised.push(trimmed.replace(/^(у|в)\s+роботі\s+/iu, "У цьому контексті "));
        count += 1;
        continue;
      }
      if (words.length > 8) {
        const leads = ["Крім того,", "Варто додати, що", "Також", "Водночас,"];
        const lead = leads[seen % leads.length];
        revised.push(`${lead} ${words[0].toLowerCase()}${words.length > 1 ? ' ' + words.slice(1).join(" ") : ""}`);
        count += 1;
        continue;
      }
    }

    revised.push(trimmed);
  }

  return { text: revised.join(" "), count };
}

export function humanizeText(input: string): HumanizeResult {
  const original = normalizeWhitespace(input);
  if (countWords(original) < 20) {
    throw new Error("Додайте щонайменше 20 слів для олюднення.");
  }

  let revised = original;
  const changes: HumanizeChange[] = [];

  for (const rule of RULES) {
    const result = applyRule(revised, rule);
    revised = result.text;
    if (result.count > 0) {
      changes.push({ label: rule.label, count: result.count, detail: rule.detail });
    }
  }

  const softened = softenRigidSentences(revised);
  revised = softened.text;
  if (softened.count > 0) {
    changes.push({
      label: "Послаблено механічні переходи",
      count: softened.count,
      detail: "Зменшено кількість явних переходів, які роблять текст схожим на план-відповідь."
    });
  }

  const deduplicated = removeDuplicateSentences(revised);
  revised = deduplicated.text;
  if (deduplicated.count > 0) {
    changes.push({
      label: "Прибрано повторені речення",
      count: deduplicated.count,
      detail: "Вилучено дублікати, які підсилюють показники шаблонності та лексичної передбачуваності."
    });
  }

  const variedStarts = varyRepeatedSentenceStarts(revised);
  revised = variedStarts.text;
  if (variedStarts.count > 0) {
    changes.push({
      label: "Урізноманітнено початки речень",
      count: variedStarts.count,
      detail: "Повторювані початки речень переписано, щоб текст не читався як серія однакових шаблонів."
    });
  }

  revised = normalizeWhitespace(revised)
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();

  const notes = [
    "Олюднення не гарантує проходження AI-детекторів; воно прибирає типові стилістичні маркери та робить текст природнішим.",
    "Факти, цитати й посилання треба перевірити вручну після редагування."
  ];

  if (changes.length === 0) {
    notes.unshift("Явних AI-шаблонів не знайдено, текст залишено майже без змін.");
  }

  return {
    originalWordCount: countWords(original),
    revisedWordCount: countWords(revised),
    revisedText: revised,
    changes,
    notes
  };
}
