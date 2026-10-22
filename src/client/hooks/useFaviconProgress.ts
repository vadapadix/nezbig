import { useEffect } from "react";

export function useFaviconProgress(progress: { checked: number; total: number } | null) {
  useEffect(() => {
    if (!progress) {
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (link) link.href = "/favicon.svg"; // Reset to default
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw background circle
    const pct = progress.checked / progress.total;
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.strokeStyle = "#2ec4b6"; // var(--accent)
    ctx.lineWidth = 4;
    ctx.stroke();

    // Draw progress arc
    ctx.beginPath();
    ctx.arc(16, 16, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.strokeStyle = "#ff5d73"; // var(--risk)
    ctx.stroke();

    const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (link) link.href = canvas.toDataURL();
  }, [progress]);
}
