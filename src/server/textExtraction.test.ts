import { describe, expect, it } from "vitest";
import { decodeUploadFileName, normalizeExtractedText } from "./textExtraction.js";

describe("decodeUploadFileName", () => {
  it("repairs latin1-decoded Cyrillic file names from multipart uploads", () => {
    const original = "Перевірка унікальності.docx";
    const mojibake = Buffer.from(original, "utf8").toString("latin1");

    expect(decodeUploadFileName(mojibake)).toBe(original);
  });

  it("keeps normal ascii file names unchanged", () => {
    expect(decodeUploadFileName("paper.docx")).toBe("paper.docx");
  });
});

describe("normalizeExtractedText", () => {
  it("keeps Word paragraph boundaries while normalizing line noise", () => {
    expect(normalizeExtractedText("  Назва\r\n\r\n  Перший   абзац.\r\n\r\n\r\nДругий.  "))
      .toBe("Назва\n\nПерший абзац.\n\nДругий.");
  });
});
