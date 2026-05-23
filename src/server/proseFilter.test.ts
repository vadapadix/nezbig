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

  it("removes VBA-style code residue from prose extraction", () => {
    const result = filterProseText(`
      У навчальній версії передбачено авторизацію користувача та перевірку ролей.
      End Sub Private Sub Login_Click() Public Function ValidateUser() End Function
      Подальший опис стосується структури бази даних та сценаріїв роботи системи.
    `);

    expect(result.text.toLowerCase()).not.toContain("end sub");
    expect(result.text.toLowerCase()).not.toContain("private sub");
    expect(result.text.toLowerCase()).not.toContain("public function");
    expect(result.text).toContain("авторизацію користувача");
    expect(result.text).toContain("структури бази даних");
  });
});
