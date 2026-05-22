import { describe, expect, it } from "vitest";
import { prepareDocumentText } from "./documentPreprocess.js";

describe("prepareDocumentText", () => {
  it("skips course-work title blocks before the introduction", () => {
    const prepared = prepareDocumentText(`
      Міністерство освіти і науки України
      Національний університет
      Кафедра комп'ютерних наук
      Курсова робота
      Виконав студент групи ІПЗ-21
      Керівник доцент кафедри
      Київ 2026

      ВСТУП
      Це основний текст роботи, який має перевірятися на унікальність і збіги у відкритих джерелах.
      Далі йде достатньо слів для того, щоб препроцесор не відкинув корисний вміст документа.
    `);

    expect(prepared.text).toMatch(/^ВСТУП/);
    expect(prepared.skippedTitleWords).toBeGreaterThan(5);
  });
});
