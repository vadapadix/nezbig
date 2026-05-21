import { describe, expect, it } from "vitest";
import { detectAiSignals, scoreCandidate } from "./scoring.js";

describe("scoreCandidate", () => {
  it("gives a high score to overlapping source pages", () => {
    const source = "Academic integrity depends on careful citation, transparent research methods, and original synthesis across multiple sources.";
    const candidate = {
      title: "Academic Integrity Guide",
      url: "https://example.com",
      snippet: "Academic integrity depends on careful citation and transparent research methods in student writing.",
      sourceText:
        "Academic integrity depends on careful citation, transparent research methods, and original synthesis across multiple sources. Student writing should show careful citation, transparent research methods, and original synthesis."
    };

    const result = scoreCandidate(source, candidate, 0);

    expect(result.score).toBeGreaterThan(55);
    expect(result.confidence).toBe("page");
    expect(result.ngramOverlapPercent).toBeGreaterThan(25);
  });
});

describe("detectAiSignals", () => {
  it("returns bounded probabilities with expanded evidence", () => {
    const result = detectAiSignals("This paragraph is short. This paragraph is direct. This paragraph is balanced. Therefore, it may appear uniform.");

    expect(result.probability).toBeGreaterThanOrEqual(0);
    expect(result.probability).toBeLessThanOrEqual(100);
    expect(result.signals.length).toBeGreaterThanOrEqual(4);
    expect(result.signals.some((signal) => signal.label === "Запобіжники від false positive")).toBe(true);
  });

  it("does not treat lorem ipsum as generated prose", () => {
    const result = detectAiSignals("Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse potenti. Donec sed lorem enim. Nulla consequat auctor cursus.");

    expect(result.probability).toBeLessThanOrEqual(12);
    expect(result.signals.at(-1)?.evidence?.join(" ")).toMatch(/lorem ipsum|шаблонний/i);
  });

  it("raises the score for clustered AI writing patterns", () => {
    const result = detectAiSignals(
      "In today's fast-paced world, it is important to note that organizations must leverage innovative solutions to unlock their full potential. Moreover, this comprehensive approach serves as a testament to a crucial commitment to optimization. Furthermore, it is not just about efficiency, it is about transforming the entire landscape. In conclusion, this marks a pivotal step forward."
    );

    expect(result.probability).toBeGreaterThan(45);
    expect(result.signals.some((signal) => signal.evidence && signal.evidence.length > 0)).toBe(true);
  });

  it("discounts citation-heavy academic prose", () => {
    const result = detectAiSignals(
      "У дослідженні Іваненка (2021) описано 42 випадки використання відкритих даних у громадах. За даними Державної служби статистики, у 2022 році частка електронних звернень становила 31%. У цій роботі я порівнюю ці результати з даними опитування 2023 року [1]."
    );

    expect(result.probability).toBeLessThan(38);
  });
});
