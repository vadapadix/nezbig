import { createWordClipboardHtml } from "./wordDocument";

export type WordCopyMode = "rich" | "plain";

function copyFormattedSelection(html: string): boolean {
  if (!document.body || typeof document.execCommand !== "function") return false;

  const buffer = document.createElement("div");
  buffer.dataset.wordCopyBuffer = "true";
  buffer.contentEditable = "true";
  buffer.setAttribute("aria-hidden", "true");
  buffer.style.position = "fixed";
  buffer.style.left = "-10000px";
  buffer.style.top = "0";
  buffer.innerHTML = html;
  document.body.append(buffer);

  const selection = window.getSelection();
  const savedRanges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
    : [];

  try {
    const range = document.createRange();
    range.selectNodeContents(buffer);
    selection?.removeAllRanges();
    selection?.addRange(range);
    return document.execCommand("copy");
  } finally {
    selection?.removeAllRanges();
    for (const range of savedRanges) selection?.addRange(range);
    buffer.remove();
  }
}

export async function copyRichTextForWord(html: string, plainText: string): Promise<WordCopyMode> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([createWordClipboardHtml(html)], { type: "text/html" }),
          "text/plain": new Blob([plainText], { type: "text/plain" })
        })
      ]);
      return "rich";
    } catch {
      // Permissions and browser support vary; the selection path still retains HTML formatting.
    }
  }

  if (copyFormattedSelection(html)) return "rich";
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(plainText);
    return "plain";
  }

  throw new Error("Clipboard API is unavailable.");
}
