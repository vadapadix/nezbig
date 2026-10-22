import type { Props } from "../types/HistoryPanel.types";
export type { Props } from "../types/HistoryPanel.types";
import { useHistory } from "../hooks/useHistory";

export function HistoryPanel({ onSelect }: Props) {
  const { items, loading, error, refresh } = useHistory();

  if (loading) {
    return (
      <aside className="history-panel" aria-label="Історія перевірок">
        <h3>Останні перевірки</h3>
        <p className="history-empty">Завантаження…</p>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="history-panel" aria-label="Історія перевірок">
        <h3>Останні перевірки</h3>
        <p className="history-empty" style={{ color: "var(--risk)" }}>{error}</p>
      </aside>
    );
  }

  if (!items.length) return null;

  return (
    <aside className="history-panel" aria-label="Історія перевірок">
      <div className="history-header">
        <h3>Останні перевірки</h3>
        <button
          type="button"
          className="history-refresh"
          onClick={refresh}
          title="Оновити"
          aria-label="Оновити історію"
        >
          ↻
        </button>
      </div>
      <ul className="history-list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="history-item"
              onClick={() => onSelect(item.id)}
            >
              <span className="history-name" title={item.fileName}>
                {item.fileName}
              </span>
              <span className="history-meta">
                {new Date(item.checkedAt).toLocaleDateString("uk-UA", {
                  day: "2-digit",
                  month: "short",
                })}
                {" · "}
                <span
                  className="history-score"
                  data-score={item.plagiarismScore}
                >
                  {item.plagiarismScore}%
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
