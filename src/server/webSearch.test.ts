import { describe, expect, it } from "vitest";
import { buildSearchQueries } from "./webSearch.js";

describe("buildSearchQueries", () => {
  it("selects distinctive exact phrases from across the whole fragment", () => {
    const text = [
      "The introductory paragraph explains ordinary background details for the reader and establishes the context.",
      "A spectrophotometric calibration sequence uses zirconium reference samples to verify measurement drift.",
      "The middle paragraph records observations, disagreements, corrections, and the operator's handwritten notes.",
      "At the end, the archival comparison identifies an unexpected deviation in the nineteenth measurement series."
    ].join(" ");

    const queries = buildSearchQueries(text, true);

    expect(queries.length).toBeGreaterThanOrEqual(4);
    expect(queries.filter((query) => query.startsWith('"')).length).toBeGreaterThanOrEqual(3);
    expect(queries.join(" ")).toMatch(/spectrophotometric|zirconium/i);
    expect(queries.join(" ")).toMatch(/archival|nineteenth/i);
  });

  it("returns no empty or tiny queries", () => {
    expect(buildSearchQueries("short text", false)).toEqual([]);
  });
});
