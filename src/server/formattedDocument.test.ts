import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { mergeRevisedTextIntoHtml } from "./formattedDocument.js";

describe("mergeRevisedTextIntoHtml", () => {
  it("keeps Word-like block and inline formatting around revised words", () => {
    const originalHtml = [
      '<h1 style="text-align:center">Назва роботи</h1>',
      '<p>Це <strong>важливий</strong> аспект дослідження.</p>',
      '<ul><li><em>Перший</em> пункт списку</li></ul>',
      '<table><tbody><tr><td>Комірка таблиці</td></tr></tbody></table>'
    ].join("");
    const revisedText = [
      "Назва роботи",
      "Це головний аспект дослідження.",
      "Перший пункт списку",
      "Комірка таблиці"
    ].join("\n\n");

    const revisedHtml = mergeRevisedTextIntoHtml(originalHtml, revisedText);
    const $ = load(revisedHtml, null, false);

    expect($("h1").attr("style")).toContain("text-align:center");
    expect($("strong").text()).toBe("головний");
    expect($("em").text()).toBe("Перший");
    expect($("li").text()).toBe("Перший пункт списку");
    expect($("td").text()).toBe("Комірка таблиці");
  });

  it("keeps the document structure when a duplicate paragraph disappears", () => {
    const originalHtml = "<p>Перший унікальний абзац.</p><p><strong>Повторений абзац.</strong></p><p>Останній абзац.</p>";
    const revisedHtml = mergeRevisedTextIntoHtml(originalHtml, "Перший унікальний абзац.\n\nОстанній абзац.");
    const $ = load(revisedHtml, null, false);

    expect($("p")).toHaveLength(3);
    expect($("p").eq(0).text()).toBe("Перший унікальний абзац.");
    expect($("p").eq(1).text()).toBe("");
    expect($("p").eq(2).text()).toBe("Останній абзац.");
  });
});
