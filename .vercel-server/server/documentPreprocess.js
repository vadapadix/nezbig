import { countWords, normalizeWhitespace } from "./chunking.js";
import { filterProseText } from "./proseFilter.js";
const COURSE_TITLE_MARKERS = [
    /міністерство\s+освіти/i,
    /заклад\s+вищої\s+освіти/i,
    /університет/i,
    /коледж/i,
    /кафедра/i,
    /курсова\s+робота/i,
    /кваліфікаційна\s+робота/i,
    /дипломна\s+робота/i,
    /освітньо-професійна\s+програма/i,
    /галузь\s+знань/i,
    /спеціальність\s+\d+/i,
    /виконав(?:ець|ла|)/i,
    /керівник/i,
    /студент(?:ка|)/i
];
const BODY_START_PATTERN = /(?<![\p{L}\p{N}_])(вступ|розділ\s*[0-9ivx]+|глава\s*[0-9ivx]+|chapter\s*[0-9ivx]+|introduction|1\.\s+[А-ЯA-ZІЇЄҐ]|зміст|анотація)(?![\p{L}\p{N}_])/iu;
export const BIBLIOGRAPHY_PATTERNS = [
    /(?<![\p{L}\p{N}_])(?:(?:розділ\s+\d+[\.:\s]+|\d+[\.\)]\s*)?(?:список\s+(?:використаних\s+|використаної\s+)?(?:джерел|літератури|посилань)|список\s+джерел\s+та\s+літератури|перелік\s+(?:використаних\s+|використаної\s+)?(?:джерел|літератури|посилань)|бібліографічний\s+список|бібліографія|використані\s+джерела|використана\s+література|references|bibliography|works\s+cited|literature\s+cited))(?!\p{L})\s*[:\.\n\r—–-]*/iu,
    /(?<![\p{L}\p{N}_])(?:(?:розділ\s+\d+[\.:\s]+|\d+[\.\)]\s*)?(?:додатки|додаток\s+[а-яa-z0-9]|appendices|appendix\s+[a-z0-9]))(?!\p{L})\s*[:\.\n\r—–-]*/iu
];
function findBibliographyStart(text) {
    // A bibliography is normally in the latter half of the document (> 35% of total text length)
    const minPos = Math.floor(text.length * 0.35);
    for (const pattern of BIBLIOGRAPHY_PATTERNS) {
        const slice = text.slice(minPos);
        const match = pattern.exec(slice);
        if (match && match.index !== undefined) {
            return minPos + match.index;
        }
    }
    return -1;
}
export function prepareDocumentText(rawText) {
    const prose = filterProseText(rawText);
    let text = prose.text;
    let skippedTitleWords = 0;
    let skippedBibliographyWords = 0;
    const notes = [...prose.notes];
    // 1. Strip Bibliography / References / Appendices
    const bibStart = findBibliographyStart(text);
    if (bibStart > 0) {
        const body = text.slice(0, bibStart);
        const tail = text.slice(bibStart);
        const tailWords = countWords(tail);
        const bodyWords = countWords(body);
        // Only strip if there is sufficient actual body text remaining
        if (tailWords >= 8 && bodyWords >= 25) {
            text = body;
            skippedBibliographyWords = tailWords;
            notes.push(`Список використаних джерел (${tailWords} слів) виключено з перевірки згідно з академічними стандартами.`);
        }
    }
    // 2. Strip Title Page / Institutional Cover Block
    const head = text.slice(0, 6000);
    const markerCount = COURSE_TITLE_MARKERS.filter((pattern) => pattern.test(head)).length;
    const bodyStart = head.search(BODY_START_PATTERN);
    if (markerCount >= 2 && bodyStart > 30) {
        const skipped = text.slice(0, bodyStart);
        const cleaned = normalizeWhitespace(text.slice(bodyStart));
        if (cleaned.length > 100 || countWords(cleaned) >= 20) {
            skippedTitleWords = countWords(skipped);
            text = cleaned;
            notes.unshift("Титульну або службову частину роботи автоматично пропущено.");
        }
    }
    return {
        text: normalizeWhitespace(text),
        skippedTitleWords,
        skippedBibliographyWords,
        notes
    };
}
