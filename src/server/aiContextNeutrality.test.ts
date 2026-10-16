import { describe, expect, it } from "vitest";
import { detectAiSignals } from "./aiDetection.js";

const prose = "Я вчора перевірив розклад чергувань у школі. Біля другого входу ще залишалися коробки після ремонту. Черговий допоміг звільнити прохід, а потім ми оглянули сходи. Директорка попросила записати, що саме потрібно полагодити до понеділка. Я забув рулетку, тому повернувся до кабінету. Двері тепер відчиняються легко. У блокноті залишив коротку позначку про несправний ліхтар.";

describe("genre and formatting neutrality", () => {
  it("does not change the score when sentence periods become questions or exclamations", () => {
    const baseline = detectAiSignals(prose);
    for (const punctuation of ["?", "!"]) {
      expect(detectAiSignals(prose.replaceAll(".", punctuation)).probability).toBe(baseline.probability);
    }
  });

  it.each(["Я не можу прийти завтра, бо захворів.", "I cannot attend tomorrow because I am ill."])("does not mistake an ordinary refusal for model self-identification: %s", refusal => {
    const result = detectAiSignals(`${prose} ${refusal}`);
    expect(result.signals.find(signal => signal.label === "Prompt-leak та ШІ-відмови")).toBeUndefined();
  });

  it("does not count the common word як as hedging", () => {
    const result = detectAiSignals("Я побачив як працює насос. Потім пояснив як відкрити кран. Сусід показав як прибрати воду. Ми згадали як ремонтували трубу минулого літа.");
    expect(result.signals.find(signal => signal.label === "Обережні формулювання")).toBeUndefined();
  });

  it("keeps impersonal academic language and standard research aims out of scoring evidence", () => {
    const result = detectAiSignals(`${prose} Метою дослідження є перевірка розкладу. У роботі проаналізовано записи, визначено зміни та встановлено час чергування.`);
    const contextual = result.signals.filter(signal => ["Безособовий стиль", "Шаблон академічної генерації", "Одноманітна пунктуація"].includes(signal.label));
    expect(contextual.length).toBeGreaterThan(0);
    expect(contextual.every(signal => signal.category === "safeguard")).toBe(true);
    expect(result.suspiciousSegments.flatMap(segment => segment.evidence).join(" ")).not.toMatch(/Безособовий стиль|Шаблон академічної генерації|Одноманітна пунктуація/);
  });
});
