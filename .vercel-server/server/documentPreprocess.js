import { normalizeWhitespace } from "./chunking.js";
const COURSE_TITLE_MARKERS = [
    /міністерство\s+освіти/i,
    /заклад\s+вищої\s+освіти/i,
    /університет/i,
    /кафедра/i,
    /курсова\s+робота/i,
    /кваліфікаційна\s+робота/i,
    /виконав(?:ець|ла|)/i,
    /керівник/i,
    /студент(?:ка|)/i
];
const BODY_START_PATTERN = /(?<![\p{L}\p{N}_])(зміст|вступ|розділ\s*1|розділ\s*i|chapter\s*1|introduction)(?![\p{L}\p{N}_])/iu;
export function prepareDocumentText(rawText) {
    const text = normalizeWhitespace(rawText);
    const head = text.slice(0, 5000);
    const markerCount = COURSE_TITLE_MARKERS.filter((pattern) => pattern.test(head)).length;
    const bodyStart = head.search(BODY_START_PATTERN);
    if (markerCount >= 2 && bodyStart > 40) {
        const skipped = text.slice(0, bodyStart);
        const cleaned = normalizeWhitespace(text.slice(bodyStart));
        if (cleaned.length > 120) {
            return {
                text: cleaned,
                skippedTitleWords: skipped.split(/\s+/).filter(Boolean).length,
                notes: ["Титульну або службову частину курсової роботи автоматично пропущено."]
            };
        }
    }
    return {
        text,
        skippedTitleWords: 0,
        notes: []
    };
}
