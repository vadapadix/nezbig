import type { ScanSettingsPanelProps } from "../types/ScanSettingsPanel.types";
export type { ScanSettingsPanelProps } from "../types/ScanSettingsPanel.types";

import { scanModes, recommendSettings, formatDuration } from "../utils/scanSettings";
import { formatNumber } from "../utils/reportLabels";

export function ScanSettingsPanel({
  settings,
  wordCount,
  estimatedScanSeconds,
  canScan,
  busy,
  canHumanize,
  humanizerBusy,
  message,
  onSettingsChange,
  onHumanize
}: ScanSettingsPanelProps) {
  const settingsMode = scanModes.find((mode) => mode.value === settings.sensitivity) ?? scanModes[1];

  return (
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
              onChange={() => onSettingsChange(recommendSettings(wordCount, mode.value))}
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
            ? `Автопідбір: ${settingsMode.label.toLowerCase()}, покриття ${formatNumber(wordCount)} з ${formatNumber(wordCount)} слів, час ${formatDuration(estimatedScanSeconds)}.`
            : "Додайте текст або файл, і параметри підлаштуються автоматично."}
        </p>
      </div>

      <button type="submit" disabled={!canScan}>
        {busy ? "Перевірка…" : "Запустити перевірку"}
      </button>
      <button type="button" className="secondary-button humanize-button" disabled={!canHumanize} onClick={onHumanize}>
        {humanizerBusy ? "Редагування…" : "Покращити стиль"}
      </button>
      <p className="message" aria-live="polite">
        {message}
      </p>
    </aside>
  );
}
