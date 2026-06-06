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
    pattern: /(?:варто зазначити,?\s*що|слід зазначити,?\s*що|важливо підкреслити,?\s*що|на основі проведеного аналізу встановлено,?\s*що|отримані результати дозволяють зробити висновок,?\s*що)/giu,
    replacement: (match) => (match.toLowerCase().includes("аналіз") ? "аналіз показав, що" : "")
  },
  {
    label: "Зменшено обережні формулювання",
    detail: "Послаблено часті 'може...', які детектори сприймають як розмиту позицію.",
    pattern: /(?<![\p{L}\p{N}_])може\s+(?:містити|використовувати|показувати|забезпечувати|впливати|свідчити|бути|розмивати|створювати)(?![\p{L}\p{N}_])/giu,
    replacement: (match) => {
      const map: Record<string, string> = {
        "може містити": "містить",
        "може використовувати": "використовує",
        "може показувати": "показує",
        "може забезпечувати": "забезпечує",
        "може впливати": "впливає",
        "може свідчити": "свідчить",
        "може бути": "є",
        "може розмивати": "розмиває",
        "може створювати": "створює"
      };
      return map[match.toLowerCase()] ?? match;
    }
  },
  {
    label: "Спрощено типову AI-лексику",
    detail: "Замінено слова, які часто створюють канцелярний або згенерований тон.",
    pattern: /(?<![\p{L}\p{N}_])(?:важливий|важлива|важливе|важливі|ефективний|ефективна|ефективне|ефективні|комплексний|комплексна|комплексне|комплексні|практичне значення|ключовий|ключова|ключове|ключові)(?![\p{L}\p{N}_])/giu,
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
        ключовий: "головний",
        ключова: "головна",
        ключове: "головне",
        ключові: "головні"
      };
      return map[match.toLowerCase()] ?? match;
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
