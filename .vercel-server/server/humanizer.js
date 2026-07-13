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
        pattern: /(?:варто зазначити,?\s*що|слід зазначити,?\s*що|важливо підкреслити,?\s*що|доцільно зазначити,?\s*що|на основі проведеного аналізу встановлено,?\s*що|отримані результати дозволяють зробити висновок,?\s*що|необхідно зауважити,?\s*що|цікаво відзначити,?\s*що)/giu,
        replacement: (match) => {
            const lower = match.toLowerCase();
            if (lower.includes("аналіз"))
                return "аналіз показав, що";
            if (lower.includes("результати"))
                return "це дозволяє стверджувати, що";
            return "";
        }
    },
    {
        label: "Переписано академічні заготовки",
        detail: "Службові формули курсової замінено на коротші конструкції без шаблонного вступу.",
        pattern: /(?:метою\s+(?:роботи|дослідження)\s+є|завданнями\s+(?:роботи|дослідження)\s+є|актуальність\s+(?:обраної\s+)?теми\s+(?:полягає|зумовлена)\s+(?:у\s+тому,?\s*що|тим,?\s*що|у)|предметом\s+дослідження\s+є|об['’]єктом\s+дослідження\s+є|робота\s+складається\s+з)/giu,
        replacement: (match) => {
            const lower = match.toLowerCase();
            if (lower.startsWith("метою"))
                return "Мета:";
            if (lower.startsWith("завданнями"))
                return "Завдання:";
            if (lower.startsWith("актуальність"))
                return "Тема актуальна через те, що";
            if (lower.startsWith("предметом"))
                return "Предмет дослідження:";
            if (lower.startsWith("об'єктом") || lower.startsWith("об’єктом"))
                return "Об'єкт дослідження:";
            return "Структура роботи:";
        }
    },
    {
        label: "Переписано безособові службові конструкції",
        detail: "Фрази про зміст самої роботи переведено в активну форму; терміни й висновки поза цими фразами не змінено.",
        pattern: /(?<![\p{L}\p{N}_])у\s+(?:цій\s+)?роботі\s+(?:розглянуто|проаналізовано|досліджено)(?![\p{L}\p{N}_])/giu,
        replacement: (match) => {
            const lower = match.toLowerCase();
            if (lower.includes("проаналізовано"))
                return "робота аналізує";
            if (lower.includes("досліджено"))
                return "робота досліджує";
            return "робота описує";
        }
    },
    {
        label: "Прибрано накопичення оцінних прикметників",
        detail: "Скорочено лише подвійні оцінні кліше; окремі наукові й технічні терміни збережено.",
        pattern: /(?<![\p{L}\p{N}_])(?:важлив(?:ий|а|е|і)|ключов(?:ий|а|е|і)|унікальн(?:ий|а|е|і)|інноваційн(?:ий|а|е|і))\s+(?:комплексн(?:ий|а|е|і)|ефективн(?:ий|а|е|і))\s+(підхід|аспект|блок|рішення|система|процес)(?![\p{L}\p{N}_])/giu,
        replacement: "$1"
    },
    {
        label: "Прибрано гладкі LLM-дієслова",
        detail: "Спрощено лише сталі канцелярні конструкції без заміни точних дієслів у технічному контексті.",
        pattern: /(?<![\p{L}\p{N}_])(?:сприяє підвищенню|забезпечує можливість|розкриває потенціал)(?![\p{L}\p{N}_])/giu,
        replacement: (match) => {
            const map = {
                "сприяє підвищенню": "підвищує",
                "забезпечує можливість": "дає змогу",
                "розкриває потенціал": "показує можливості",
            };
            return map[match.toLowerCase()] ?? match;
        }
    },
    {
        label: "Спрощено формули про значення роботи",
        detail: "Скорочено лише сталі академічні формули без переписування тверджень або їхніх джерел.",
        pattern: /(?<![\p{L}\p{N}_])(?:(?:важливе|значне)\s+)?(?:практичне значення|теоретичне значення)(?![\p{L}\p{N}_])/giu,
        replacement: (match) => {
            return match.toLowerCase().includes("практичне") ? "практична користь" : "теоретична користь";
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
        detail: "Знято механічний markdown-жирний та декоративні emoji; авторську пунктуацію збережено.",
        pattern: /(\*\*|__|[🚀✅💡🔥⭐️✨])/gu,
        replacement: ""
    },
    {
        label: "Розширено українські синоніми",
        detail: "Замінено заїжджені слова на більш природні синоніми.",
        pattern: /(?<![\p{L}\p{N}_])(?:даний|дана|дане|вищезазначений|вищезазначена|вищевказаний|вищевказана)(?![\p{L}\p{N}_])/giu,
        replacement: (match) => {
            const map = {
                даний: "цей",
                дана: "ця",
                дане: "це",
                вищезазначений: "цей",
                вищезазначена: "ця",
                вищевказаний: "цей",
                вищевказана: "ця"
            };
            return map[match.toLowerCase()] ?? match;
        }
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
function normalizeParagraphs(text) {
    return text
        .replace(/\r\n?/g, "\n")
        .split(/\n{2,}/)
        .map((paragraph) => normalizeWhitespace(paragraph))
        .filter(Boolean)
        .join("\n\n");
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
function removeDuplicateSentences(text) {
    let count = 0;
    const paragraphs = text.split(/\n{2,}/).map((paragraph) => {
        const seen = new Set();
        const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/gu) ?? [paragraph];
        const kept = [];
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
            if (normalized)
                seen.add(normalized);
            kept.push(trimmed);
        }
        return kept.join(" ");
    }).filter(Boolean);
    return { text: paragraphs.join("\n\n"), count };
}
function varyRepeatedSentenceStarts(text) {
    const counts = new Map();
    let count = 0;
    const paragraphs = text.split(/\n{2,}/).map((paragraph) => {
        const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/gu) ?? [paragraph];
        const revised = [];
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
            if (seen > 0 && start.length > 6 && /^(у|в)\s+роботі\b/iu.test(trimmed)) {
                revised.push(trimmed.replace(/^(у|в)\s+роботі\s+/iu, "У цьому контексті "));
                count += 1;
                continue;
            }
            revised.push(trimmed);
        }
        return revised.join(" ");
    });
    return { text: paragraphs.join("\n\n"), count };
}
export function humanizeText(input) {
    const original = normalizeParagraphs(input);
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
    revised = revised
        .split(/\n{2,}/)
        .map((paragraph) => normalizeWhitespace(paragraph)
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/,\s*,/g, ",")
        .trim())
        .filter(Boolean)
        .join("\n\n");
    const notes = [
        "Редагування не доводить людське авторство і не гарантує результату AI-детекторів; воно прибирає шаблонні формули та покращує читабельність.",
        "Модальність, тире, лапки й абзаци збережено, щоб не спотворювати авторський зміст.",
        "Факти, цитати й посилання треба перевірити вручну після редагування."
    ];
    const vagueAttributions = original.match(/(?<![\p{L}\p{N}_])(?:експерти вважають|дослідження показують|багато джерел|experts argue|observers note|studies show|research suggests)(?![\p{L}\p{N}_])/giu) ?? [];
    if (vagueAttributions.length > 0) {
        notes.unshift(`Знайдено ${vagueAttributions.length} нечітких посилань на джерела. Формулювання збережено; додайте конкретного автора, працю або посилання вручну.`);
    }
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
