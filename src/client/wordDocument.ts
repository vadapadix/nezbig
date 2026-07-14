function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function wordFileName(sourceName: string): string {
  const base = sourceName.replace(/\.[^.]+$/, "").trim() || "nezbig-document";
  return `${base}-formatted.doc`;
}

export function revisedDocxFileName(sourceName: string): string {
  const base = sourceName.replace(/\.[^.]+$/, "").trim() || "nezbig-document";
  return `${base}-edited.docx`;
}

export function createWordDocumentHtml(fragment: string, title: string): string {
  return `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="ProgId" content="Word.Document">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 2cm; }
    body { color: #000; background: #fff; }
    table { border-collapse: collapse; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>${fragment}</body>
</html>`;
}

export function createWordClipboardHtml(fragment: string): string {
  return createWordDocumentHtml(`<!--StartFragment-->${fragment}<!--EndFragment-->`, "Незбіг");
}

export function downloadWordDocument(fragment: string, sourceName: string): void {
  const html = createWordDocumentHtml(fragment, sourceName.replace(/\.[^.]+$/, ""));
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = wordFileName(sourceName);
  link.click();
  URL.revokeObjectURL(url);
}
