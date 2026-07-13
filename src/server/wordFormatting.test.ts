import { describe, expect, it } from "vitest";
import { createWordHtmlOptions, withWordFormattingStyles } from "./wordFormatting.js";

describe("Word formatting preservation", () => {
  it("maps DOCX paragraph and run properties to safe HTML classes", () => {
    const options = createWordHtmlOptions();
    expect(options.ignoreEmptyParagraphs).toBe(false);
    const transformed = options.transformDocument({
      type: "document",
      children: [{
        type: "paragraph",
        styleId: null,
        styleName: null,
        alignment: "center",
        indent: { start: "720", end: null, firstLine: "360", hanging: null },
        numbering: null,
        children: [{
          type: "run",
          styleId: null,
          styleName: null,
          font: "Times New Roman",
          fontSize: 14,
          children: [{ type: "text", value: "Назва" }]
        }]
      }]
    });

    expect(transformed.children).toHaveLength(1);
    const paragraph = transformed.children![0];
    expect(paragraph.children).toHaveLength(1);
    const run = paragraph.children![0];
    expect(paragraph.styleId).toMatch(/^NezbigParagraph/);
    expect(run.styleId).toMatch(/^NezbigRun/);
    expect(options.styleMap).toContain(`p.${paragraph.styleId} => p.${paragraph.styleId}:fresh`);
    expect(options.styleMap).toContain(`r.${run.styleId} => span.${run.styleId}`);

    const html = withWordFormattingStyles(`<p class="${paragraph.styleId}"><span class="${run.styleId}">Назва</span></p>`, options);
    expect(html).toContain("text-align:center");
    expect(html).toContain("margin-left:36pt");
    expect(html).toContain("text-indent:18pt");
    expect(html).toContain('font-family:&quot;Times New Roman&quot;');
    expect(html).toContain("font-size:14pt");
  });

  it("does not replace numbering metadata while preserving run formatting", () => {
    const options = createWordHtmlOptions();
    const transformed = options.transformDocument({
      type: "document",
      children: [{
        type: "paragraph",
        styleId: null,
        styleName: null,
        alignment: "left",
        indent: { start: "720", end: null, firstLine: null, hanging: "360" },
        numbering: { isOrdered: true, level: "0" },
        children: [{ type: "run", styleId: null, font: "Arial", fontSize: 11, children: [] }]
      }]
    });

    expect(transformed.children).toHaveLength(1);
    const paragraph = transformed.children![0];
    expect(paragraph.styleId).toBeNull();
    expect(paragraph.children).toHaveLength(1);
    expect(paragraph.children![0].styleId).toMatch(/^NezbigRun/);
  });
});
