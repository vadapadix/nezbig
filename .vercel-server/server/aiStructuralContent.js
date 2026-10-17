import { countWords } from "./chunking.js";
const CHAPTER = /(?<![\p{L}\p{N}_])(?:розділ|глава|chapter)\s*\d+/giu;
const SUBHEADING = /(?<![\p{L}\p{N}.])\d{1,2}\.\d{1,2}(?:\.\d{1,2})?\s+[\p{L}]/gu;
function looksLikeContents(text) {
    const chapters = [...text.matchAll(CHAPTER)].length;
    const subsections = [...text.matchAll(SUBHEADING)].length;
    // Dense heading runs, not an ordinary document containing section headings.
    return chapters >= 2 && subsections >= 4 && countWords(text) / (chapters + subsections) < 30;
}
function schemaTable(text) {
    const fields = text.match(/[\p{L}_][\p{L}\p{N}_’'-]*\.(?:ID|Id|id|[\p{L}_][\p{L}\p{N}_’'-]*)/gu) ?? [];
    const relationships = text.match(/\b[1NnМм]\s*[:：]\s*(?:∞|[1NnМм*])/gu) ?? [];
    return countWords(text) <= 350 && fields.length >= 4 && relationships.length >= 2 && /(?:пов[’']?язана\s+таблиця|тип\s+зв[’']?язку|зміст\s+зв[’']?язку|related\s+table|relationship\s+type)/iu.test(text);
}
export function removeStructuralAiContent(raw) {
    let text = raw;
    let removedWords = 0;
    // Extractors can flatten the TOC. Look for its repeated body start before
    // removing anything; ordinary first chapters without a dense TOC stay intact.
    const starts = [...text.matchAll(/(?<![\p{L}\p{N}_])(?:вступ|introduction|розділ\s*1(?!\d)|chapter\s*1(?!\d))(?![\p{L}\p{N}_])/giu)];
    for (const start of starts) {
        const prefix = text.slice(0, start.index);
        if (looksLikeContents(prefix)) {
            removedWords += countWords(prefix);
            text = text.slice(start.index);
            break;
        }
    }
    // A document consisting only of a heading list has no prose to score.
    if (looksLikeContents(text) && !/[.!?]\s+[А-ЯІЇЄҐA-Z][а-яіїєґa-z]{2,}/u.test(text)) {
        return { text: "", removedWords: removedWords + countWords(text) };
    }
    // Keep table line runs together; a blank line is the boundary of surrounding prose.
    const blocks = text.split(/\n\s*\n/);
    for (let index = 0; index < blocks.length; index++) {
        const block = blocks[index];
        if (!/(?:пов[’']?язана\s+таблиця|тип\s+зв[’']?язку|зміст\s+зв[’']?язку|related\s+table|relationship\s+type)/iu.test(block))
            continue;
        let end = schemaTable(block) ? index + 1 : index;
        let candidate = block;
        for (let next = index + 1; next < blocks.length && countWords(candidate) <= 350; next++) {
            const part = blocks[next];
            if (countWords(part) > 40 || /^\s*(?:розділ|chapter|\d+\.\d+\s)/iu.test(part))
                break;
            candidate += `\n\n${part}`;
            if (schemaTable(candidate) && /[\p{L}_]\.[\p{L}_]|\b1\s*[:：]\s*(?:∞|[1NnМм*])/u.test(part))
                end = next + 1;
        }
        if (end <= index)
            continue;
        for (let removed = index; removed < end; removed++) {
            removedWords += countWords(blocks[removed]);
            blocks[removed] = "";
        }
        index = end - 1;
    }
    text = blocks.join("\n\n");
    return { text, removedWords };
}
