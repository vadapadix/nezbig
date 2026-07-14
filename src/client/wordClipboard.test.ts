import { afterEach, describe, expect, it, vi } from "vitest";
import { copyRichTextForWord } from "./wordClipboard";

describe("copyRichTextForWord", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("writes both HTML and plain text through the modern Clipboard API", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const OriginalClipboardItem = globalThis.ClipboardItem;
    class ClipboardItemMock {
      constructor(public readonly items: Record<string, Blob>) {}
    }
    Object.defineProperty(globalThis, "ClipboardItem", { configurable: true, value: ClipboardItemMock });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { write } });

    await expect(copyRichTextForWord("<p><strong>Назва</strong></p>", "Назва")).resolves.toBe("rich");
    expect(write).toHaveBeenCalledTimes(1);
    const item = write.mock.calls[0][0][0] as ClipboardItemMock;
    expect(Object.keys(item.items).sort()).toEqual(["text/html", "text/plain"]);

    Object.defineProperty(globalThis, "ClipboardItem", { configurable: true, value: OriginalClipboardItem });
  });

  it("uses a temporary formatted selection when the modern API is unavailable", async () => {
    Object.defineProperty(globalThis, "ClipboardItem", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });

    await expect(copyRichTextForWord('<p style="text-align:center"><strong>Назва</strong></p>', "Назва")).resolves.toBe("rich");
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("[data-word-copy-buffer]")).toBeNull();
  });
});
