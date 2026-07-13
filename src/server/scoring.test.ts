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

  it("detects a copied passage after unrelated text is inserted around it", () => {
    const source = "The experimental protocol records every calibration step before the sensor readings are compared with the archived baseline measurements.";
    const candidate = {
      title: "Laboratory protocol",
      url: "https://example.com/protocol",
      snippet: "A protocol for calibrated sensor measurements.",
      sourceText: `Background material appears before the copied passage. ${source} Additional commentary and references appear after the copied passage.`
    };

    const result = scoreCandidate(source, candidate, 1);

    expect(result.longestRun).toBeGreaterThanOrEqual(12);
    expect(result.hashOverlapPercent).toBeGreaterThan(45);
    expect(result.score).toBeGreaterThan(55);
  });
});

describe("detectAiSignals", () => {
  it("does not let safeguards erase corroborated AI signals", () => {
    const text = `
      ВСТУП. Актуальність теми зумовлена необхідністю комплексного аналізу сучасних підходів.
      У роботі розглянуто основні аспекти функціонування інформаційної системи та визначено її ключові переваги.
      На основі проведеного аналізу доцільно зазначити, що система не тільки зберігає записи, а й забезпечує ефективні сценарії роботи.
      У роботі проаналізовано структуру таблиць, узагальнено вимоги користувачів та сформовано практичні рекомендації.
      Таблиця 1.1 містить 24 записи, таблиця 1.2 містить 18 записів, а рисунок 2.1 показує схему взаємодії.
      "Довга цитата для імітації академічного фрагмента, який не повинен повністю обнулити оцінку ризику."
      ВИСНОВКИ. Отримані результати дозволяють стверджувати, що запропонований підхід є важливим для подальшого розвитку.
    `.repeat(10);

    const result = detectAiSignals(text);

    expect(result.probability).toBeGreaterThanOrEqual(35);
    expect(result.signals.some((signal) => signal.category === "safeguard")).toBe(true);
  });

  it("keeps a visible floor for a very strong isolated local signal", () => {
    const repeated = Array.from({ length: 90 }, () => "Форма позиції замовлення описує форму позиції поставки та форму позиції замовлення.").join(" ");
    const result = detectAiSignals(`${repeated} Таблиця 1.1 містить 24 записи. Таблиця 1.2 містить 18 записів.`);

    expect(result.probability).toBeGreaterThanOrEqual(38);
  });

  it("returns bounded probabilities with expanded evidence", () => {
    const result = detectAiSignals("This paragraph is short. This paragraph is direct. This paragraph is balanced. Therefore, it may appear uniform.");

    expect(result.probability).toBeGreaterThanOrEqual(0);
    expect(result.probability).toBeLessThanOrEqual(100);
    expect(result.signals.length).toBeGreaterThanOrEqual(3);
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

  it("does not flag course-work structure headings as robotic structure", () => {
    const result = detectAiSignals(
      "ЗМІСТ. ВСТУП. Актуальність теми полягає у дослідженні практичних підходів до академічної доброчесності. РОЗДІЛ 1. Теоретичні засади питання. У цьому розділі наведено огляд джерел, визначено поняття та описано методику аналізу. РОЗДІЛ 2. Практична частина. ВИСНОВКИ. Отримані результати узагальнюють основні положення роботи."
    );

    expect(result.signals.at(-1)?.evidence?.join(" ")).toMatch(/академічна структура/i);
    expect(result.probability).toBeLessThan(50);
  });

  it("does not treat double hyphens as an AI punctuation signal", () => {
    const result = detectAiSignals(
      "Перший аргумент -- це контекст дослідження. Другий аргумент -- це джерельна база. Третій аргумент -- це обмеження методу. Четвертий аргумент -- це практична користь. П'ятий аргумент -- це перевірка висновків. Шостий аргумент -- це повторне читання матеріалу. Сьомий аргумент -- це зіставлення даних. Восьмий аргумент -- це підсумок."
    );
    const punctuationSignal = result.signals.find((signal) => signal.label === "Одноманітна пунктуація");

    expect(punctuationSignal?.score).toBeLessThanOrEqual(28);
    expect(punctuationSignal?.detail).toMatch(/подвійні дефіси/i);
  });

  it("raises risk for templated AI-style coursework prose", () => {
    const result = detectAiSignals(`
      ВСТУП. Актуальність обраної теми зумовлена необхідністю комплексного дослідження сучасних підходів до організації інформаційних процесів.
      Метою роботи є теоретичне обґрунтування та практичний аналіз особливостей функціонування відповідної системи.
      Об'єктом дослідження є процеси управління даними, а предметом дослідження є методи їх оптимізації в умовах цифрової трансформації.
      У роботі розглянуто ключові поняття, проаналізовано наукові джерела, визначено основні проблеми та систематизовано підходи до їх вирішення.
      Варто зазначити, що комплексний підхід дозволяє забезпечити ефективність, послідовність та практичну значущість отриманих результатів.
      На основі проведеного аналізу встановлено, що подальше вдосконалення цієї сфери має важливе значення для підвищення якості управлінських рішень.
      РОЗДІЛ 1. Теоретичні засади дослідження. У цьому розділі узагальнено основні теоретичні положення, охарактеризовано понятійний апарат і запропоновано логіку подальшого аналізу.
      ВИСНОВКИ. Отримані результати дозволяють зробити висновок про доцільність застосування системного підходу.
    `);

    expect(result.probability).toBeGreaterThan(45);
    expect(result.signals.some((signal) => /академічної генерації|Безособова/.test(signal.label))).toBe(true);
  });

  it("keeps localized AI-style sections visible inside a long mixed document", () => {
    const humanSection = Array.from({ length: 8 }, (_, index) =>
      `During interview ${index + 1}, I recorded ${18 + index} observations and compared them with the archived measurements from 2021 [${index + 1}]. The notes include disagreements, corrections, and several unresolved questions that require another visit.`
    ).join(" ");
    const generatedSection = Array.from({ length: 7 }, () =>
      "Moreover, it is important to note that this comprehensive and innovative approach not only enhances efficiency but also unlocks significant potential. Furthermore, the robust framework facilitates seamless optimization and underscores the pivotal role of transformative solutions."
    ).join(" ");

    const result = detectAiSignals(`${humanSection} ${generatedSection} ${humanSection}`);

    expect(result.probability).toBeGreaterThanOrEqual(28);
    expect(result.signals.some((signal) => signal.label === "Сегментна узгодженість AI-ознак")).toBe(true);
    expect(result.signals.find((signal) => signal.label === "Сегментна узгодженість AI-ознак")?.evidence?.length).toBeGreaterThan(1);
  });
});
