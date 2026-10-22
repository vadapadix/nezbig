import { readFileSync } from "fs";
import { join } from "path";
import { detectAiSignals } from "../src/server/domain/analysis/aiDetection.js";
import type { AiVerdict } from "../src/shared/types/index.js";

const DOC_SEPARATOR = /\r?\n===DOC===\r?\n/;
const FIXTURE_DIR = join(process.cwd(), "tests", "fixtures", "ai-corpus");

type Sample = {
  name: string;
  group: "human" | "ai" | "mixed" | "paraphrased";
  label: 0 | 1;
  text: string;
};

type ScoredSample = Sample & {
  probability: number;
  verdict: AiVerdict;
  reliabilityScore: number;
};

function loadGroup(fileName: string, group: Sample["group"], label: 0 | 1): Sample[] {
  const raw = readFileSync(join(FIXTURE_DIR, fileName), "utf8");
  return raw
    .split(DOC_SEPARATOR)
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .map((text, index) => ({ name: `${group}-${index + 1}`, group, label, text }));
}

function rocAuc(scores: ScoredSample[]): number {
  const positives = scores.filter((sample) => sample.label === 1);
  const negatives = scores.filter((sample) => sample.label === 0);
  if (positives.length === 0 || negatives.length === 0) return Number.NaN;

  let wins = 0;
  for (const positive of positives) {
    for (const negative of negatives) {
      wins += positive.probability > negative.probability ? 1 : positive.probability === negative.probability ? 0.5 : 0;
    }
  }
  return wins / (positives.length * negatives.length);
}

function confusionAt(scores: ScoredSample[], threshold: number): { tp: number; fp: number; tn: number; fn: number } {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (const sample of scores) {
    const predictedPositive = sample.probability >= threshold;
    if (predictedPositive && sample.label === 1) tp += 1;
    else if (predictedPositive && sample.label === 0) fp += 1;
    else if (!predictedPositive && sample.label === 0) tn += 1;
    else fn += 1;
  }
  return { tp, fp, tn, fn };
}

function tprAtMaxFpr(scores: ScoredSample[], maxFpr: number): { tpr: number; fpr: number; threshold: number } {
  const positives = scores.filter((sample) => sample.label === 1).length;
  const negatives = scores.filter((sample) => sample.label === 0).length;
  if (positives === 0 || negatives === 0) return { tpr: Number.NaN, fpr: Number.NaN, threshold: Number.NaN };

  const thresholds = [...new Set(scores.map((sample) => sample.probability))].sort((left, right) => right - left);
  let best = { tpr: 0, fpr: 1, threshold: thresholds[thresholds.length - 1] ?? 0 };

  for (const threshold of thresholds) {
    const { tp, fp, fn } = confusionAt(scores, threshold);
    const fpr = fp / negatives;
    const tpr = tp / (tp + fn || 1);
    if (fpr <= maxFpr && tpr >= best.tpr) {
      best = { tpr, fpr, threshold };
    }
  }
  return best;
}

function verdictHistogram(scores: ScoredSample[]): string {
  const counts = new Map<AiVerdict, number>();
  for (const sample of scores) counts.set(sample.verdict, (counts.get(sample.verdict) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([verdict, count]) => `${verdict}:${count}`).join("  ");
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function main(): void {
  const pure = [...loadGroup("human.txt", "human", 0), ...loadGroup("ai.txt", "ai", 1)];
  const auxiliary = [...loadGroup("mixed.txt", "mixed", 1), ...loadGroup("paraphrased.txt", "paraphrased", 1)];
  const all = [...pure, ...auxiliary];

  const scored: ScoredSample[] = all.map((sample) => {
    const result = detectAiSignals(sample.text);
    return {
      ...sample,
      probability: Math.round(result.probability),
      verdict: result.verdict,
      reliabilityScore: result.reliability.score
    };
  });

  console.log("\nКалібрування локального AI-детектора (fixtures/ai-corpus)\n");
  console.log(`${"Документ".padEnd(16)} ${"група".padEnd(12)} ${"бал".padStart(4)} ${"надійн.".padStart(7)}  вердикт`);
  console.log("-".repeat(56));
  for (const sample of scored) {
    console.log(
      `${sample.name.padEnd(16)} ${sample.group.padEnd(12)} ${String(sample.probability).padStart(3)}% ${String(sample.reliabilityScore).padStart(6)}  ${sample.verdict}`
    );
  }

  console.log("\nМетрики на чистому корпусі (human vs ai):");
  console.log(`  ROC-AUC:                 ${rocAuc(scored.filter((sample) => sample.group !== "mixed" && sample.group !== "paraphrased")).toFixed(3)}`);

  for (const threshold of [45, 70]) {
    const matrix = confusionAt(pure.map((sample) => scored.find((item) => item.name === sample.name)!), threshold);
    const precision = matrix.tp + matrix.fp > 0 ? matrix.tp / (matrix.tp + matrix.fp) : Number.NaN;
    const recall = matrix.tp + matrix.fn > 0 ? matrix.tp / (matrix.tp + matrix.fn) : Number.NaN;
    console.log(`  поріг ${threshold}%: TP=${matrix.tp} FP=${matrix.fp} TN=${matrix.tn} FN=${matrix.fn} · точність=${Number.isNaN(precision) ? "—" : percent(precision)} повнота=${percent(recall)}`);
  }

  for (const maxFpr of [0.1, 0.2]) {
    const operating = tprAtMaxFpr(scored, maxFpr);
    console.log(`  TPR при FPR<=${percent(maxFpr)}: TPR=${percent(operating.tpr)} (фактичний FPR=${percent(operating.fpr)}, поріг=${operating.threshold}%)`);
  }

  for (const group of ["mixed", "paraphrased"] as const) {
    const subset = scored.filter((sample) => sample.group === group);
    const detected = subset.filter((sample) => sample.probability >= 45).length;
    const average = subset.reduce((sum, sample) => sum + sample.probability, 0) / Math.max(1, subset.length);
    console.log(`  група "${group}": середній бал ${average.toFixed(1)}%, виявлено >=45% у ${detected}/${subset.length}`);
  }

  console.log(`\nВердикти по всіх документах: ${verdictHistogram(scored)}\n`);
  console.log("Примітка: корпус синтетичний і малий; метрики є орієнтиром для регресії ваг, а не статистичною оцінкою якості.\n");
}

main();
