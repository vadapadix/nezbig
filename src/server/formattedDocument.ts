import { load, type CheerioAPI } from "cheerio";
import type { AnyNode, Element, Text } from "domhandler";

const BLOCK_SELECTOR = "p,h1,h2,h3,h4,h5,h6,li,td,th,blockquote,pre,div";
const TOKEN_PATTERN = /\s+|[\p{L}\p{M}\p{N}]+(?:['’.-][\p{L}\p{M}\p{N}]+)*|[^\s]/gu;
const MAX_ALIGNMENT_CELLS = 4_000_000;

type FormattedToken = {
  value: string;
  nodeIndex: number;
};

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

function tokenizeTextNodes(nodes: Text[]): FormattedToken[] {
  return nodes.flatMap((node, nodeIndex) =>
    (node.data.match(TOKEN_PATTERN) ?? []).map((value) => ({ value, nodeIndex }))
  );
}

function tokenKind(value: string): "space" | "word" | "punctuation" {
  if (/^\s+$/u.test(value)) return "space";
  if (/^[\p{L}\p{M}\p{N}]/u.test(value)) return "word";
  return "punctuation";
}

function substitutionCost(original: string, revised: string): number {
  if (original === revised || (tokenKind(original) === "space" && tokenKind(revised) === "space")) return 0;
  return tokenKind(original) === tokenKind(revised) ? 1 : 2;
}

function proportionalNodeMap(original: FormattedToken[], revised: string[]): number[] {
  const nodeIndexes = original.map((token) => token.nodeIndex);
  if (nodeIndexes.length === 0) return revised.map(() => 0);
  return revised.map((_token, index) => nodeIndexes[Math.min(nodeIndexes.length - 1, Math.floor((index / Math.max(1, revised.length)) * nodeIndexes.length))]);
}

function alignTokensToNodes(original: FormattedToken[], revised: string[]): number[] {
  const rows = original.length + 1;
  const columns = revised.length + 1;
  if (rows * columns > MAX_ALIGNMENT_CELLS) return proportionalNodeMap(original, revised);

  const directions = new Uint8Array(rows * columns);
  let previous = new Uint32Array(columns);
  let current = new Uint32Array(columns);
  for (let column = 1; column < columns; column += 1) {
    previous[column] = column;
    directions[column] = 3;
  }

  for (let row = 1; row < rows; row += 1) {
    current[0] = row;
    directions[row * columns] = 2;
    for (let column = 1; column < columns; column += 1) {
      const diagonal = previous[column - 1] + substitutionCost(original[row - 1].value, revised[column - 1]);
      const deletion = previous[column] + 1;
      const insertion = current[column - 1] + 1;
      const offset = row * columns + column;
      if (diagonal <= deletion && diagonal <= insertion) {
        current[column] = diagonal;
        directions[offset] = 1;
      } else if (deletion <= insertion) {
        current[column] = deletion;
        directions[offset] = 2;
      } else {
        current[column] = insertion;
        directions[offset] = 3;
      }
    }
    [previous, current] = [current, previous];
  }

  const mapped = new Array<number>(revised.length).fill(-1);
  let row = original.length;
  let column = revised.length;
  while (row > 0 || column > 0) {
    const direction = directions[row * columns + column];
    if (direction === 1) {
      mapped[column - 1] = original[row - 1].nodeIndex;
      row -= 1;
      column -= 1;
    } else if (direction === 2) {
      row -= 1;
    } else {
      column -= 1;
    }
  }

  let previousNode = -1;
  for (let index = 0; index < mapped.length; index += 1) {
    if (mapped[index] >= 0) previousNode = mapped[index];
    else if (previousNode >= 0) mapped[index] = previousNode;
  }
  let nextNode = original.at(-1)?.nodeIndex ?? 0;
  for (let index = mapped.length - 1; index >= 0; index -= 1) {
    if (mapped[index] >= 0) nextNode = mapped[index];
    else mapped[index] = nextNode;
  }
  return mapped;
}

function replaceElementText($: CheerioAPI, element: Element, revisedText: string): void {
  const nodes = textNodesOf(element);
  if (nodes.length === 0) {
    $(element).text(revisedText);
    return;
  }

  const originalTokens = tokenizeTextNodes(nodes);
  const revisedTokens = revisedText.match(TOKEN_PATTERN) ?? [];
  const nodeMap = alignTokensToNodes(originalTokens, revisedTokens);
  const values = nodes.map(() => "");
  for (let index = 0; index < revisedTokens.length; index += 1) {
    values[nodeMap[index] ?? 0] += revisedTokens[index];
  }
  nodes.forEach((node, index) => {
    node.data = values[index];
  });
}

function paragraphWords(value: string): Set<string> {
  return new Set((value.toLocaleLowerCase("uk-UA").match(/[\p{L}\p{N}]{2,}/gu) ?? []));
}

function paragraphSimilarity(left: string, right: string): number {
  const leftWords = paragraphWords(left);
  const rightWords = paragraphWords(right);
  if (leftWords.size === 0 || rightWords.size === 0) return 0;
  let overlap = 0;
  for (const word of leftWords) if (rightWords.has(word)) overlap += 1;
  return overlap / Math.max(leftWords.size, rightWords.size);
}

function alignParagraphs(original: string[], revised: string[]): string[] {
  if (original.length === revised.length) return revised;
  const rows = original.length + 1;
  const columns = revised.length + 1;
  const costs = Array.from({ length: rows }, () => new Float64Array(columns));
  const directions = new Uint8Array(rows * columns);
  for (let row = 1; row < rows; row += 1) {
    costs[row][0] = row * 0.65;
    directions[row * columns] = 2;
  }
  for (let column = 1; column < columns; column += 1) {
    costs[0][column] = column * 0.65;
    directions[column] = 3;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const diagonal = costs[row - 1][column - 1] + (1 - paragraphSimilarity(original[row - 1], revised[column - 1]));
      const deletion = costs[row - 1][column] + 0.65;
      const insertion = costs[row][column - 1] + 0.65;
      const offset = row * columns + column;
      if (diagonal <= deletion && diagonal <= insertion) {
        costs[row][column] = diagonal;
        directions[offset] = 1;
      } else if (deletion <= insertion) {
        costs[row][column] = deletion;
        directions[offset] = 2;
      } else {
        costs[row][column] = insertion;
        directions[offset] = 3;
      }
    }
  }

  const aligned = original.map(() => "");
  let row = original.length;
  let column = revised.length;
  while (row > 0 || column > 0) {
    const direction = directions[row * columns + column];
    if (direction === 1) {
      aligned[row - 1] = revised[column - 1];
      row -= 1;
      column -= 1;
    } else if (direction === 2) {
      row -= 1;
    } else {
      const target = Math.max(0, row - 1);
      aligned[target] = aligned[target] ? `${revised[column - 1]}\n${aligned[target]}` : revised[column - 1];
      column -= 1;
    }
  }
  return aligned;
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
