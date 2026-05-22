import { describe, expect, it } from "vitest";
import { decodeUploadFileName } from "./textExtraction.js";

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
