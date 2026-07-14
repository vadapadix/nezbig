import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { decodeUploadFileName, extractTextFromUpload, normalizeExtractedText } from "./textExtraction.js";

async function formattedDocxBuffer(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:pPr><w:jc w:val="center"/><w:ind w:left="720" w:firstLine="360"/></w:pPr>
          <w:r><w:rPr><w:b/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="28"/></w:rPr><w:t>Назва роботи</w:t></w:r>
        </w:p>
        <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Комірка таблиці</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
        <w:sectPr/>
      </w:body>
    </w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

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

describe("extractTextFromUpload", () => {
  it("returns analysis text and a separately formatted Word preview", async () => {
    const buffer = await formattedDocxBuffer();
    const result = await extractTextFromUpload({
      buffer,
      originalname: "Курсова.docx",
      mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: buffer.length
    } as Express.Multer.File);

    expect(result.text).toContain("Назва роботи");
    expect(result.text).toContain("Комірка таблиці");
    expect(result.html).toContain("text-align:center");
    expect(result.html).toContain("margin-left:36pt");
    expect(result.html).toContain("text-indent:18pt");
    expect(result.html).toContain('font-family:&quot;Times New Roman&quot;');
    expect(result.html).toContain("font-size:14pt");
    expect(result.html).toContain("<strong>Назва роботи</strong>");
    expect(result.html).toContain("<table>");
  });
});
