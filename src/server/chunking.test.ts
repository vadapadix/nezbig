import { describe, expect, it } from "vitest";
import { chunkText } from "./chunking.js";

describe("chunkText", () => {
  it("covers the full text when no explicit chunk cap is provided", () => {
    const text = Array.from({ length: 420 }, (_, index) => `слово${index}`).join(" ");
    const chunks = chunkText(text, 100, 20);

    expect(chunks.length).toBeGreaterThan(4);
    expect(chunks.at(-1)?.text).toContain("слово419");
  });
});
