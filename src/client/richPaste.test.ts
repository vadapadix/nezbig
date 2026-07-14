import { describe, expect, it } from "vitest";
import { insertRichHtmlAtSelection } from "./richPaste";

describe("insertRichHtmlAtSelection", () => {
  it("inserts sanitized Word formatting at the active caret", () => {
    const editor = document.createElement("div");
    editor.contentEditable = "true";
    editor.innerHTML = "<p>Початок кінець</p>";
    document.body.append(editor);

    const textNode = editor.querySelector("p")?.firstChild;
    expect(textNode).toBeTruthy();
    const range = document.createRange();
    range.setStart(textNode!, 8);
    range.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    insertRichHtmlAtSelection(editor, '<span style="font-family:Times New Roman;font-size:14pt;font-weight:700">Word </span>');

    const inserted = editor.querySelector("span");
    expect(inserted?.textContent).toBe("Word ");
    expect(inserted?.style.fontFamily).toContain("Times New Roman");
    expect(inserted?.style.fontSize).toBe("14pt");
    expect(inserted?.style.fontWeight).toBe("700");
    expect(editor.textContent).toBe("Початок Word кінець");
  });

  it("appends content when the browser selection is outside the editor", () => {
    const editor = document.createElement("div");
    editor.innerHTML = "<p>Перший</p>";

    insertRichHtmlAtSelection(editor, "<p><em>Другий</em></p>");

    expect(editor.querySelectorAll("p")).toHaveLength(2);
    expect(editor.querySelector("em")?.textContent).toBe("Другий");
  });
});
