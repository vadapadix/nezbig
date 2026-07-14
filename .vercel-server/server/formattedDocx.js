import { load } from "cheerio";
import JSZip from "jszip";
import { alignParagraphs, distributeRevisedText } from "./textAlignment.js";
const DOCUMENT_XML_PATH = "word/document.xml";
function wordElements($, name, root) {
    const selector = name.replace(":", "\\:");
    const nodes = root ? $(root).find(selector).toArray() : $(selector).toArray();
    return nodes.filter((node) => node.type === "tag");
}
function paragraphText($, paragraph) {
    return wordElements($, "w:t", paragraph).map((element) => $(element).text()).join("");
}
function splitRevisedParagraphs(value) {
    return value
        .replace(/\r\n?/g, "\n")
        .split(/\n{2,}/)
        .filter((paragraph) => paragraph.trim().length > 0);
}
function replaceParagraphText($, paragraph, revisedText) {
    const runs = wordElements($, "w:t", paragraph);
    if (runs.length === 0)
        return;
    const values = distributeRevisedText(runs.map((run) => $(run).text()), revisedText);
    runs.forEach((run, index) => {
        const value = values[index] ?? "";
        $(run).text(value);
        if (/^\s|\s$/u.test(value))
            $(run).attr("xml:space", "preserve");
        else
            $(run).removeAttr("xml:space");
    });
}
export async function mergeRevisedTextIntoDocx(source, revisedText) {
    const zip = await JSZip.loadAsync(source);
    const documentPart = zip.file(DOCUMENT_XML_PATH);
    if (!documentPart)
        throw new Error("DOCX не містить основної частини word/document.xml.");
    const sourceXml = await documentPart.async("string");
    const $ = load(sourceXml, { xml: { decodeEntities: true, encodeEntities: "utf8" } }, false);
    const paragraphs = wordElements($, "w:p").filter((paragraph) => wordElements($, "w:t", paragraph).length > 0);
    const originalParagraphs = paragraphs.map((paragraph) => paragraphText($, paragraph));
    const aligned = alignParagraphs(originalParagraphs, splitRevisedParagraphs(revisedText));
    paragraphs.forEach((paragraph, index) => replaceParagraphText($, paragraph, aligned[index] ?? ""));
    zip.file(DOCUMENT_XML_PATH, $.xml());
    const output = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    return Buffer.from(output);
}
