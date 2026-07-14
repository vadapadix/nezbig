import JSZip from "jszip";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { mergeRevisedTextIntoDocx } from "./formattedDocx.js";

function textRuns(xml: string): string[] {
  const $ = load(xml, { xml: true }, false);
  return $("w\\:t").map((_index, element) => $(element).text()).get();
}

async function sourceDocx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types />");
  zip.file("word/styles.xml", '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:styleId="Title" /></w:styles>');
  zip.file("word/media/image1.png", Buffer.from([1, 2, 3, 4]));
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Назва роботи</w:t></w:r></w:p>
        <w:p><w:r><w:t>Це важливий текст.</w:t></w:r></w:p>
        <w:tbl><w:tr><w:tc><w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Комірка таблиці</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
      </w:body>
    </w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("mergeRevisedTextIntoDocx", () => {
  it("replaces authored text while retaining the original OOXML package and run formatting", async () => {
    const revised = "Назва роботи\n\nЦе головний текст.\n\nОновлена комірка таблиці";
    const output = await mergeRevisedTextIntoDocx(await sourceDocx(), revised);
    const zip = await JSZip.loadAsync(output);
    const documentXml = await zip.file("word/document.xml")!.async("string");

    expect(output.subarray(0, 2).toString()).toBe("PK");
    expect(textRuns(documentXml)).toContain("Це головний текст.");
    expect(textRuns(documentXml)).toContain("Оновлена комірка таблиці");
    expect(documentXml).toContain("<w:b/>");
    expect(documentXml).toContain("<w:i/>");
    expect(documentXml).toContain('w:val="center"');
    expect(await zip.file("word/styles.xml")!.async("string")).toContain('w:styleId="Title"');
    expect(Array.from(await zip.file("word/media/image1.png")!.async("uint8array"))).toEqual([1, 2, 3, 4]);
  });

  it("preserves leading and trailing spaces through xml:space", async () => {
    const output = await mergeRevisedTextIntoDocx(await sourceDocx(), " Назва роботи \n\nЦе текст.\n\nКомірка");
    const zip = await JSZip.loadAsync(output);
    const documentXml = await zip.file("word/document.xml")!.async("string");

    expect(documentXml).toContain('xml:space="preserve"');
    expect(textRuns(documentXml)).toContain(" Назва роботи ");
  });

  it("escapes XML control characters in revised text", async () => {
    const output = await mergeRevisedTextIntoDocx(await sourceDocx(), "Назва & робота\n\nA < B.\n\nКомірка");
    const zip = await JSZip.loadAsync(output);
    const documentXml = await zip.file("word/document.xml")!.async("string");

    expect(documentXml).toContain("&amp;");
    expect(documentXml).toContain("A &lt; B.");
    expect(textRuns(documentXml)).toEqual(["Назва & робота", "A < B.", "Комірка"]);
  });
});
