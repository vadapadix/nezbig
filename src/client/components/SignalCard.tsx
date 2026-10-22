import type { ScanReport } from "../../shared/types/index";
import { useLanguage } from "../context/LanguageContext";
import { translateSignalLabel, translateSignalDetail, translateEvidenceItem } from "../utils/reportI18n";

export function SignalCard({ signal, className = "" }: { signal: ScanReport["aiSignals"][number]; className?: string }) {
  const { lang } = useLanguage();
  const isCritical = signal.score >= 50 && signal.category !== "safeguard";
  const isSafeguard = signal.category === "safeguard";
  const translatedLabel = translateSignalLabel(signal.label, lang);
  const translatedDetail = translateSignalDetail(signal.detail, lang);

  return (
    <article className={`signal ${className} ${isCritical ? "signal-critical" : ""} ${isSafeguard ? "signal-safeguard" : ""}`.trim()} key={signal.label}>
      <div className="signal-header">
        <div className="signal-title-group">
          <span className="signal-icon" aria-hidden="true" />
          <strong>{translatedLabel}</strong>
        </div>
        <span className="signal-score-badge">{signal.score}%</span>
      </div>
      <progress
        value={signal.score}
        max="100"
        aria-label={`${translatedLabel}: ${signal.score}%`}
        className={isCritical ? "progress-critical" : isSafeguard ? "progress-safeguard" : ""}
      />
      <p className="signal-detail">{translatedDetail}</p>
      {signal.evidence && signal.evidence.length > 0 ? (
        <ul className="evidence-list">
          {signal.evidence.map((item) => (
            <li key={item}>{translateEvidenceItem(item, lang)}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
