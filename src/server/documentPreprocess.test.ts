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

  it("skips bibliography and literature list from the document body", () => {
    const prepared = prepareDocumentText(`
      ВСТУП
      Це основний текст курсової або дипломної роботи, де детально описано предмет дослідження,
      методи аналізу, архітектуру розробленої системи та результати експериментів. Тут достатньо тексту,
      щоб препроцесор чітко розпізнав основну частину та не сплутав її з бібліографією.

      СПИСОК ВИКОРИСТАНИХ ДЖЕРЕЛ
      1. Бернерс-Лі Т. Розвиток технологій всесвітньої павутини. Київ: Наука, 2020. 250 с.
      2. Юрафскі Д., Мартін Д. Обробка природної мови та аналіз мовлення. Стенфорд, 2024. 640 с.
      3. Vaswani A. Attention is all you need. NeurIPS, 2017. DOI: 10.1016/j.neucom.2017.
    `);

    expect(prepared.skippedBibliographyWords).toBeGreaterThan(15);
    expect(prepared.text).not.toContain("СПИСОК ВИКОРИСТАНИХ ДЖЕРЕЛ");
    expect(prepared.text).not.toContain("Бернерс-Лі Т.");
    expect(prepared.notes.some((note) => note.includes("Список використаних джерел"))).toBe(true);
  });
});
