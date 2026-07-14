import { describe, expect, it } from "vitest";
import { calculateConfirmedPlagiarismScore, detectAiSignals, scoreCandidate, summarizeReport } from "./scoring.js";

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
    expect(result.submittedEvidence).toMatch(/experimental protocol records/i);
    expect(result.sourceEvidence).toMatch(/experimental protocol records/i);
  });

  it("does not turn a search snippet echo into confirmed plagiarism", () => {
    const source = "Academic integrity depends on careful citation transparent methods and original synthesis across several independent sources.";
    const snippetLead = scoreCandidate(source, {
      title: "Search result",
      url: "https://example.com/lead",
      snippet: source
    }, 0);
    const confirmedPage = scoreCandidate(source, {
      title: "Verified source",
      url: "https://example.com/page",
      snippet: "A source about academic integrity.",
      sourceText: `Introductory material. ${source} Additional verified page content.`
    }, 0);

    expect(snippetLead.confidence).toBe("snippet");
    expect(calculateConfirmedPlagiarismScore([snippetLead])).toBe(0);
    expect(calculateConfirmedPlagiarismScore([confirmedPage])).toBeGreaterThan(40);
    expect(summarizeReport(0, 20, [snippetLead])).toMatch(/не підтверджен/i);
  });

  it("does not claim that no sources exist when every web request failed", () => {
    const summary = summarizeReport(0, 20, [], {
      providers: [{ provider: "DuckDuckGo", attempted: 3, succeeded: 0, failed: 3, timedOut: 2, results: 0 }],
      pages: { attempted: 0, verified: 0, unavailable: 0, cacheHits: 0, negativeCacheHits: 0 }
    });

    expect(summary).toMatch(/не завершено|недоступн/i);
    expect(summary).not.toMatch(/не знайдено/i);
  });

  it("keeps the search inconclusive while the only provider circuit is open", () => {
    const summary = summarizeReport(0, 20, [], {
      providers: [
        { provider: "DuckDuckGo", attempted: 0, succeeded: 0, failed: 0, timedOut: 0, results: 0, skippedReason: "тимчасово призупинено після повторних помилок" },
        { provider: "Google", attempted: 0, succeeded: 0, failed: 0, timedOut: 0, results: 0, skippedReason: "не налаштовано API-ключ" }
      ],
      pages: { attempted: 0, verified: 0, unavailable: 0, cacheHits: 0, negativeCacheHits: 0 }
    });

    expect(summary).toMatch(/не завершено|недоступн/i);
    expect(summary).not.toMatch(/не знайдено/i);
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
    expect(result.reliability.level).toBe("low");
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

  it("keeps sentence rhythm stable when coursework headings are added", () => {
    const body = "The archived observations describe a repeatable procedure for collecting measurements. Each participant then reviews the record and explains any disagreement with the result. Researchers compare those comments with the earlier dataset before they accept a conclusion. The final discussion identifies limitations that require another round of field work.";
    const withoutHeadings = detectAiSignals(body);
    const withHeadings = detectAiSignals(`INTRODUCTION. ${body} CONCLUSION.`);
    const rhythm = (result: ReturnType<typeof detectAiSignals>) => result.signals.find((signal) => signal.label === "Рівномірність речень (Low Burstiness)")?.score ?? 0;

    expect(Math.abs(rhythm(withHeadings) - rhythm(withoutHeadings))).toBeLessThanOrEqual(5);
  });

  it("does not let citations and coursework structure force corroborated evidence to zero", () => {
    const result = detectAiSignals(`
      INTRODUCTION. The analysis presents a comprehensive framework for improving the information system in a consistent and efficient manner.
      Moreover, the proposed approach facilitates reliable optimization and provides a structured basis for future development [1].
      The 2024 experiment recorded 42 observations, while Table 2 lists 18 repeated scenarios and three validation stages.
      In conclusion, this robust solution represents an important step toward a seamless and scalable workflow.
    `);

    expect(result.probability).toBeGreaterThan(0);
    expect(result.signals.some((signal) => signal.category === "safeguard")).toBe(true);
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
    expect(result.reliability.segmentCount).toBeGreaterThan(2);
    expect(result.reliability.segmentSpread).toBeGreaterThan(0);
  });

  it("calculates reliability from length and segment agreement", () => {
    const text = Array.from({ length: 14 }, (_, index) =>
      `Interview block ${index + 1} records the same measurement procedure, identifies the observer, lists the archive reference, and explains why the result was accepted after manual verification.`
    ).join(" ");

    const result = detectAiSignals(text);

    expect(result.reliability.segmentCount).toBeGreaterThanOrEqual(2);
    expect(result.reliability.score).toBeGreaterThan(40);
    expect(result.reliability.reason.length).toBeGreaterThan(20);
  });

  it("marks short evidence as insufficient instead of presenting a clean zero", () => {
    const result = detectAiSignals("Коротке речення без достатнього стилометричного контексту.");

    expect(result.verdict).toBe("insufficient");
    expect(result.reliability.level).toBe("low");
  });

  it("reports unsupported-language input as uncertain", () => {
    const text = Array.from({ length: 12 }, () =>
      "Кроме того, необходимо отметить, что данный комплексный подход обеспечивает эффективное развитие системы и позволяет последовательно решать поставленные задачи."
    ).join(" ");
    const result = detectAiSignals(text);

    expect(result.language.code).toBe("limited");
    expect(result.verdict).toBe("uncertain");
    expect(result.reliability.reason).toMatch(/мов|підтрим/i);
  });

  it("does not let embedded source code distort direct AI analysis", () => {
    const prose = Array.from({ length: 10 }, (_, index) =>
      `Під час спостереження ${index + 1} я занотував результати, порівняв їх з архівом і пояснив, чому окремі вимірювання довелося повторити.`
    ).join(" ");
    const code = Array.from({ length: 20 }, (_, index) =>
      `const result${index} = calculateScore(input${index});`
    ).join("\n");
    const clean = detectAiSignals(prose);
    const mixed = detectAiSignals(`${prose}\n${code}`);

    expect(mixed.exclusions.codeWords).toBeGreaterThan(40);
    expect(Math.abs(mixed.probability - clean.probability)).toBeLessThanOrEqual(5);
  });

  it("keeps distributed weak AI evidence visible in a long coursework", () => {
    const text = Array.from({ length: 18 }, (_, index) => `
      РОЗДІЛ ${index + 1}. У роботі розглянуто підхід ${index + 1} до організації інформаційних процесів.
      Варто зазначити, що цей підхід формує послідовну основу для подальшого аналізу та вдосконалення системи.
      Для перевірки використано ${30 + index} записів за ${2010 + (index % 14)} рік, після чого результати узагальнено у таблиці ${index + 1}.
      Отримані результати дозволяють визначити напрями подальшого розвитку та сформувати практичні рекомендації.
    `).join(" ");
    const result = detectAiSignals(text);

    expect(result.probability).toBeGreaterThanOrEqual(12);
    expect(result.verdict).not.toBe("low");
    expect(result.suspiciousSegments.length).toBeGreaterThan(0);
  });

  it("exposes a moderate localized AI island with word coordinates and evidence", () => {
    const human = [
      "I reached the archive before lunch and found three pages missing from the folder, so the first count remains provisional.",
      "Maria remembered the delivery differently. Her notebook lists two boxes, while the warehouse sheet records four separate packages.",
      "Rain interrupted the field visit after twenty minutes, and I wrote the remaining measurements by hand under the station roof.",
      "The oldest receipt had a torn corner. I could read the date but not the surname, which is why that row stays blank.",
      "After comparing both ledgers, we corrected one duplicated payment and left another entry unchanged until the accountant returns.",
      "A participant challenged my interpretation of the question, then explained what she had understood in her own words.",
      "Two sensors disagreed by nearly six degrees. Replacing the battery fixed one device, though the second still drifted overnight.",
      "My first transcription contained a simple mistake: I had swapped the month and day while copying the handwritten date.",
      "The interview ended early because the bus arrived. We scheduled another conversation instead of filling the gap from memory.",
      "Several figures look untidy in the original chart, but that irregularity matches the notes taken during the actual experiment.",
      "I expected the southern plot to be drier. The soil sample proved otherwise, and the result changed the order of the next visits.",
      "One answer does not fit the broader pattern. I kept it because the recording is clear and there is no basis for correcting it."
    ].join(" ");
    const aiIsland = Array.from({ length: 4 }, () =>
      "Moreover, it is important to note that the comprehensive approach facilitates seamless optimization and underscores the pivotal role of innovative solutions in the evolving landscape."
    ).join(" ");
    const result = detectAiSignals(`${human} ${aiIsland} ${human}`);

    expect(result.verdict).toBe("mixed");
    expect(result.suspiciousSegments.some((segment) => segment.score >= 35)).toBe(true);
    expect(result.suspiciousSegments.every((segment) => segment.startWord >= 1 && segment.endWord >= segment.startWord)).toBe(true);
    expect(result.suspiciousSegments.some((segment) => segment.evidence.length > 0)).toBe(true);
  });

  it("excludes long quotations and a bibliography tail from authorship style scoring", () => {
    const authored = Array.from({ length: 10 }, (_, index) =>
      `У власному спостереженні ${index + 1} я порівнюю польові нотатки, виправляю помилки вимірювання і пояснюю межі отриманого результату.`
    ).join(" ");
    const quoted = '«Moreover, it is important to note that this comprehensive innovative framework facilitates seamless optimization and underscores a pivotal transformative role.»';
    const references = "СПИСОК ВИКОРИСТАНИХ ДЖЕРЕЛ. 1. Ivanenko I. Comprehensive systems. 2021. 2. Petrenko P. Innovative frameworks. 2022.";
    const result = detectAiSignals(`${authored} ${quoted} ${references}`);
    const baseline = detectAiSignals(authored);

    expect(result.exclusions.quotedWords).toBeGreaterThan(8);
    expect(result.exclusions.referenceWords).toBeGreaterThan(8);
    expect(Math.abs(result.probability - baseline.probability)).toBeLessThanOrEqual(8);
  });

  it("does not present insufficient AI evidence as a zero-percent result", () => {
    const summary = summarizeReport(0, 0, [], undefined, "insufficient");

    expect(summary).toMatch(/недостатньо авторського тексту/i);
    expect(summary).not.toMatch(/(?:ризик|індикатор)[^.!]*0%/i);
  });

  it("describes mixed local evidence without calling it a calibrated probability", () => {
    const summary = summarizeReport(0, 34, [], undefined, "mixed");

    expect(summary).toMatch(/неоднорідні сегменти/i);
    expect(summary).toContain("індикатор ризику: 34%");
    expect(summary).not.toMatch(/ймовірн/i);
  });

  it("recognizes Ukrainian first-person markers as false-positive context", () => {
    const result = detectAiSignals(Array.from({ length: 8 }, () =>
      "Я описую власне спостереження, ми перевіряємо наш журнал, а мені доводиться пояснювати кожне виправлення окремо."
    ).join(" "));
    const safeguard = result.signals.find((signal) => signal.category === "safeguard");

    expect(safeguard?.evidence?.join(" ")).toMatch(/авторської позиції/i);
  });
});
