import { describe, expect, it } from "vitest";
import { htmlFromPlainText, plainTextFromRichHtml, sanitizeRichHtml } from "./richText";

describe("sanitizeRichHtml", () => {
  it("preserves safe Word formatting and inlines simple Word class styles", () => {
    const wordHtml = `
      <style>
        p.MsoTitle { text-align: center; font-size: 20pt; font-family: "Times New Roman"; }
        .Accent { font-weight: 700; color: #123456; }
      </style>
      <p class="MsoTitle">Назва</p>
      <p>Звичайний <span class="Accent">жирний текст</span></p>
      <ol start="3"><li>Пункт</li></ol>
    `;

    const result = sanitizeRichHtml(wordHtml);
    const container = document.createElement("div");
    container.innerHTML = result;

    const title = container.querySelector("p");
    const accent = container.querySelector("span");
    expect(title?.style.textAlign).toBe("center");
    expect(title?.style.fontSize).toBe("20pt");
    expect(title?.style.fontFamily).toContain("Times New Roman");
    expect(accent?.style.fontWeight).toBe("700");
    expect(accent?.style.color).toBe("rgb(18, 52, 86)");
    expect(container.querySelector("ol")?.start).toBe(3);
  });

  it("removes executable markup while retaining tables and inline emphasis", () => {
    const result = sanitizeRichHtml('<script>alert(1)</script><table onclick="alert(2)"><tr><td><strong>Дані</strong></td></tr></table>');

    expect(result).not.toContain("script");
    expect(result).not.toContain("onclick");
    expect(result).toContain("<table>");
    expect(result).toContain("<strong>Дані</strong>");
  });

  it("keeps Word paragraph geometry and inline typography", () => {
    const result = sanitizeRichHtml(`
      <style>
        p.MsoNormal { margin: 0 0 8pt 36pt; text-indent: 18pt; text-align: justify; line-height: 1.5; }
        span.WordRun { font-family: "Times New Roman"; font-size: 14pt; text-decoration: underline; }
      </style>
      <p class="MsoNormal"><span class="WordRun">Форматований абзац</span></p>
    `);

    const container = document.createElement("div");
    container.innerHTML = result;
    const paragraph = container.querySelector("p");
    const run = container.querySelector("span");

    expect(paragraph?.style.marginLeft).toBe("36pt");
    expect(paragraph?.style.textIndent).toBe("18pt");
    expect(paragraph?.style.textAlign).toBe("justify");
    expect(paragraph?.style.lineHeight).toBe("1.5");
    expect(run?.style.fontFamily).toContain("Times New Roman");
    expect(run?.style.fontSize).toBe("14pt");
    expect(run?.style.textDecoration).toContain("underline");
  });

  it("keeps safe Word round-trip metadata used by lists and pagination", () => {
    const result = sanitizeRichHtml(`
      <style>
        p.MsoListParagraph { margin-left: 36pt; mso-list: l0 level1 lfo1; mso-pagination: widow-orphan; }
      </style>
      <p class="MsoListParagraph" style="mso-outline-level: 2">Пункт списку</p>
    `);

    const container = document.createElement("div");
    container.innerHTML = result;
    const paragraph = container.querySelector("p");

    expect(paragraph?.classList.contains("MsoListParagraph")).toBe(true);
    expect(paragraph?.style.marginLeft).toBe("36pt");
    expect(paragraph?.getAttribute("style")).toContain("mso-list:l0 level1 lfo1");
    expect(paragraph?.getAttribute("style")).toContain("mso-pagination:widow-orphan");
    expect(paragraph?.getAttribute("style")).toContain("mso-outline-level:2");
  });

  it("preserves Word bookmarks and footnote links without allowing unsafe URLs", () => {
    const result = sanitizeRichHtml(`
      <h2 id="_Toc123">Розділ</h2>
      <p>Текст<a href="#_ftn1" id="_ftnref1"><sup>1</sup></a></p>
      <ol><li id="_ftn1"><a href="#_ftnref1">1</a> Примітка</li></ol>
      <a href="javascript:alert(1)">Небезпечно</a>
    `);

    expect(result).toContain('id="_Toc123"');
    expect(result).toContain('href="#_ftn1"');
    expect(result).toContain('id="_ftnref1"');
    expect(result).toContain('id="_ftn1"');
    expect(result).not.toContain("javascript:");
  });

  it("keeps Word document defaults and table geometry from a full clipboard document", () => {
    const result = sanitizeRichHtml(`
      <html>
        <head>
          <style>
            .WordSection1 { font-family: "Times New Roman"; font-size: 14pt; line-height: 1.5; }
          </style>
        </head>
        <body class="WordSection1">
          <p>Основний текст</p>
          <table width="100%" cellspacing="0" cellpadding="6" border="1">
            <colgroup><col span="2" width="120"></colgroup>
            <tr><td width="60%" valign="top">Ліва</td><td width="40%">Права</td></tr>
          </table>
        </body>
      </html>
    `);

    const container = document.createElement("div");
    container.innerHTML = result;
    const root = container.firstElementChild as HTMLElement | null;
    const table = container.querySelector("table");
    const column = container.querySelector("col");
    const cell = container.querySelector("td");

    expect(root?.classList.contains("WordSection1")).toBe(true);
    expect(root?.style.fontFamily).toContain("Times New Roman");
    expect(root?.style.fontSize).toBe("14pt");
    expect(root?.style.lineHeight).toBe("1.5");
    expect(table?.getAttribute("width")).toBe("100%");
    expect(table?.getAttribute("cellspacing")).toBe("0");
    expect(table?.getAttribute("cellpadding")).toBe("6");
    expect(table?.getAttribute("border")).toBe("1");
    expect(column?.getAttribute("span")).toBe("2");
    expect(column?.getAttribute("width")).toBe("120");
    expect(cell?.getAttribute("width")).toBe("60%");
    expect(cell?.getAttribute("valign")).toBe("top");
  });
});

describe("htmlFromPlainText", () => {
  it("escapes plain text and preserves paragraph boundaries", () => {
    expect(htmlFromPlainText("Один < два\n\nДругий")).toBe("<p>Один &lt; два</p><p>Другий</p>");
  });

  it("reconstructs paragraph boundaries from formatted HTML", () => {
    expect(plainTextFromRichHtml("<h1>Назва</h1><p>Перший <strong>абзац</strong>.</p><ul><li>Пункт</li></ul><table><tr><td>А</td><td>Б</td></tr></table>"))
      .toBe("Назва\n\nПерший абзац.\n\nПункт\n\nА\n\nБ");
  });
});
