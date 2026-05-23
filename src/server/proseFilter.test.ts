import { describe, expect, it } from "vitest";
import { filterProseText } from "./proseFilter.js";

describe("filterProseText", () => {
  it("removes fenced and line-based code while keeping prose", () => {
    const result = filterProseText(`
      У цьому розділі описано архітектуру застосунку та логіку перевірки.

      \`\`\`ts
      export function sum(a: number, b: number) {
        return a + b;
      }
      \`\`\`

      Подальший аналіз стосується користувацького сценарію та обмежень методу.
      const ignored = true;
      if (ignored) {
        console.log("skip");
      }
    `);

    expect(result.text).toContain("архітектуру застосунку");
    expect(result.text).toContain("користувацького сценарію");
    expect(result.text).not.toContain("export function");
    expect(result.text).not.toContain("console.log");
    expect(result.removedCodeWords).toBeGreaterThan(5);
  });
});
