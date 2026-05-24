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
  const chunkWords =
    words > 20000
      ? 520
      : words > 10000
        ? 460
        : words > 5000
          ? 380
          : sensitivity === "quick"
            ? words > 2000
              ? 240
              : 110
            : sensitivity === "deep"
              ? words > 3500
                ? 260
                : 160
              : words > 2000
                ? 240
                : 120;
  const overlapWords = Math.min(Math.floor(chunkWords * 0.18), sensitivity === "deep" ? 56 : words > 2000 ? 44 : 32);
  const usableStep = Math.max(40, chunkWords - overlapWords);
  const estimatedChunks = Math.max(1, Math.ceil(words / usableStep));
  const floor = sensitivity === "quick" ? 4 : sensitivity === "deep" ? 18 : 8;

  return {
    sensitivity,
    chunkWords,
    overlapWords,
    maxChunks: words === 0 ? (sensitivity === "quick" ? 8 : sensitivity === "deep" ? 40 : 14) : Math.max(floor, estimatedChunks)
  };
}

function estimateScanSeconds(settings: ScanSettings, wordCount: number): number {
  if (wordCount <= 0) return 0;
  const longMode = wordCount > 2000 || settings.maxChunks > 18;
  const veryLongMode = wordCount > 8000 || settings.maxChunks > 45;
  const concurrency = veryLongMode ? 8 : settings.sensitivity === "deep" ? 4 : 5;
  const secondsPerWave = veryLongMode ? 9 : settings.sensitivity === "quick" ? 8 : settings.sensitivity === "deep" ? (longMode ? 15 : 22) : longMode ? 12 : 17;
  const waves = Math.max(1, Math.ceil(settings.maxChunks / concurrency));
  return Math.max(18, Math.round(8 + waves * secondsPerWave));
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "після додавання тексту";
  if (seconds < 60) return `~${seconds} с`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest > 0 ? `~${minutes} хв ${rest} с` : `~${minutes} хв`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("uk-UA").format(value);
}

function riskLabel(value: number): string {
  if (value >= 70) return "Високий";
  if (value >= 38) return "Середній";
  return "Низький";
}

function reportSummaryText(report: ScanReport): string {
  if (report.aiOpinionProbability === undefined) return report.summary;
  return `${report.summary} AI-думка показана окремо: ${report.aiOpinionProbability}%.`;
}

function confidenceLabel(value: "snippet" | "page"): string {
  return value === "page" ? "сторінку прочитано" : "лише уривок пошуку";
}

function summarizeAiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/rate-limited|rate.?limit|429/i.test(message)) return "модель тимчасово обмежена лімітом запитів";
  if (/insufficient_quota|out of credits|quota/i.test(message)) return "у провайдера закінчилася квота";
  if (/aborted|timeout/i.test(message)) return "модель не відповіла вчасно";
  if (/empty response/i.test(message)) return "модель повернула порожню відповідь";
  return message.slice(0, 180);
}

function isDuplicateOpinionSignal(signal: LlmOpinion["aiSignals"][number], localSignals: ScanReport["aiSignals"]): boolean {
  const normalizedLabel = signal.label.trim().toLowerCase();
  return localSignals.some((localSignal) => localSignal.label.trim().toLowerCase() === normalizedLabel);
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let currentY = y;

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (context.measureText(nextLine).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = nextLine;
    }
  }

  if (line) {
    context.fillText(line, x, currentY);
    currentY += lineHeight;
  }

  return currentY;
}

