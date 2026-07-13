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
