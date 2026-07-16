import { join } from "node:path";

export type BenchmarkResult = {
  key: string;
  wer: number;
  latencyMs: number;
  transcription: string;
};

export type LatencyStats = {
  totalMs: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
};

export abstract class ASR {
  /** Stable id for benchmark runs, e.g. "openai-gpt-4o-transcribe". */
  abstract get id(): string;

  abstract transcribe(file: string): Promise<string>;

  async benchmark(
    labelsPath = "benchmark/labels.json",
    samplesDir = "benchmark/samples",
  ): Promise<BenchmarkResult[]> {
    const labels = (await Bun.file(labelsPath).json()) as Record<string, string>;
    const results: BenchmarkResult[] = [];

    for (const [key, reference] of Object.entries(labels)) {
      const started = performance.now();
      const transcription = await this.transcribe(join(samplesDir, key));
      const latencyMs = Math.round(performance.now() - started);

      results.push({
        key,
        wer: wordErrorRate(transcription, reference),
        latencyMs,
        transcription,
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
