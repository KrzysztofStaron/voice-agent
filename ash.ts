import { join } from "node:path";

export type BenchmarkResult = {
  key: string;
  wer: number;
  transcription: string;
};

export abstract class ASH {
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
      const transcription = await this.transcribe(join(samplesDir, key));
      results.push({
        key,
        wer: wordErrorRate(transcription, reference),
        transcription,
      });
    }

    return results;
  }
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
