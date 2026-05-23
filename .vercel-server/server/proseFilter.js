import { countWords, normalizeWhitespace } from "./chunking.js";
const CODE_LINE_PATTERNS = [
    /^\s*(import|export|const|let|var|function|class|interface|type|enum|return|if|else|for|while|switch|case|try|catch)\b/,
    /^\s*(public|private|protected|async|await|def|from|package|using|namespace)\b/,
    /^\s*(sub|end\s+sub|private\s+sub|public\s+sub|function|end\s+function|private\s+function|public\s+function|dim|set|call|then|next|loop|with|end\s+with)\b/i,
    /^\s*[{}()[\];,.<>/]*\s*$/,
    /^\s*<\/?[a-z][^>]*>\s*$/i,
    /^\s*["']?[A-Za-z0-9_$-]+["']?\s*:\s*["'{[\d]/,
    /^\s*[.#]?[A-Za-z0-9_-]+\s*\{/
];
const INLINE_CODE_PHRASES = [
    /\b(?:end\s+sub|private\s+sub|public\s+sub|end\s+function|private\s+function|public\s+function)\b/gi,
    /\b(?:console\.log|document\.querySelector|addEventListener|return\s+false|return\s+true)\b/gi,
    /\b(?:const|let|var|function|class|interface|type)\s+[A-Za-z_$][\w$]*\b/g,
    /\b[A-Za-z_$][\w$]*\s*\([^)]{0,80}\)\s*(?:=>|\{)?/g
];
function looksLikeCodeLine(line) {
    const trimmed = line.trim();
    if (!trimmed)
        return false;
    const symbolCount = (trimmed.match(/[{}()[\];=<>`|]/g) ?? []).length;
    const symbolDensity = symbolCount / Math.max(1, trimmed.length);
    const hasCodePattern = CODE_LINE_PATTERNS.some((pattern) => pattern.test(line));
    const hasAssignment = /(?:=>|===|!==|==|!=|\+\+|--|\.\w+\(|:\s*(?:string|number|boolean|unknown|void)\b)/.test(trimmed);
    return hasCodePattern || hasAssignment || (symbolDensity > 0.16 && !/[А-Яа-яІіЇїЄєҐґ]{3,}/.test(trimmed));
}
function stripInlineCodeResidue(text) {
    let removedWords = 0;
    let cleaned = text;
    for (const pattern of INLINE_CODE_PHRASES) {
        cleaned = cleaned.replace(pattern, (match) => {
            removedWords += countWords(match);
            return " ";
        });
    }
    return { text: normalizeWhitespace(cleaned), removedWords };
}
export function filterProseText(rawText) {
    const lines = rawText.replace(/\r\n/g, "\n").split("\n");
    const kept = [];
    const removed = [];
    let inFence = false;
    let removedCodeBlocks = 0;
    let pendingCodeRun = [];
    function flushCodeRun() {
        if (pendingCodeRun.length >= 2) {
            removed.push(...pendingCodeRun);
            removedCodeBlocks += 1;
        }
        else {
            kept.push(...pendingCodeRun);
        }
        pendingCodeRun = [];
    }
    for (const line of lines) {
        if (/^\s*```/.test(line)) {
            flushCodeRun();
            inFence = !inFence;
            if (inFence)
                removedCodeBlocks += 1;
            continue;
        }
        if (inFence) {
            removed.push(line);
            continue;
        }
        if (looksLikeCodeLine(line)) {
            pendingCodeRun.push(line);
            continue;
        }
        flushCodeRun();
        kept.push(line);
    }
    flushCodeRun();
    const inlineCleaned = stripInlineCodeResidue(kept.join(" "));
    const text = inlineCleaned.text;
    const removedCodeWords = countWords(removed.join(" ")) + inlineCleaned.removedWords;
    return {
        text,
        removedCodeWords,
        removedCodeBlocks,
        notes: removedCodeWords > 0 ? [`Код автоматично вилучено з перевірки: ${removedCodeWords} слів у ${removedCodeBlocks} блоках.`] : []
    };
}
