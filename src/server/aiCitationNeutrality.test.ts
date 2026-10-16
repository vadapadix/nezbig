import { describe, expect, it } from "vitest";
import { detectAiSignals } from "./aiDetection.js";
import { prepareAiAnalysisText } from "./aiTextPreprocess.js";
import { buildAnalysisSample } from "./llmShared.js";

const passages = [
  "Я прийшов до школи раніше, бо хотів перевірити двері укриття. Біля сходів стояла коробка, якої вчора ще не було. Довелося покликати чергового. Він прибрав її, а я повернувся до класу й записав час у блокноті. Не все вдалося одразу: ключ від другого входу знайшли лише після дзвінка. Наступного разу перевірю це ще ввечері.",
  "Важливо зазначити, що у сучасному світі цифрові технології відіграють ключову роль. Насамперед необхідно враховувати ефективність, надійність та доступність. Крім того, важливо зазначити, що системний підхід забезпечує ефективність, надійність та доступність. Підсумовуючи, слід зауважити, що цифрові технології відкривають нові можливості. У сучасному світі важливо зазначити, що системний підхід відіграє ключову роль."
];

describe("citation-neutral authorship analysis", () => {
  it.each(passages)("does not change the prose score when links and citation markers are added", passage => {
    const cited = `${passage} [1] [2, 3] https://example.org/first https://example.org/second https://example.org/third`;
    expect(prepareAiAnalysisText(cited).text).toBe(prepareAiAnalysisText(passage).text);
    const plain = detectAiSignals(passage);
    const linked = detectAiSignals(cited);
    expect(linked.probability).toBe(plain.probability);
    expect(linked.verdict).toBe(plain.verdict);
    expect(linked.suspiciousSegments).toEqual(plain.suspiciousSegments);
    expect(buildAnalysisSample(cited)).toBe(buildAnalysisSample(passage));
  });

  it("does not let a bibliography change the analyzed body", () => {
    const body = passages.join(" ");
    const cited = `${body}\nСписок використаних джерел\n1. Автор. Назва першої книги. Київ, 2024. https://example.org/book\n2. Author. Another research paper. Journal, 2025. https://example.org/paper`;
    expect(prepareAiAnalysisText(cited).text).toBe(prepareAiAnalysisText(body).text);
    expect(detectAiSignals(cited).probability).toBe(detectAiSignals(body).probability);
    expect(buildAnalysisSample(cited)).toBe(buildAnalysisSample(body));
  });
});
