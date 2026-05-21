const WORD_PATTERN = /\S+/g;
export function countWords(text) {
    return text.match(WORD_PATTERN)?.length ?? 0;
}
export function normalizeWhitespace(text) {
    return text.replace(/\s+/g, " ").trim();
}
export function chunkText(text, chunkWords, overlapWords, maxChunks) {
    const words = normalizeWhitespace(text).split(" ").filter(Boolean);
    if (words.length === 0)
        return [];
    const safeChunkWords = Math.max(80, chunkWords);
    const safeOverlap = Math.min(Math.max(0, overlapWords), Math.floor(safeChunkWords / 2));
    const step = safeChunkWords - safeOverlap;
    const chunks = [];
    for (let start = 0; start < words.length && chunks.length < maxChunks; start += step) {
        const slice = words.slice(start, start + safeChunkWords);
        chunks.push({
            index: chunks.length,
            text: slice.join(" "),
            wordCount: slice.length
        });
        if (start + safeChunkWords >= words.length)
            break;
    }
    return chunks;
}
export function excerptForSearch(text) {
    const words = normalizeWhitespace(text).split(" ").filter(Boolean);
    if (words.length <= 22)
        return words.join(" ");
    const midpoint = Math.max(0, Math.floor(words.length / 2) - 11);
    return words.slice(midpoint, midpoint + 22).join(" ");
}
