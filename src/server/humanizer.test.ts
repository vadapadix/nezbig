import { describe, expect, it } from "vitest";
import { humanizeText } from "./humanizer.js";
import { detectAiSignals } from "./scoring.js";

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

  it("removes repeated sentences without erasing factual modality", () => {
    const result = humanizeText(
      "Документ може містити багато позицій для обліку поставок. Документ може містити багато позицій для обліку поставок. Цей важливий комплексний блок може показувати роботу системи. Користувач часто може бути не впевнений у результаті перевірки."
    );

    expect(result.revisedText.toLowerCase()).toContain("може містити");
    expect(result.revisedText.toLowerCase()).toContain("може показувати");
    expect(result.revisedText.toLowerCase()).not.toContain("важливий комплексний");
    expect(result.revisedText.match(/обліку поставок/giu)?.length ?? 0).toBe(1);
    expect(result.changes.some((change) => change.label === "Прибрано повторені речення")).toBe(true);
  });

  it("preserves paragraphs, typographic quotes, and dashes", () => {
    const source = `Перший абзац містить “авторську цитату” — її пунктуацію не можна ламати. Він також пояснює, чому формулювання може бути обережним.

Другий абзац містить щонайменше двадцять слів і продовжує думку без декоративних шаблонів або службових фраз.`;

    const result = humanizeText(source);

    expect(result.revisedText).toContain("\n\n");
    expect(result.revisedText).toContain("“авторську цитату” —");
    expect(result.revisedText).toContain("може бути");
  });

  it("preserves evidence nouns and technical terms instead of cascading synonyms", () => {
    const result = humanizeText(
      "Дослідження показують, що унікальний ідентифікатор забезпечує цілісність запису в інформаційній системі. Дані показують стабільний результат у 24 незалежних вимірюваннях, а ефективний алгоритм зберігає початкову точність обчислень."
    );
    const revised = result.revisedText.toLowerCase();

    expect(revised).not.toContain("ці показують");
    expect(revised).toContain("дані показують");
    expect(revised).toContain("унікальний ідентифікатор");
    expect(revised).toContain("забезпечує цілісність");
    expect(revised).toContain("ефективний алгоритм");
  });

  it("keeps repeated list-like paragraphs that may be valid document structure", () => {
    const repeatedItem = "Однакова назва позиції може бути коректним значенням у різних рядках таблиці документа.";
    const result = humanizeText(`${repeatedItem}\n\n${repeatedItem}\n\nТретій абзац пояснює, чому редактор не повинен видаляти структурно окремі рядки з однаковим текстом.`);

    expect(result.revisedText.match(/Однакова назва позиції/gu)).toHaveLength(2);
  });

  it("targets local AI scoring markers in templated coursework prose", () => {
    const source = `
      Метою роботи є теоретичне обґрунтування та практичний аналіз особливостей функціонування відповідної системи.
      Завданнями роботи є дослідження основних підходів, визначення ключових проблем і формування практичних рекомендацій.
      Актуальність теми полягає у тому, що у роботі розглянуто ключові поняття, проаналізовано наукові джерела та систематизовано підходи.
      У роботі розглянуто структуру таблиць та визначено основні сценарії роботи користувача.
      У роботі розглянуто процес авторизації та забезпечує ефективні сценарії взаємодії.
      На основі проведеного аналізу встановлено, що система не лише зберігає записи, а й оптимізує роботу користувача.
      Отримані результати дозволяють зробити висновок, що запропонований підхід має важливе практичне значення.
    `;

    const before = detectAiSignals(source).probability;
    const result = humanizeText(source);
    const after = detectAiSignals(result.revisedText).probability;
    const revisedLower = result.revisedText.toLowerCase();

    expect(after).toBeLessThan(before);
    expect(revisedLower).not.toContain("метою роботи є");
    expect(revisedLower).not.toContain("завданнями роботи є");
    expect(revisedLower).not.toContain("у роботі розглянуто");
    expect(revisedLower).not.toContain("на основі проведеного аналізу встановлено");
    expect(revisedLower).not.toContain("практичне значення");
    expect(revisedLower).not.toContain("через тому");
    expect(revisedLower).toContain("тема актуальна через те, що");
    expect(result.changes.some((change) => change.label === "Переписано академічні заготовки")).toBe(true);
  });

  it("rejects text that is too short for reliable editing", () => {
    expect(() => humanizeText("Занадто мало тексту.")).toThrow(/20 слів/);
  });
});
