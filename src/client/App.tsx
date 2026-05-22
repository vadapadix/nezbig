import { FormEvent, useEffect, useMemo, useState } from "react";
import nezbigLogo from "./assets/nezbig-mark.png";
import type { LlmOpinion, ScanReport, ScanSettings, UploadedText } from "../shared/types";

const defaultSettings: ScanSettings = {
  maxChunks: 14,
  chunkWords: 120,
  overlapWords: 32,
  sensitivity: "balanced"
};

const scanModes: Array<{
  value: ScanSettings["sensitivity"];
  label: string;
  detail: string;
}> = [
  { value: "quick", label: "Швидко", detail: "Короткий огляд, менше запитів." },
  { value: "balanced", label: "Збалансовано", detail: "Оптимально для есе й рефератів." },
  { value: "deep", label: "Глибоко", detail: "Більше фрагментів, повільніше." }
];

function recommendSettings(wordCount: number, sensitivity: ScanSettings["sensitivity"]): ScanSettings {
  const words = Math.max(0, wordCount);
  const chunkWords = sensitivity === "quick" ? 110 : sensitivity === "deep" ? (words > 3500 ? 170 : 145) : words > 2500 ? 140 : 120;
  const overlapWords = sensitivity === "quick" ? 18 : sensitivity === "deep" ? 42 : 32;
  const usableStep = Math.max(40, chunkWords - overlapWords);
  const estimatedChunks = Math.max(1, Math.ceil(words / usableStep));
  const cap = sensitivity === "quick" ? 8 : sensitivity === "deep" ? 48 : 18;
  const floor = sensitivity === "quick" ? 4 : sensitivity === "deep" ? 18 : 8;

  return {
    sensitivity,
    chunkWords,
    overlapWords,
    maxChunks: words === 0 ? (sensitivity === "quick" ? 8 : sensitivity === "deep" ? 40 : 14) : Math.min(cap, Math.max(floor, estimatedChunks))
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("uk-UA").format(value);
}

function riskLabel(value: number): string {
  if (value >= 70) return "Високий";
  if (value >= 38) return "Середній";
  return "Низький";
}

function confidenceLabel(value: "snippet" | "page"): string {
  return value === "page" ? "сторінку прочитано" : "лише уривок пошуку";
}

export default function App() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("Вставлений текст");
  const [settings, setSettings] = useState<ScanSettings>(defaultSettings);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [llmBusy, setLlmBusy] = useState(false);
  const [message, setMessage] = useState("");

  const wordCount = useMemo(() => text.trim().split(/\s+/).filter(Boolean).length, [text]);
  const canScan = text.trim().length >= 120 && !busy;
  const coverageWords = Math.min(wordCount, settings.maxChunks * Math.max(1, settings.chunkWords - settings.overlapWords) + settings.overlapWords);
  const settingsMode = scanModes.find((mode) => mode.value === settings.sensitivity) ?? scanModes[1];

  useEffect(() => {
    setSettings((current) => {
      const recommended = recommendSettings(wordCount, current.sensitivity);
      if (
        current.chunkWords === recommended.chunkWords &&
        current.overlapWords === recommended.overlapWords &&
        current.maxChunks === recommended.maxChunks
      ) {
        return current;
      }
      return recommended;
    });
  }, [wordCount]);

  async function handleFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setMessage("Зчитую файл...");
    setReport(null);
    setLlmBusy(false);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/extract", { method: "POST", body: formData });
      const payload = (await response.json()) as UploadedText | { error: string };
      if (!response.ok || "error" in payload) throw new Error("error" in payload ? payload.error : "Не вдалося прочитати файл.");
      setText(payload.text);
      setFileName(payload.fileName);
      setMessage(`Файл готовий: ${formatNumber(payload.wordCount)} слів.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не вдалося прочитати файл.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canScan) {
      setMessage("Додайте щонайменше 120 символів тексту.");
      return;
    }

    setBusy(true);
    setLlmBusy(false);
    setReport(null);
    setMessage("Шукаю збіги, відкриваю сторінки джерел і рахую локальні AI-сигнали...");

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, fileName, settings: recommendSettings(wordCount, settings.sensitivity) })
      });
      const payload = (await response.json()) as ScanReport | { error: string };
      if (!response.ok || "error" in payload) throw new Error("error" in payload ? payload.error : "Перевірка не вдалася.");
      setReport(payload);
      setMessage("Базовий звіт готовий. AI-думка підвантажується окремо...");
      void loadLlmOpinion(payload, text);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Перевірка не вдалася.");
    } finally {
      setBusy(false);
    }
  }

  async function loadLlmOpinion(baseReport: ScanReport, sourceText: string) {
    setLlmBusy(true);

    try {
      const response = await fetch("/api/ai-opinion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: sourceText,
          localProbability: baseReport.aiProbability,
          localSignals: baseReport.aiSignals
        })
      });
      const payload = (await response.json()) as LlmOpinion | { error: string };
      if (!response.ok || "error" in payload) throw new Error("error" in payload ? payload.error : "AI-думка недоступна.");

      setReport((current) =>
        current?.id === baseReport.id
          ? {
              ...current,
              aiProbability: payload.aiProbability,
              aiProvider: payload.aiProvider,
              aiModel: payload.aiModel,
              aiNote: payload.aiNote,
              aiSignals: [
                ...payload.aiSignals,
                {
                  label: "Локальний Базовий Аналіз",
                  score: baseReport.aiProbability,
                  detail: "Це перша локальна оцінка, яка була показана до підключення LLM.",
                  category: "safeguard"
                }
              ]
            }
          : current
      );
      setMessage(`AI-думка готова: ${payload.aiModel}.`);
    } catch (error) {
      const note = `AI-думка недоступна, залишено локальний звіт: ${error instanceof Error ? error.message : "невідома помилка"}`;
      setReport((current) => (current?.id === baseReport.id ? { ...current, aiNote: note } : current));
      setMessage("Базовий звіт готовий. AI-думка зараз недоступна, використано локальний аналіз.");
    } finally {
      setLlmBusy(false);
    }
  }

  return (
    <>
      <a className="skip-link" href="#checker">Перейти до перевірки</a>
      <main className="app-shell">
        <section className="intro" aria-labelledby="page-title">
          <div className="brand-lockup">
            <img src={nezbigLogo} alt="" />
            <div>
              <p className="eyebrow">Text originality forensics</p>
              <h1 id="page-title">Незбіг</h1>
              <p className="hero-copy">Безкоштовна перевірка тексту на плагіат, AI-сліди та відкриті вебджерела.</p>
            </div>
          </div>
          <div className="status-strip" aria-live="polite">
            <span>{busy ? "Сканування..." : llmBusy ? "AI-думка аналізує..." : "Готово до перевірки"}</span>
            <strong>{formatNumber(wordCount)} слів</strong>
          </div>
        </section>

        <form id="checker" className="workspace" onSubmit={handleSubmit}>
          <section className="input-panel" aria-labelledby="input-title">
            <div className="panel-heading">
              <div>
                <h2 id="input-title">Документ</h2>
                <p>{fileName}</p>
              </div>
              <label className="file-button">
                <input
                  name="document"
                  type="file"
                  accept=".txt,.md,.markdown,.csv,.json,.rtf,.docx,.pdf,text/*,application/pdf"
                  onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
                />
                Завантажити файл
              </label>
            </div>

            <label className="text-label" htmlFor="source-text">
              Текст для перевірки
            </label>
            <textarea
              id="source-text"
              name="sourceText"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setFileName("Вставлений текст");
              }}
              placeholder="Вставте текст або завантажте документ..."
              autoComplete="off"
            />
          </section>

          <aside className="control-panel" aria-labelledby="settings-title">
            <h2 id="settings-title">Параметри</h2>
            <fieldset className="mode-picker">
              <legend>Режим перевірки</legend>
              {scanModes.map((mode) => (
                <label key={mode.value} className={settings.sensitivity === mode.value ? "mode-option mode-option-active" : "mode-option"}>
                  <input
                    type="radio"
                    name="sensitivity"
                    value={mode.value}
                    checked={settings.sensitivity === mode.value}
                    onChange={() => setSettings(recommendSettings(wordCount, mode.value))}
                  />
                  <span>{mode.label}</span>
                  <small>{mode.detail}</small>
                </label>
              ))}
            </fieldset>

            <div className="auto-settings" aria-label="Автоматичні параметри перевірки">
              <div>
                <span>Розмір фрагмента</span>
                <strong>{settings.chunkWords} слів</strong>
              </div>
              <div>
                <span>Глибина</span>
                <strong>{settings.maxChunks} фрагм.</strong>
              </div>
              <p>
                {wordCount > 0
                  ? `Автопідбір: ${settingsMode.label.toLowerCase()}, приблизне покриття ${formatNumber(coverageWords)} з ${formatNumber(wordCount)} слів.`
                  : "Додайте текст або файл, і параметри підлаштуються автоматично."}
              </p>
            </div>

            <div className="method-note">
              <strong>Метод</strong>
              <span>Пошук точних фраз, читання сторінок, n-грам збіги та розширений AI-аналіз за стилем і патернами.</span>
            </div>

            <button type="submit" disabled={!canScan}>
              {busy ? "Перевірка..." : "Запустити перевірку"}
            </button>
            <p className="message" aria-live="polite">{message}</p>
          </aside>
        </form>

        {busy || llmBusy ? (
          <section className="loading-panel" aria-live="polite" aria-label="Стан перевірки">
            <div className="loader-orbit" aria-hidden="true" />
            <div>
              <h2>{busy ? "Готуємо звіт" : "AI-думка аналізує текст"}</h2>
              <ol>
                <li className={busy ? "step-active" : "step-done"}>Нарізаємо текст на фрагменти</li>
                <li className={busy ? "step-active" : llmBusy ? "step-done" : ""}>Шукаємо збіги у відкритих джерелах</li>
                <li className={llmBusy ? "step-active" : ""}>Додаємо окрему AI-думку</li>
              </ol>
            </div>
          </section>
        ) : null}

        {report ? (
          <section className="report" aria-labelledby="report-title">
            <div className="report-header">
              <div>
                <p className="eyebrow">Звіт Незбіг</p>
                <h2 id="report-title">{report.fileName}</h2>
                <p>{report.summary}</p>
              </div>
              <time dateTime={report.checkedAt}>{new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.checkedAt))}</time>
            </div>

            <div className="metrics">
              <article>
                <span>Плагіат</span>
                <strong>{report.plagiarismScore}%</strong>
                <small>{riskLabel(report.plagiarismScore)} ризик</small>
              </article>
              <article>
                <span>AI-аналіз</span>
                <strong>{report.aiProbability}%</strong>
                <small>
                  {llmBusy ? "AI-думка завантажується..." : `${riskLabel(report.aiProbability)} рівень з ${report.aiProvider === "openrouter" ? "AI-моделі" : "локального аналізу"}`}
                </small>
              </article>
              <article>
                <span>Фрагменти</span>
                <strong>{formatNumber(report.chunksChecked)}</strong>
                <small>{formatNumber(report.wordCount)} слів</small>
              </article>
            </div>

            <div className="report-grid">
              <section aria-labelledby="matches-title">
                <h3 id="matches-title">Ймовірні джерела</h3>
                {report.matches.length === 0 ? (
                  <p className="empty-state">Сильних збігів у відкритих вебджерелах не знайдено.</p>
                ) : (
                  <div className="match-list">
                    {report.matches.map((match) => (
                      <article className="match-card" key={`${match.url}-${match.chunkIndex}`}>
                        <div className="match-score">
                          <strong>{match.score}%</strong>
                          <span>Фрагмент {match.chunkIndex + 1}</span>
                        </div>
                        <h4>
                          <a href={match.url} target="_blank" rel="noreferrer">{match.title}</a>
                        </h4>
                        <p>{match.snippet}</p>
                        <dl>
                          <div>
                            <dt>Слова</dt>
                            <dd>{match.overlapPercent}%</dd>
                          </div>
                          <div>
                            <dt>N-грам</dt>
                            <dd>{match.ngramOverlapPercent}%</dd>
                          </div>
                          <div>
                            <dt>Довгий збіг</dt>
                            <dd>{match.longestRun} слів</dd>
                          </div>
                          <div>
                            <dt>Доказ</dt>
                            <dd>{confidenceLabel(match.confidence)}</dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section aria-labelledby="ai-title">
                <h3 id="ai-title">Розширений AI-аналіз</h3>
                <p className="model-badge">
                  {llmBusy ? "AI-думка: очікування відповіді..." : report.aiProvider === "openrouter" ? `AI-модель: ${report.aiModel}` : "Локальний аналіз"}
                </p>
                {report.aiNote ? <p className="provider-note">{report.aiNote}</p> : null}
                <p className="section-note">Це ансамбль стилістичних, структурних і патерн-ознак. Він показує підозрілі маркери та запобіжники, але не є юридичним доказом походження тексту.</p>
                <div className="signal-list">
                  {report.aiSignals.map((signal) => (
                    <article className="signal" key={signal.label}>
                      <div>
                        <strong>{signal.label}</strong>
                        <span>{signal.score}%</span>
                      </div>
                      <progress value={signal.score} max="100" aria-label={`${signal.label}: ${signal.score}%`} />
                      <p>{signal.detail}</p>
                      {signal.evidence && signal.evidence.length > 0 ? (
                        <ul className="evidence-list">
                          {signal.evidence.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
