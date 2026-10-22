import type { Props, State } from "../types/ErrorBoundary.types";
export type { Props, State } from "../types/ErrorBoundary.types";
import { Component } from "react";

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="error-fallback" style={{ padding: "2rem", textAlign: "center", color: "var(--text)" }}>
            <h2>Щось пішло не так</h2>
            <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>{this.state.error?.message || "Сталася непередбачена помилка."}</p>
            <button className="primary-button" onClick={() => window.location.reload()}>
              Оновити сторінку
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
