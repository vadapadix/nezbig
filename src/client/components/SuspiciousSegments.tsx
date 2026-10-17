import type { AiSuspiciousSegment } from "../../shared/types";
import { formatNumber } from "../utils/reportLabels";
import { useLanguage } from "../context/LanguageContext";
import { translateEvidenceItem } from "../utils/reportI18n";

interface SuspiciousSegmentsProps {
  segments: AiSuspiciousSegment[];
}

export function SuspiciousSegments({ segments }: SuspiciousSegmentsProps) {
  const { lang } = useLanguage();
  if (segments.length === 0) return null;

  return (
    <section className="segment-panel" aria-labelledby="segments-title">
      <div className="section-heading-row">
        <h3 id="segments-title">{lang === "uk" ? "Підозрілі фрагменти" : "Suspicious Segments"}</h3>
        <span>{segments.length} {lang === "uk" ? "для перевірки" : "for review"}</span>
      </div>
      <p className="section-note">
        {lang === "uk"
          ? "Це найсильніші локальні сигнали, а не твердження про авторство всього документа."
          : "These represent localized stylometric anomalies rather than definitive proof of authorship."}
      </p>
      <div className="segment-list">
        {segments.map((segment) => (
          <article className="segment-card" key={`${segment.index}-${segment.startWord}`}>
            <div>
              <strong>
                {lang === "uk" ? "Слова проаналізованого тексту" : "Words in analyzed prose"} {formatNumber(segment.startWord, lang)}–{formatNumber(segment.endWord, lang)}
              </strong>
              <span>{segment.score}%</span>
            </div>
            <blockquote>{segment.excerpt}</blockquote>
            <ul>
              {segment.evidence.map((evidence) => (
                <li key={evidence}>{translateEvidenceItem(evidence, lang)}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
