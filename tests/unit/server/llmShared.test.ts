import { afterEach, describe, expect, it, vi } from "vitest";
import { asScore, buildAnalysisSample, extractJsonObject, parseAuthorshipResult, withTimeout } from "../../../src/server/infrastructure/ai/llmShared.js";

describe("asScore", () => {
  it("clamps values into the 0-100 integer range", () => {
    expect(asScore(-5)).toBe(0);
    expect(asScore("88.6")).toBe(89);
    expect(asScore(140)).toBe(100);
    expect(asScore("not a number")).toBe(0);
    expect(asScore(undefined)).toBe(0);
  });
});

describe("extractJsonObject", () => {
  it("parses plain JSON objects", () => {
    expect(extractJsonObject('{"probability": 12}')).toEqual({ probability: 12 });
  });

  it("parses fenced json code blocks", () => {
    const content = 'Ось результат:\n```json\n{"probability": 30}\n```';
    expect(extractJsonObject(content)).toEqual({ probability: 30 });
  });

  it("ignores surrounding prose around the object", () => {
    expect(extractJsonObject('Відповідь: {"probability": 5} дякую')).toEqual({ probability: 5 });
  });

  it("throws when no object is present", () => {
    expect(() => extractJsonObject("жодного JSON тут немає")).toThrow();
  });

  it("throws on truncated objects", () => {
    expect(() => extractJsonObject('{"probability": ')).toThrow();
  });
});

describe("buildAnalysisSample", () => {
  it("returns short texts unchanged", () => {
    const text = "Невеликий текст для аналізу.";
    expect(buildAnalysisSample(text)).toBe(text);
  });

  it("splits long documents into head and tail sections", () => {
    const longText = `${"А".repeat(5000)} ${"Б".repeat(5000)}`;
    const sample = buildAnalysisSample(longText);

    expect(sample).toContain("=== ПОЧАТОК ДОКУМЕНТА ===");
    expect(sample).toContain("=== КІНЕЦЬ ДОКУМЕНТА ===");
    expect(sample.length).toBeLessThan(6000 + 400);
    expect(sample.startsWith("=== ПОЧАТОК")).toBe(true);
  });

  it("includes suspicious excerpts for long documents", () => {
    const longText = "Слово ".repeat(3000);
    const sample = buildAnalysisSample(longText, ["підозрілий фрагмент один", "фрагмент два", "фрагмент три", "зайвий фрагмент"]);

    expect(sample).toContain("НАЙПІДОЗРІЛІШІ ФРАГМЕНТИ");
    expect(sample).toContain("підозрілий фрагмент один");
    expect(sample).toContain("фрагмент три");
    expect(sample).not.toContain("зайвий фрагмент");
  });

  it("keeps short documents without excerpt section", () => {
    const sample = buildAnalysisSample("Короткий текст.", ["фрагмент"]);
    expect(sample).not.toContain("НАЙПІДОЗРІЛІШІ");
  });
});

describe("parseAuthorshipResult", () => {
  it("parses probability and normalized signals", () => {
    const content = JSON.stringify({
      probability: 73.4,
      signals: [
        {
          label: "Однорідність",
          score: "80",
          detail: "Речення рівні.",
          evidence: ["приклад 1", "приклад 2"]
        }
      ]
    });

    const result = parseAuthorshipResult(content, "Fallback", "немає сигналів");
    expect(result.probability).toBe(73);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]).toMatchObject({ label: "Однорідність", score: 80, category: "pattern" });
    expect(result.signals[0]?.evidence).toEqual(["приклад 1", "приклад 2"]);
  });

  it("falls back to a single signal when the model omits them", () => {
    const result = parseAuthorshipResult('{"probability": 25}', "Fallback Label", "Загальна оцінка.");
    expect(result.probability).toBe(25);
    expect(result.signals[0]?.label).toBe("Fallback Label");
    expect(result.signals[0]?.score).toBe(25);
  });

  it("caps evidence lists and label lengths", () => {
    const content = JSON.stringify({
      probability: 10,
      signals: [
        {
          label: "М".repeat(200),
          score: 50,
          detail: "Д".repeat(400),
          evidence: Array.from({ length: 9 }, () => "e")
        }
      ]
    });

    const result = parseAuthorshipResult(content, "F", "E");
    expect(result.signals[0]?.label?.length).toBeLessThanOrEqual(80);
    expect(result.signals[0]?.detail.length).toBeLessThanOrEqual(280);
    expect(result.signals[0]?.evidence).toHaveLength(4);
  });
});

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates an abort signal that fires after the timeout", () => {
    vi.useFakeTimers();
    const signal = withTimeout(50);
    expect(signal.aborted).toBe(false);
    vi.advanceTimersByTime(60);
    expect(signal.aborted).toBe(true);
  });
});
