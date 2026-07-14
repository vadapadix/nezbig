import { countWords, normalizeWhitespace } from "./chunking.js";
const CODE_LINE_PATTERNS = [
    /^\s*(?:import\s+.+\s+from\s+|export\s+(?:default\s+)?(?:function|class|const|let|var)\b)/,
    /^\s*(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*(?:=|:)/,
    /^\s*(?:function\s+[A-Za-z_$][\w$]*\s*\(|class\s+[A-Za-z_$][\w$]*(?:\s+extends\s+[A-Za-z_$][\w$]*)?\s*\{|(?:interface|type|enum)\s+[A-Za-z_$][\w$]*\s*(?:\{|=))/,
    /^\s*(?:return\b|if\s*\(|else\s*\{|for\s*\(|while\s*\(|switch\s*\(|case\s+.+:|try\s*\{|catch\s*\()/,
    /^\s*(?:(?:public|private|protected)\s+(?:async\s+)?[A-Za-z_$][\w$]*\s*(?:\(|:|=)|def\s+[A-Za-z_][\w]*\s*\(|from\s+[\w.]+\s+import\s+|(?:package|using|namespace)\s+[\w.]+)/,
    /^\s*(?:end\s+(?:sub|function|with)|(?:private|public)\s+(?:sub|function)\s+\w+|(?:sub|function)\s+\w+\s*\(|dim\s+\w+(?:\s+as\b|\s*=)|set\s+\w+\s*=|call\s+\w+\s*\(|next\b|loop\b)/i,
    /^\s*[{}()[\];,.<>/]*\s*$/,
    /^\s*<\/?[a-z][^>]*>\s*$/i,
    /^\s*["']?[A-Za-z0-9_$-]+["']?\s*:\s*["'{[\d]/,
    /^\s*[.#]?[A-Za-z0-9_-]+\s*\{/
];
const INLINE_CODE_PHRASES = [
    /\b(?:end\s+sub|private\s+sub|public\s+sub|end\s+function|private\s+function|public\s+function)\b/gi,
    /\b(?:console\.log|document\.querySelector|addEventListener|return\s+false|return\s+true)\b/gi,
    /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*(?:=|:\s*(?:string|number|boolean|unknown|object)\b)/g,
    /\bfunction\s+[A-Za-z_$][\w$]*\s*\([^)]{0,80}\)/g,
    /\b(?:class|interface)\s+[A-Za-z_$][\w$]*\s*(?:extends\s+[A-Za-z_$][\w$]*\s*)?\{/g,
    /\btype\s+[A-Za-z_$][\w$]*\s*=/g,
    /\b(?:[a-z_$][\w$]*\.[a-z_$][\w$]*|[a-z]+(?:[A-Z][A-Za-z0-9_$]*)+|[a-z_$][\w$]*_[a-z_$][\w$]*)\s*\([^)]{0,80}\)\s*(?:=>|\{)?/g
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
        const containsHighConfidenceLine = pendingCodeRun.some((line) => /(?:\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=|=>|===|!==|\.\w+\(|^\s*(?:import|export|function|class|def)\b)/.test(line));
        if (pendingCodeRun.length >= 2 || containsHighConfidenceLine) {
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
