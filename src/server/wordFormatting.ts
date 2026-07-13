type WordElement = {
  type?: string;
  children?: WordElement[];
  styleId?: string | null;
  styleName?: string | null;
  alignment?: string | null;
  indent?: {
    start?: string | null;
    end?: string | null;
    firstLine?: string | null;
    hanging?: string | null;
  };
  numbering?: unknown;
  font?: string | null;
  fontSize?: number | null;
  [key: string]: unknown;
};

export type WordHtmlOptions = {
  styleMap: string[];
  ignoreEmptyParagraphs: false;
  transformDocument: (element: WordElement) => WordElement;
  generatedStyles: Map<string, string>;
};

const ALIGNMENTS = new Set(["left", "right", "center", "both", "justify"]);

function twipsToPoints(value: string | null | undefined): number | null {
  if (!value || !/^-?\d+(?:\.\d+)?$/.test(value)) return null;
  const points = Number(value) / 20;
  return Number.isFinite(points) && Math.abs(points) <= 1440 ? Math.round(points * 100) / 100 : null;
}

function safeFontFamily(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/["']/g, "");
  return cleaned && /^[\p{L}\p{N} .,_-]{1,80}$/u.test(cleaned) ? cleaned : null;
}

function headingTag(element: WordElement): string {
  const style = `${element.styleId ?? ""} ${element.styleName ?? ""}`;
  const match = style.match(/heading\s*([1-6])/i);
  return match ? `h${match[1]}` : "p";
}

function paragraphDeclarations(element: WordElement): string[] {
  const declarations: string[] = [];
  const alignment = element.alignment?.toLowerCase();
  if (alignment && ALIGNMENTS.has(alignment)) {
    declarations.push(`text-align:${alignment === "both" ? "justify" : alignment}`);
  }

  const start = twipsToPoints(element.indent?.start);
  const end = twipsToPoints(element.indent?.end);
  const firstLine = twipsToPoints(element.indent?.firstLine);
  const hanging = twipsToPoints(element.indent?.hanging);
  if (start !== null) declarations.push(`margin-left:${start}pt`);
  if (end !== null) declarations.push(`margin-right:${end}pt`);
  if (firstLine !== null) declarations.push(`text-indent:${firstLine}pt`);
  else if (hanging !== null) declarations.push(`text-indent:${-Math.abs(hanging)}pt`);
  return declarations;
}

function runDeclarations(element: WordElement): string[] {
  const declarations: string[] = [];
  const font = safeFontFamily(element.font);
  if (font) declarations.push(`font-family:&quot;${font}&quot;`);
  if (typeof element.fontSize === "number" && element.fontSize >= 4 && element.fontSize <= 96) {
    declarations.push(`font-size:${Math.round(element.fontSize * 10) / 10}pt`);
  }
  return declarations;
}

export function createWordHtmlOptions(): WordHtmlOptions {
  const styleMap = [
    "u => u",
    "strike => s",
    "all-caps => span.nezbig-word-all-caps",
    "small-caps => span.nezbig-word-small-caps",
    "highlight => span.nezbig-word-highlight",
    "br[type='page'] => div.nezbig-word-page-break:fresh",
    "br[type='column'] => div.nezbig-word-column-break:fresh"
  ];
  const generatedStyles = new Map<string, string>([
    ["nezbig-word-all-caps", "text-transform:uppercase"],
    ["nezbig-word-small-caps", "font-variant:small-caps"],
    ["nezbig-word-highlight", "background-color:#ffff00"],
    ["nezbig-word-page-break", "page-break-after:always;break-after:page"],
    ["nezbig-word-column-break", "break-after:column"]
  ]);
  const classesBySignature = new Map<string, string>();

  function classFor(prefix: "Paragraph" | "Run", tag: string, declarations: string[]): string {
    const signature = `${prefix}|${tag}|${declarations.join(";")}`;
    const existing = classesBySignature.get(signature);
    if (existing) return existing;

    const className = `Nezbig${prefix}${classesBySignature.size}`;
    classesBySignature.set(signature, className);
    generatedStyles.set(className, declarations.join(";"));
    styleMap.push(prefix === "Paragraph"
      ? `p.${className} => ${tag}.${className}:fresh`
      : `r.${className} => span.${className}`);
    return className;
  }

  function transformDocument(element: WordElement): WordElement {
    const children = element.children?.map(transformDocument);
    let transformed = children ? { ...element, children } : { ...element };

    if (transformed.type === "paragraph" && !transformed.numbering) {
      const declarations = paragraphDeclarations(transformed);
      if (declarations.length > 0) {
        transformed = { ...transformed, styleId: classFor("Paragraph", headingTag(transformed), declarations) };
      }
    } else if (transformed.type === "run") {
      const declarations = runDeclarations(transformed);
      if (declarations.length > 0) {
        transformed = { ...transformed, styleId: classFor("Run", "span", declarations) };
      }
    }

    return transformed;
  }

  return { styleMap, ignoreEmptyParagraphs: false, transformDocument, generatedStyles };
}

export function withWordFormattingStyles(html: string, options: WordHtmlOptions): string {
  const css = Array.from(options.generatedStyles, ([className, declarations]) => `.${className}{${declarations}}`).join("");
  return css ? `<style>${css}</style>${html}` : html;
}
