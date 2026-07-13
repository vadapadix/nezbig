const ALLOWED_TAGS = new Set([
  "P", "BR", "STRONG", "B", "EM", "I", "U", "S", "A", "UL", "OL", "LI",
  "H1", "H2", "H3", "H4", "H5", "H6", "TABLE", "THEAD", "TBODY", "TFOOT",
  "TR", "TD", "TH", "CAPTION", "COLGROUP", "COL", "SPAN", "DIV", "BLOCKQUOTE",
  "SUB", "SUP", "PRE", "CODE", "HR", "IMG"
]);

const DISCARDED_TAGS = new Set(["SCRIPT", "STYLE", "META", "LINK", "OBJECT", "EMBED", "IFRAME", "FORM", "INPUT", "BUTTON"]);

const ALLOWED_STYLES = new Set([
  "font-weight", "font-style", "font-size", "font-family", "text-decoration", "text-align",
  "text-indent", "text-transform", "line-height", "letter-spacing", "vertical-align", "white-space",
  "color", "background-color", "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left", "list-style-type",
  "border", "border-top", "border-right", "border-bottom", "border-left", "border-collapse",
  "width", "height", "min-width", "max-width", "page-break-before", "page-break-after", "break-before", "break-after"
]);

export function htmlFromPlainText(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function plainTextFromRichHtml(input: string): string {
  const parser = new DOMParser();
  const document = parser.parseFromString(input, "text/html");
  const blockSelector = "p,h1,h2,h3,h4,h5,h6,li,td,th,blockquote,pre,div";

  function read(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const element = node as HTMLElement;
    if (DISCARDED_TAGS.has(element.tagName)) return "";
    if (element.tagName === "BR") return "\n";
    return Array.from(element.childNodes).map(read).join("");
  }

  const candidates = Array.from(document.body.querySelectorAll<HTMLElement>(blockSelector));
  const blocks = candidates.filter((element) => element.querySelector(blockSelector) === null);
  const raw = blocks.length > 0
    ? blocks.map(read).join("\n\n")
    : Array.from(document.body.childNodes).map(read).join("");

  return raw
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseAllowedDeclarations(cssText: string): Map<string, string> {
  const declarations = new Map<string, string>();
  for (const declaration of cssText.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator === -1) continue;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).replace(/!important\s*$/i, "").trim();
    if (ALLOWED_STYLES.has(property) && value && !/expression\s*\(|javascript:/i.test(value)) {
      declarations.set(property, value);
    }
  }
  return declarations;
}

function inlineWordClassStyles(document: Document): void {
  const rulesByClass = new Map<string, Map<string, string>>();
  const css = Array.from(document.querySelectorAll("style")).map((style) => style.textContent ?? "").join("\n");
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = rulePattern.exec(css)) !== null) {
    const declarations = parseAllowedDeclarations(match[2]);
    if (declarations.size === 0) continue;
    for (const selector of match[1].split(",")) {
      const classMatch = selector.trim().match(/^(?:[a-z][\w-]*)?\.([a-z_][\w-]*)$/i);
      if (!classMatch) continue;
      const current = rulesByClass.get(classMatch[1]) ?? new Map<string, string>();
      for (const [property, value] of declarations) current.set(property, value);
      rulesByClass.set(classMatch[1], current);
    }
  }

  for (const element of Array.from(document.querySelectorAll<HTMLElement>("[class]"))) {
    for (const className of Array.from(element.classList)) {
      const declarations = rulesByClass.get(className);
      if (!declarations) continue;
      for (const [property, value] of declarations) {
        if (!element.style.getPropertyValue(property)) element.style.setProperty(property, value);
      }
    }
  }
}

export function sanitizeRichHtml(input: string): string {
  const parser = new DOMParser();
  const document = parser.parseFromString(input, "text/html");
  inlineWordClassStyles(document);

  function clean(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? "");
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const element = node as HTMLElement;
    if (DISCARDED_TAGS.has(element.tagName)) return null;
    if (!ALLOWED_TAGS.has(element.tagName)) {
      const fragment = document.createDocumentFragment();
      for (const child of Array.from(element.childNodes)) {
        const cleaned = clean(child);
        if (cleaned) fragment.append(cleaned);
      }
      return fragment;
    }

    const output = document.createElement(element.tagName.toLowerCase());
    if (element instanceof HTMLTableCellElement && element.colSpan > 1) output.setAttribute("colspan", String(element.colSpan));
    if (element instanceof HTMLTableCellElement && element.rowSpan > 1) output.setAttribute("rowspan", String(element.rowSpan));
    if (element instanceof HTMLAnchorElement) {
      const href = element.getAttribute("href") ?? "";
      if (/^(https?:|mailto:)/i.test(href)) output.setAttribute("href", href);
    }
    if (element instanceof HTMLOListElement && element.start > 1) output.setAttribute("start", String(element.start));
    if (element instanceof HTMLImageElement) {
      const src = element.getAttribute("src") ?? "";
      if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(src)) output.setAttribute("src", src);
      if (element.alt) output.setAttribute("alt", element.alt);
      if (element.width > 0) output.setAttribute("width", String(element.width));
      if (element.height > 0) output.setAttribute("height", String(element.height));
    }

    for (const property of ALLOWED_STYLES) {
      const value = element.style.getPropertyValue(property);
      if (value && !/expression\s*\(|javascript:/i.test(value)) output.style.setProperty(property, value);
    }

    for (const child of Array.from(element.childNodes)) {
      const cleaned = clean(child);
      if (cleaned) output.append(cleaned);
    }

    return output;
  }

  const fragment = document.createDocumentFragment();
  for (const child of Array.from(document.body.childNodes)) {
    const cleaned = clean(child);
    if (cleaned) fragment.append(cleaned);
  }

  const container = document.createElement("div");
  container.append(fragment);
  return container.innerHTML;
}
