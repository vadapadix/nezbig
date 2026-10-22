import { ScanSettingsSchema } from "../../../shared/validation/schemas.js";
import type { ScanSettings, PlagiarismMatch } from "../../../shared/types/index.js";
import { isAcademicBoilerplate } from "./plagiarismScoring.js";
const defaultSettings: ScanSettings = {
  maxChunks: 14,
  chunkWords: 120,
  overlapWords: 32,
  sensitivity: "balanced"
};

export function sanitizeSettings(settings?: unknown): ScanSettings {
  const parsed = ScanSettingsSchema.safeParse(settings);
  const safeSettings = parsed.success && parsed.data ? parsed.data : {};
  const sensitivity = safeSettings.sensitivity ?? defaultSettings.sensitivity;
  const maxBySensitivity = sensitivity === "deep" ? 48 : sensitivity === "quick" ? 8 : 14;

  return {
    maxChunks: Math.min(Math.max(Number(safeSettings.maxChunks ?? maxBySensitivity), 1), 2000),
    chunkWords: Math.min(Math.max(Number(safeSettings.chunkWords ?? defaultSettings.chunkWords), 70), 520),
    overlapWords: Math.min(Math.max(Number(safeSettings.overlapWords ?? defaultSettings.overlapWords), 0), 180),
    sensitivity
  };
}

export function fullCoverageSettings(settings: ScanSettings, wordCount: number): ScanSettings {
  const chunkWords = wordCount > 20000 ? 520 : wordCount > 10000 ? 460 : wordCount > 5000 ? 380 : wordCount > 2000 ? Math.max(settings.chunkWords, 240) : settings.chunkWords;
  const overlapWords = Math.min(Math.floor(chunkWords * 0.18), Math.max(settings.overlapWords, wordCount > 5000 ? 56 : 32));
  const step = Math.max(60, chunkWords - overlapWords);
  const chunksNeeded = Math.max(1, Math.ceil(Math.max(1, wordCount - overlapWords) / step));

  return {
    ...settings,
    chunkWords,
    overlapWords,
    maxChunks: chunksNeeded
  };
}

export function thresholdFor(settings: ScanSettings): number {
  if (settings.sensitivity === "quick") return 32;
  if (settings.sensitivity === "deep") return 20;
  return 24;
}

export function isValidPlagiarismMatch(match: PlagiarismMatch, settings: ScanSettings): boolean {
  const threshold = thresholdFor(settings);
  const evidence = match.submittedEvidence || match.sourceEvidence || "";
  const isBoilerplate = evidence ? isAcademicBoilerplate(evidence) : false;

  // Academic boilerplate (e.g. ministerial titles, introductory formulas, conference names)
  // must have substantial overall document match to not be discarded as academic clichés.
  if (isBoilerplate) {
    return match.score >= 35 && match.overlapPercent >= 35;
  }

  // 1. Verbatim continuous match: at least 9 consecutive words
  if (match.longestRun >= 9) {
    return true;
  }

  // 2. High overlap with solid score and phrase match
  if (match.score >= threshold && match.overlapPercent >= 24) {
    if (match.ngramOverlapPercent >= 16 || match.longestRun >= 6) {
      return true;
    }
  }

  // 3. Hydrated full page with verified high overlap
  if (match.confidence === "page" && match.score >= threshold && match.overlapPercent >= 28) {
    return true;
  }

  return false;
}

export async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runWorker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index] as T);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
  return results;
}

