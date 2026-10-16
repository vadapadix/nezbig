// Offsets refer to whitespace-separated words in the prepared document, including short words.
// Exact nine-word windows provide a conservative lower bound, not a paraphrase estimate.
export function verifiedWordRanges(chunk, page, offset, exclude = () => false) {
    const normalize = (word) => word.toLowerCase().replace(/[^\p{L}\p{N}'’-]/gu, "");
    const source = chunk.trim().split(/\s+/).map(normalize);
    const candidate = page.trim().split(/\s+/).slice(0, 20000).map(normalize);
    const windows = new Set();
    for (let i = 0; i <= candidate.length - 9; i++) {
        const words = candidate.slice(i, i + 9);
        if (words.every(Boolean))
            windows.add(words.join(" "));
    }
    const ranges = [];
    for (let i = 0; i <= source.length - 9; i++) {
        const phrase = source.slice(i, i + 9).join(" ");
        if (windows.has(phrase) && !exclude(phrase))
            ranges.push({ start: offset + i, end: offset + i + 9 });
    }
    return mergeWordRanges(ranges);
}
export function mergeWordRanges(ranges) {
    const merged = [];
    for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
        const last = merged.at(-1);
        if (last && range.start <= last.end)
            last.end = Math.max(last.end, range.end);
        else
            merged.push({ ...range });
    }
    return merged;
}
export function documentMatchCoverage(matches, wordCount) {
    const ranges = matches.filter(m => m.confidence === "page").flatMap(m => m.matchedWordRanges ?? [])
        .filter(r => Number.isInteger(r.start) && Number.isInteger(r.end) && r.start >= 0 && r.end > r.start && r.start < wordCount)
        .map(r => ({ start: r.start, end: Math.min(r.end, wordCount) }));
    const matchedWords = mergeWordRanges(ranges).reduce((sum, r) => sum + r.end - r.start, 0);
    return { matchedWords, percent: wordCount > 0 ? Math.round(matchedWords / wordCount * 1000) / 10 : 0 };
}
