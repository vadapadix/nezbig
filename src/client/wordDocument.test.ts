import { describe, expect, it } from "vitest";
import { createWordDocumentHtml, revisedDocxFileName, wordFileName } from "./wordDocument";

describe("Word document export", () => {
  it("wraps the formatted fragment in a Word-compatible UTF-8 document", () => {
    const html = createWordDocumentHtml('<p style="text-align:center"><strong>Назва</strong></p>', "Курсова робота");

    expect(html).toContain('xmlns:o="urn:schemas-microsoft-com:office:office"');
    expect(html).toContain('charset="utf-8"');
    expect(html).toContain("Курсова робота");
    expect(html).toContain('<p style="text-align:center"><strong>Назва</strong></p>');
  });

  it("uses a safe .doc name without duplicating the source extension", () => {
    expect(wordFileName("Курсова робота.docx")).toBe("Курсова робота-formatted.doc");
  });

  it("keeps a real DOCX extension for an edited uploaded document", () => {
    expect(revisedDocxFileName("Курсова робота.docx")).toBe("Курсова робота-edited.docx");
  });
});
