import { join } from "node:path";

export type UsageInfo = {
  type: "tokens" | "duration";
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  seconds?: number;
  /** Estimated USD from published OpenAI rates; null if unknown. */
  costUsd: number | null;
};

export type TranscribeResult = {
  text: string;
  usage?: UsageInfo;
};

export type BenchmarkResult = {
  key: string;
  wer: number;
  latencyMs: number;
  transcription: string;
  usage?: UsageInfo;
  costUsd: number | null;
};

export type LatencyStats = {
  totalMs: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
};

export type BenchmarkProgress = {
  done: number;
  total: number;
  key: string;
  result: BenchmarkResult;
};

export type BenchmarkOptions = {
  labelsPath?: string;
  samplesDir?: string;
  onProgress?: (progress: BenchmarkProgress) => void;
  /** Global counter offset when running multiple models in one bakeoff. */
  progressOffset?: number;
  /** Global total when running multiple models in one bakeoff. */
  progressTotal?: number;
};

export abstract class ASR {
  /** Stable id for benchmark runs, e.g. "openai-gpt-4o-transcribe". */
  abstract get id(): string;

  abstract transcribe(file: string): Promise<TranscribeResult>;

  async benchmark(options: BenchmarkOptions = {}): Promise<BenchmarkResult[]> {
    const labelsPath = options.labelsPath ?? "benchmark/labels.json";
    const samplesDir = options.samplesDir ?? "benchmark/samples";
    const labels = (await Bun.file(labelsPath).json()) as Record<string, string>;
    const entries = Object.entries(labels);
    const results: BenchmarkResult[] = [];
    const offset = options.progressOffset ?? 0;
    const total = options.progressTotal ?? entries.length;

    for (let i = 0; i < entries.length; i++) {
      const [key, reference] = entries[i]!;
      const started = performance.now();
      const { text, usage } = await this.transcribe(join(samplesDir, key));
      const latencyMs = Math.round(performance.now() - started);

      const result: BenchmarkResult = {
        key,
        wer: wordErrorRate(text, reference),
        latencyMs,
        transcription: text,
        usage,
        costUsd: usage?.costUsd ?? null,
      };
      results.push(result);

      options.onProgress?.({
        done: offset + i + 1,
        total,
        key,
        result,
      });
    }

    return results;
  }
}

export function latencyStats(results: BenchmarkResult[]): LatencyStats {
  if (results.length === 0) {
    return { totalMs: 0, meanMs: 0, p50Ms: 0, p95Ms: 0, minMs: 0, maxMs: 0 };
  }

  const sorted = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const totalMs = sorted.reduce((sum, ms) => sum + ms, 0);

  return {
    totalMs,
    meanMs: Math.round(totalMs / sorted.length),
    p50Ms: Math.round(percentile(sorted, 0.5)),
    p95Ms: Math.round(percentile(sorted, 0.95)),
    minMs: sorted[0]!,
    maxMs: sorted[sorted.length - 1]!,
  };
}

export function totalCostUsd(results: BenchmarkResult[]): number | null {
  let sum = 0;
  let any = false;
  for (const result of results) {
    if (result.costUsd == null) continue;
    sum += result.costUsd;
    any = true;
  }
  return any ? sum : null;
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 1) return sorted[0]!;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

export function wordErrorRate(transcription: string, reference: string) {
  const clean = (text: string) =>
    text
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, "")
      .replace(/\s{2,}/g, " ");

  const referenceWords = clean(reference).split(" ");
  const transcriptionWords = clean(transcription).split(" ");

  let totalErrors = 0;
  for (let i = 0; i < referenceWords.length; i++) {
    if (referenceWords[i] !== transcriptionWords[i]) {
      totalErrors++;
    }
  }

  return totalErrors / referenceWords.length;
}
