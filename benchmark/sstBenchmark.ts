import { OPENAI_ASR_MODELS, OpenAIASR } from "../asr/openai-asr";
import { saveRun, type SavedRun } from "./lib/runs";

function noteFromArgs(argv: string[]) {
  const idx = argv.indexOf("--note");
  if (idx === -1) {
    return "OpenAI ASR model comparison across all transcriptions models";
  }
  return argv.slice(idx + 1).join(" ").trim() || "OpenAI ASR model comparison";
}

const note = noteFromArgs(process.argv.slice(2));
const runs: SavedRun[] = [];

for (const model of OPENAI_ASR_MODELS) {
  console.log(`\n=== ${model} ===`);
  const asr = new OpenAIASR(model);
  const results = await asr.benchmark();
  const run = await saveRun({
    system: asr,
    results,
    note: `${note}\n\nModel: ${model}`,
  });
  runs.push(run);

  const { latency, meanWer } = run.meta.summary;
  console.log(`saved: ${run.id}`);
  console.log(`mean WER: ${meanWer.toFixed(4)}`);
  console.log(
    `latency: total=${latency.totalMs}ms mean=${latency.meanMs}ms p50=${latency.p50Ms}ms p95=${latency.p95Ms}ms`,
  );
}

console.log("\n=== comparison ===");
console.log(
  ["model", "meanWer", "meanMs", "p50Ms", "p95Ms", "totalMs", "run"]
    .map((h) => h.padEnd(14))
    .join(""),
);
for (const run of runs) {
  const { latency, meanWer } = run.meta.summary;
  console.log(
    [
      run.meta.system.replace("openai-", "").padEnd(14),
      meanWer.toFixed(4).padEnd(14),
      String(latency.meanMs).padEnd(14),
      String(latency.p50Ms).padEnd(14),
      String(latency.p95Ms).padEnd(14),
      String(latency.totalMs).padEnd(14),
      run.id,
    ].join(""),
  );
}
