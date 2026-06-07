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
        pattern: /(?:варто зазначити,?\s*що|слід зазначити,?\s*що|важливо підкреслити,?\s*що|доцільно зазначити,?\s*що|на основі проведеного аналізу встановлено,?\s*що|отримані результати дозволяють зробити висновок,?\s*що)/giu,
        replacement: (match) => (match.toLowerCase().includes("аналіз") ? "аналіз показав, що" : "")
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
        label: "Послаблено безособову академічну подачу",
        detail: "Безособові дієслова замінено на активніші формулювання, щоб текст не звучав як згенерована заготовка.",
        pattern: /(?<![\p{L}\p{N}_])(?:розглянуто|проаналізовано|досліджено|визначено|встановлено|узагальнено|систематизовано|обґрунтовано|виявлено|сформовано|запропоновано|охарактеризовано)(?![\p{L}\p{N}_])/giu,
        replacement: (match) => {
            const map = {
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
        pattern: /(?<![\p{L}\p{N}_])може\s+(?:містити|використовувати|показувати|забезпечувати|впливати|свідчити|бути|розмивати|створювати)(?![\p{L}\p{N}_])/giu,
        replacement: (match) => {
            const map = {
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
        pattern: /(?<![\p{L}\p{N}_])(?:важливий|важлива|важливе|важливі|ефективний|ефективна|ефективне|ефективні|комплексний|комплексна|комплексне|комплексні|практичне значення|теоретичне значення|ключовий|ключова|ключове|ключові|унікальний|унікальна|унікальне|унікальні|інноваційний|інноваційна|інноваційне|інноваційні)(?![\p{L}\p{N}_])/giu,
        replacement: (match) => {
            const map = {
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
            const map = {
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
            if (lower.includes("експерти") || lower.includes("experts"))
                return "у джерелах зазначають";
            if (lower.includes("дослідження") || lower.includes("studies") || lower.includes("research"))
                return "дані показують";
            if (lower.includes("фактор") || lower.includes("factor"))
                return "причини";
            if (lower.includes("аспект"))
                return "деталі";
            if (lower.includes("джерел"))
                return "джерела";
            if (lower.includes("спектр"))
                return "кілька варіантів";
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
function removeDuplicateSentences(text) {
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/gu) ?? [text];
    const seen = new Set();
    const kept = [];
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
        if (normalized)
            seen.add(normalized);
        kept.push(trimmed);
    }
    return { text: kept.join(" "), count };
}
function varyRepeatedSentenceStarts(text) {
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/gu) ?? [text];
    const counts = new Map();
    const revised = [];
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
                revised.push(trimmed.replace(/^(у|в)\s+роботі\s+/iu, "Далі "));
                count += 1;
                continue;
            }
            if (words.length > 8) {
                const lead = seen % 2 === 0 ? "Далі" : "Після цього";
                revised.push(`${lead} ${words.slice(1).join(" ")}`);
                count += 1;
                continue;
            }
        }
        revised.push(trimmed);
    }
    return { text: revised.join(" "), count };
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
