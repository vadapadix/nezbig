import { countWords, normalizeWhitespace } from "./chunking.js";
const RULES = [
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
            if (lower.includes("in order"))
                return "to";
            if (lower.includes("due"))
                return "because";
            if (lower.includes("point"))
                return "now";
            return "";
        }
    },
    {
        label: "Прибрано рекламну лексику",
        detail: "Зменшено надмірну урочистість і типові слова LLM.",
        pattern: /\b(?:crucial|pivotal|vibrant|groundbreaking|transformative|seamless|robust|innovative|comprehensive|unique|valuable)\b/gi,
        replacement: (match) => {
            const map = {
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
function applyRule(text, rule) {
    let count = 0;
    const revised = text.replace(rule.pattern, (...args) => {
        count += 1;
        const match = String(args[0]);
        if (typeof rule.replacement === "function")
            return rule.replacement(match);
        return rule.replacement.replace(/\$(\d+)/g, (_token, index) => String(args[Number(index)] ?? ""));
    });
    return { text: revised, count };
}
function softenRigidSentences(text) {
    let count = 0;
    const revised = text.replace(/([.!?])\s+(Furthermore|Moreover|Additionally|Therefore|Отже|Таким чином|Крім того),?\s+/gu, (_match, punctuation, transition) => {
        count += 1;
        const lower = transition === "Отже" || transition === "Таким чином" ? "Отже" : "";
        return lower ? `${punctuation} ${lower}: ` : `${punctuation} `;
    });
    return { text: revised, count };
}
export function humanizeText(input) {
    const original = normalizeWhitespace(input);
    if (countWords(original) < 20) {
        throw new Error("Додайте щонайменше 20 слів для олюднення.");
    }
    let revised = original;
    const changes = [];
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
