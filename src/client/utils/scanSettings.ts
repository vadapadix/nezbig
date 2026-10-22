import type { ScanSettings } from "../../shared/types/index";

export const defaultSettings: ScanSettings = {
  maxChunks: 14,
  chunkWords: 120,
  overlapWords: 32,
  sensitivity: "balanced"
};

export const scanModes: Array<{
  value: ScanSettings["sensitivity"];
  label: string;
  detail: string;
}> = [
  { value: "quick", label: "Швидко", detail: "Короткий огляд, менше запитів." },
  { value: "balanced", label: "Збалансовано", detail: "Оптимально для есе й рефератів." },
  { value: "deep", label: "Глибоко", detail: "Більше фрагментів, повільніше." }
];

export function recommendSettings(wordCount: number, sensitivity: ScanSettings["sensitivity"]): ScanSettings {
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

export function estimateScanSeconds(settings: ScanSettings, wordCount: number): number {
  if (wordCount <= 0) return 0;
  const longMode = wordCount > 2000 || settings.maxChunks > 18;
  const veryLongMode = wordCount > 8000 || settings.maxChunks > 45;
  const concurrency = veryLongMode ? 8 : settings.sensitivity === "deep" ? 4 : 5;
  const secondsPerWave = veryLongMode ? 9 : settings.sensitivity === "quick" ? 8 : settings.sensitivity === "deep" ? (longMode ? 15 : 22) : longMode ? 12 : 17;
  const waves = Math.max(1, Math.ceil(settings.maxChunks / concurrency));
  return Math.max(18, Math.round(8 + waves * secondsPerWave));
}

export function formatDuration(seconds: number, lang: "uk" | "en" = "en"): string {
  if (seconds <= 0) return lang === "uk" ? "після додавання тексту" : "add text first";
  if (seconds < 60) return lang === "uk" ? `~${seconds} с` : `~${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (lang === "uk") {
    return rest > 0 ? `~${minutes} хв ${rest} с` : `~${minutes} хв`;
  }
  return rest > 0 ? `~${minutes}m ${rest}s` : `~${minutes}m`;
}
