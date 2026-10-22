import { describe, expect, it } from "vitest";
import { prepareAiAnalysisText } from "../../../src/server/domain/analysis/aiTextPreprocess.js";
import { detectAiSignals } from "../../../src/server/domain/analysis/aiDetection.js";

const contents = "ВСТУП РОЗДІЛ 1: АНАЛІЗ ПРЕДМЕТНОЇ ОБЛАСТІ ТА АВТОМАТИЗАЦІЇ МАГАЗИНУ КАНЦЕЛЯРСЬКИХ ТОВАРІВ 1.1 Аналіз особливостей предметної області та бізнес-процесів магазину 1.2 Аналіз існуючих автоматизованих систем управління торгівлею та складом 1.3 Постановка задачі на розробку інформаційної системи РОЗДІЛ 2: МОДЕЛЮВАННЯ ІНФОРМАЦІЙНИХ ПОТОКІВ 2.1 Опис інформаційних потоків 2.2 Аналіз інформаційних потоків РОЗДІЛ 3: ЛОГІЧНА СТРУКТУРА БАЗИ ДАНИХ ТА ВИБІР ЗАСОБІВ РЕАЛІЗАЦІЇ 3.1 Створення логічної схеми бази даних із застосуванням нормалізації 3.2 Фізична структура таблиць, первинні та зовнішні ключі 3.3 Обґрунтування вибору СУБД для реалізації проєкту";
const schema = "Поле Пов’язана таблиця і поле Тип зв’язку Зміст зв’язку Категорії.ID Категорії Товар.Назва категорії 1:∞ одна категорія об’єднує багато товарів Клієнти.ID Клієнта Замовлення.ID Клієнта 1:∞ один клієнт може мати багато замовлень Співробітники.ID Співробітника Замовлення.ID Співробітника 1:∞ один співробітник може приймати багато замовлень";
const body = "Я перевірив роботу магазину на конкретному замовленні. Покупець вибрав два зошити, але один із них був пошкоджений. Продавчиня замінила товар і перерахувала суму. У журналі залишилися початковий запис та виправлення, тому я зміг відтворити послідовність подій. Другу спробу провів наступного дня. Цього разу виникла інша помилка: склад оновився із затримкою, яку вдалося побачити лише після повторного запиту.";

describe("structural content is not authorship prose", () => {
  it("does not assign an AI verdict to a table of contents alone", () => {
    expect(detectAiSignals(contents).verdict).toBe("insufficient");
    expect(detectAiSignals(contents).suspiciousSegments).toEqual([]);
  });
  it("removes a flattened TOC before the repeated body introduction", () => {
    const result = prepareAiAnalysisText(`${contents} ВСТУП ${body}`);
    expect(result.text).toBe(`ВСТУП ${body}`);
    expect(result.exclusions.structuralWords).toBeGreaterThan(0);
  });
  it("excludes the supplied schema-table pattern without discarding surrounding prose", () => {
    const prepared = prepareAiAnalysisText(`${body}\n\n${schema}\n\n${body}`);
    expect(prepared.text).not.toContain("Категорії.ID");
    expect(prepared.text).toContain("Покупець вибрав");
    expect(prepared.exclusions.structuralWords).toBeGreaterThan(0);
    expect(detectAiSignals(schema).verdict).toBe("insufficient");
  });
  it("keeps ordinary narrative and chapter headings", () => {
    const result = prepareAiAnalysisText(`РОЗДІЛ 1. Опис магазину\n${body}`);
    expect(result.text).toContain(body);
    expect(result.exclusions.structuralWords).toBe(0);
  });
  it("recognizes a relationship table split into paragraphs by a document extractor", () => {
    const rows = schema.replace(/(?=Клієнти\.ID|Співробітники\.ID)/gu, "\n\n");
    const result = prepareAiAnalysisText(`${body}\n\n${rows}\n\n${body}`);
    expect(result.text).not.toContain("Категорії.ID");
    expect(result.text).not.toContain("Співробітники.ID");
    expect(result.text).toContain(body);
  });
  it("does not treat database capability може мати as an uncertain statement", () => {
    const result = detectAiSignals("Один клієнт може мати декілька замовлень. Одне замовлення може містити декілька товарів. Товар може належати до однієї категорії. Співробітник може прийняти замовлення у клієнта.");
    expect(result.signals.find(signal => signal.label === "Обережні формулювання")).toBeUndefined();
  });
});
