import { OPENAI_ASR_MODELS, OpenAIASR } from "../asr/openai-asr";
import { saveRun, type SavedRun } from "./lib/runs";

function noteFromArgs(argv: string[]) {
  const idx = argv.indexOf("--note");
  if (idx === -1) {
    return "OpenAI ASR model comparison across all transcriptions models";
  }
  return argv.slice(idx + 1).join(" ").trim() || "OpenAI ASR model comparison";
}

function formatCost(costUsd: number | null) {
  if (costUsd == null) return "n/a";
  if (costUsd < 0.01) return `$${costUsd.toFixed(6)}`;
  return `$${costUsd.toFixed(4)}`;
}

const note = noteFromArgs(process.argv.slice(2));
const labels = (await Bun.file("benchmark/labels.json").json()) as Record<
  string,
  string
>;
const samplesPerModel = Object.keys(labels).length;
const totalRequests = OPENAI_ASR_MODELS.length * samplesPerModel;
const runs: SavedRun[] = [];

console.log(
  `Starting OpenAI ASR bakeoff: ${OPENAI_ASR_MODELS.length} models × ${samplesPerModel} samples = ${totalRequests} requests\n`,
);

let completed = 0;

for (const model of OPENAI_ASR_MODELS) {
  console.log(`\n=== ${model} ===`);
  const asr = new OpenAIASR(model);
  const results = await asr.benchmark({
    progressOffset: completed,
    progressTotal: totalRequests,
    onProgress: ({ done, total, key, result }) => {
      const cost = formatCost(result.costUsd);
      const usage =
        result.usage?.type === "tokens"
          ? `tokens=${result.usage.totalTokens}`
          : result.usage?.type === "duration"
            ? `audio=${result.usage.seconds?.toFixed(1)}s`
            : "usage=n/a";
      console.log(
        `[${done}/${total}] ${model} ${key} wer=${result.wer.toFixed(3)} ${result.latencyMs}ms ${usage} cost=${cost}`,
      );
    },
  });
  completed += results.length;

  const run = await saveRun({
    system: asr,
    results,
    note: `${note}\n\nModel: ${model}`,
  });
  runs.push(run);

  const { latency, meanWer, totalCostUsd } = run.meta.summary;
  console.log(`saved: ${run.id}`);
  console.log(`mean WER: ${meanWer.toFixed(4)}`);
  console.log(
    `latency: total=${latency.totalMs}ms mean=${latency.meanMs}ms p50=${latency.p50Ms}ms p95=${latency.p95Ms}ms`,
  );
  console.log(`cost (est.): ${formatCost(totalCostUsd)}`);
}

console.log("\n=== comparison ===");
console.log(
  ["model", "meanWer", "meanMs", "p95Ms", "cost", "run"]
    .map((h) => h.padEnd(16))
    .join(""),
);
for (const run of runs) {
  const { latency, meanWer, totalCostUsd } = run.meta.summary;
  console.log(
    [
      run.meta.system.replace("openai-", "").padEnd(16),
      meanWer.toFixed(4).padEnd(16),
      String(latency.meanMs).padEnd(16),
      String(latency.p95Ms).padEnd(16),
      formatCost(totalCostUsd).padEnd(16),
      run.id,
    ].join(""),
  );
}
