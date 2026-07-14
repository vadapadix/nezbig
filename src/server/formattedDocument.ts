import { load, type CheerioAPI } from "cheerio";
import type { AnyNode, Element, Text } from "domhandler";
import { alignParagraphs, distributeRevisedText } from "./textAlignment.js";

const BLOCK_SELECTOR = "p,h1,h2,h3,h4,h5,h6,li,td,th,blockquote,pre,div";

function textNodesOf(element: AnyNode): Text[] {
  const textNodes: Text[] = [];

  function visit(node: AnyNode): void {
    if (node.type === "text") {
      textNodes.push(node);
      return;
    }
    if ("children" in node) {
      for (const child of node.children) visit(child);
    }
  }

  visit(element);
  return textNodes;
}

function replaceElementText($: CheerioAPI, element: Element, revisedText: string): void {
  const nodes = textNodesOf(element);
  if (nodes.length === 0) {
    $(element).text(revisedText);
    return;
  }

  const values = distributeRevisedText(nodes.map((node) => node.data), revisedText);
  nodes.forEach((node, index) => {
    node.data = values[index];
  });
}

export function mergeRevisedTextIntoHtml(originalHtml: string, revisedText: string): string {
  if (!originalHtml.trim()) return "";
  const $ = load(originalHtml, null, false);
  const candidates = $(BLOCK_SELECTOR).toArray();
  const blocks = candidates.filter((element) => $(element).find(BLOCK_SELECTOR).length === 0);
  const effectiveBlocks = blocks.length > 0 ? blocks : $.root().children().toArray();
  if (effectiveBlocks.length === 0) return originalHtml;

  const originalParagraphs = effectiveBlocks.map((element) => $(element).text().replace(/\s+/g, " ").trim());
  const revisedParagraphs = revisedText.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const aligned = alignParagraphs(originalParagraphs, revisedParagraphs);
  effectiveBlocks.forEach((element, index) => replaceElementText($, element, aligned[index] ?? ""));
  return $.root().html() ?? originalHtml;
}