function downloadReportPng(report: ScanReport): void {
  const canvas = document.createElement("canvas");
  const width = 1400;
  const height = 1800;
  const scale = window.devicePixelRatio || 1;
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const context = canvas.getContext("2d");
  if (!context) return;

  context.scale(scale, scale);
  context.fillStyle = "#fbf7ed";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#0f211e";
  context.fillRect(0, 0, width, 210);

  context.fillStyle = "#2ec4b6";
  context.font = "700 22px Actay, sans-serif";
  context.fillText("ЗВІТ НЕЗБІГ", 70, 72);
  context.fillStyle = "#fff8ed";
  context.font = "700 48px 'Actay Wide', Actay, sans-serif";
  const titleY = wrapCanvasText(context, report.fileName, 70, 132, 920, 56);
  context.font = "400 24px Actay, sans-serif";
  context.fillText(new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.checkedAt)), 1050, 72);

  let y = Math.max(260, titleY + 48);
  const cardWidth = 280;
  const cards = [
    ["Плагіат", `${report.plagiarismScore}%`, `${riskLabel(report.plagiarismScore)} ризик`],
    ["ШІ-аналіз", `${report.aiProbability}%`, `${riskLabel(report.aiProbability)} рівень`],
    ["AI-думка", report.aiOpinionProbability !== undefined ? `${report.aiOpinionProbability}%` : "...", report.aiOpinionProbability !== undefined ? `${riskLabel(report.aiOpinionProbability)} рівень` : "очікує модель"],
    ["Фрагменти", formatNumber(report.chunksChecked), `${formatNumber(report.wordCount)} слів`]
  ];

  for (const [index, card] of cards.entries()) {
    const x = 70 + index * (cardWidth + 35);
    context.fillStyle = "#fffdf7";
    context.strokeStyle = "#ddd6c8";
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(x, y, cardWidth, 170, 14);
    context.fill();
    context.stroke();
    context.fillStyle = "#66716f";
    context.font = "700 24px Actay, sans-serif";
    context.fillText(card[0], x + 28, y + 48);
    context.fillStyle = "#101817";
    context.font = "800 70px 'Actay Wide', Actay, sans-serif";
    context.fillText(card[1], x + 28, y + 116);
    context.fillStyle = "#66716f";
    context.font = "400 22px Actay, sans-serif";
    context.fillText(card[2], x + 28, y + 148);
  }

  y += 225;
  context.fillStyle = "#101817";
  context.font = "800 28px 'Actay Wide', Actay, sans-serif";
  context.fillText("Підсумок", 70, y);
  context.fillStyle = "#505c59";
  context.font = "400 24px Actay, sans-serif";
  y = wrapCanvasText(context, reportSummaryText(report), 70, y + 42, 1220, 34) + 22;

  if (report.scanNotes?.length) {
    context.fillStyle = "#101817";
    context.font = "800 26px 'Actay Wide', Actay, sans-serif";
    context.fillText("Примітки перевірки", 70, y);
    context.fillStyle = "#505c59";
    context.font = "400 22px Actay, sans-serif";
    y += 38;
    for (const note of report.scanNotes.slice(0, 4)) {
      y = wrapCanvasText(context, `- ${note}`, 90, y, 1180, 30);
    }
    y += 18;
  }

  context.fillStyle = "#101817";
  context.font = "800 28px 'Actay Wide', Actay, sans-serif";
  context.fillText("Ймовірні джерела", 70, y);
  y += 46;
  context.font = "400 22px Actay, sans-serif";
  context.fillStyle = "#505c59";

  const matches = report.matches.slice(0, 5);
  if (matches.length === 0) {
    y = wrapCanvasText(context, "Сильних збігів у відкритих вебджерелах не знайдено.", 70, y, 1220, 32) + 26;
  } else {
    for (const match of matches) {
      context.fillStyle = "#101817";
      context.font = "800 24px Actay, sans-serif";
      y = wrapCanvasText(context, `${match.score}% - ${match.title}`, 70, y, 1220, 32);
      context.fillStyle = "#505c59";
      context.font = "400 21px Actay, sans-serif";
      y = wrapCanvasText(context, `${match.url} | слова ${match.overlapPercent}%, хеші ${match.hashOverlapPercent}%, full-text ${match.fullTextRank}%`, 90, y + 6, 1180, 29);
      y += 18;
    }
  }

  context.fillStyle = "#101817";
  context.font = "800 28px 'Actay Wide', Actay, sans-serif";
  context.fillText("AI-сигнали", 70, y);
  y += 44;
  for (const signal of report.aiSignals.slice(0, 5)) {
    context.fillStyle = "#101817";
    context.font = "800 23px Actay, sans-serif";
    context.fillText(`${signal.label}: ${signal.score}%`, 70, y);
    context.fillStyle = "#505c59";
    context.font = "400 21px Actay, sans-serif";
    y = wrapCanvasText(context, signal.detail, 90, y + 32, 1180, 29) + 16;
  }

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nezbig-report-${new Date(report.checkedAt).toISOString().slice(0, 10)}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
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
  const coverageWords = wordCount;
  const settingsMode = scanModes.find((mode) => mode.value === settings.sensitivity) ?? scanModes[1];
  const estimatedScanSeconds = useMemo(() => estimateScanSeconds(settings, wordCount), [settings, wordCount]);

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

    const scanSettings = recommendSettings(wordCount, settings.sensitivity);
    setBusy(true);
    setLlmBusy(false);
    setReport(null);
    setMessage(`Шукаю збіги, відкриваю сторінки джерел і рахую локальні AI-сигнали. Орієнтовно: ${formatDuration(estimateScanSeconds(scanSettings, wordCount))}.`);

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, fileName, settings: scanSettings })
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
              aiOpinionProbability: payload.aiProbability,
              aiOpinionModel: payload.aiModel,
              aiOpinionNote: payload.aiNote,
              aiOpinionSignals: payload.aiSignals
            }
          : current
      );
      setMessage(`AI-думка готова: ${payload.aiModel}.`);
    } catch (error) {
      const note = `AI-думка недоступна, залишено локальний звіт: ${summarizeAiError(error)}.`;
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
                  ? `Автопідбір: ${settingsMode.label.toLowerCase()}, покриття ${formatNumber(coverageWords)} з ${formatNumber(wordCount)} слів, час ${formatDuration(estimatedScanSeconds)}.`
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
              <p className="loading-estimate">{busy ? `Орієнтовний час: ${formatDuration(estimatedScanSeconds)}` : "AI-думка може відповідати довше за локальний звіт."}</p>
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
                <p>{reportSummaryText(report)}</p>
              </div>
              <div className="report-actions">
                <time dateTime={report.checkedAt}>{new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.checkedAt))}</time>
                <button type="button" className="secondary-button" onClick={() => downloadReportPng(report)}>
                  Завантажити PNG
                </button>
              </div>
            </div>

            <div className="metrics">
              <article>
                <span>Плагіат</span>
                <strong>{report.plagiarismScore}%</strong>
                <small>{riskLabel(report.plagiarismScore)} ризик</small>
              </article>
              <article>
                <span>ШІ-аналіз</span>
                <strong>{report.aiProbability}%</strong>
                <small>{riskLabel(report.aiProbability)} рівень з локального аналізу</small>
              </article>
              <article>
                <span>AI-думка</span>
                <strong>{report.aiOpinionProbability !== undefined ? `${report.aiOpinionProbability}%` : "..."}</strong>
                <small>{report.aiOpinionProbability !== undefined ? `${riskLabel(report.aiOpinionProbability)} рівень від моделі` : llmBusy ? "модель ще думає" : "немає відповіді моделі"}</small>
              </article>
              <article>
                <span>Фрагменти</span>
                <strong>{formatNumber(report.chunksChecked)}</strong>
                <small>{formatNumber(report.wordCount)} слів</small>
              </article>
            </div>

            {report.scanNotes && report.scanNotes.length > 0 ? (
              <div className="scan-notes" aria-label="Примітки перевірки">
                {report.skippedTitleWords ? <strong>Титулку пропущено: {formatNumber(report.skippedTitleWords)} слів</strong> : null}
                {report.scanNotes.map((note) => (
                  <span key={note}>{note}</span>
                ))}
              </div>
            ) : null}

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
                            <dt>Хеші</dt>
                            <dd>{match.hashOverlapPercent}%</dd>
                          </div>
                          <div>
                            <dt>Full-text</dt>
                            <dd>{match.fullTextRank}%</dd>
                          </div>
                          <div>
                            <dt>Доказ</dt>
                            <dd>{confidenceLabel(match.confidence)}</dd>
                          </div>
                          <div>
                            <dt>Індекс</dt>
                            <dd>{match.provider ?? "Web"}</dd>
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
                  {llmBusy ? "AI-думка: очікування відповіді..." : "Локальний AI-відсоток незалежний від LLM"}
                </p>
                {report.aiNote ? <p className="provider-note">{report.aiNote}</p> : null}
                {report.aiOpinionProbability !== undefined ? (
                  <div className="opinion-panel">
                    <strong>AI-думка: {report.aiOpinionProbability}%</strong>
                    <span>{report.aiOpinionModel}</span>
                    {report.aiOpinionNote ? <p>{report.aiOpinionNote}</p> : null}
                  </div>
                ) : null}
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
                  {report.aiOpinionSignals?.filter((signal) => !isDuplicateOpinionSignal(signal, report.aiSignals)).map((signal) => (
                    <article className="signal opinion-signal" key={`opinion-${signal.label}`}>
                      <div>
                        <strong>{signal.label}</strong>
                        <span>{signal.score}%</span>
                      </div>
                      <progress value={signal.score} max="100" aria-label={`${signal.label}: ${signal.score}%`} />
                      <p>{signal.detail}</p>
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
