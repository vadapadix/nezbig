import { describe, expect, it } from "vitest";
import { humanizeText } from "./humanizer.js";

describe("humanizeText", () => {
  it("removes common English AI writing patterns", () => {
    const result = humanizeText(
      "Great question! This comprehensive system serves as a testament to a crucial and seamless workflow. Furthermore, it is important to note that users can achieve robust outcomes. I hope this helps!"
    );

    expect(result.revisedText.toLowerCase()).not.toContain("great question");
    expect(result.revisedText.toLowerCase()).not.toContain("i hope this helps");
    expect(result.revisedText.toLowerCase()).not.toContain("serves as");
    expect(result.revisedText.toLowerCase()).not.toContain("it is important to note");
    expect(result.changes.length).toBeGreaterThanOrEqual(3);
  });

  it("softens Ukrainian academic AI templates without deleting meaning", () => {
    const result = humanizeText(
      "Варто зазначити, що комплексний підхід забезпечує ефективність роботи системи. На основі проведеного аналізу встановлено, що не лише авторизація є важливою, а й перевірка ролей користувача має практичне значення."
    );

    expect(result.revisedText.toLowerCase()).not.toContain("варто зазначити");
    expect(result.revisedText.toLowerCase()).toContain("аналіз показав");
    expect(result.revisedText.toLowerCase()).toContain("авторизація");
    expect(result.revisedText.toLowerCase()).toContain("перевірка ролей");
  });

  it("rejects text that is too short for reliable editing", () => {
    expect(() => humanizeText("Занадто мало тексту.")).toThrow(/20 слів/);
  });
});
