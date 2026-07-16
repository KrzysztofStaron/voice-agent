import { OpenAIASR } from "../asr/openai-asr";
import { saveRun } from "./lib/runs";

function noteFromArgs(argv: string[]) {
  const idx = argv.indexOf("--note");
  if (idx === -1) return "Untitled benchmark run";
  return argv.slice(idx + 1).join(" ").trim() || "Untitled benchmark run";
}

const asr = new OpenAIASR();
const note = noteFromArgs(process.argv.slice(2));
const results = await asr.benchmark();
const run = await saveRun({ system: asr, results, note });

console.log(JSON.stringify(results, null, 2));
console.log(`\nsaved run: ${run.id}`);
console.log(`  dir: ${run.dir}`);
console.log(`  notes: ${run.dir}/NOTES.md`);
const { latency } = run.meta.summary;
console.log(`  mean WER: ${run.meta.summary.meanWer.toFixed(4)}`);
console.log(
  `  latency: total=${latency.totalMs.toFixed(0)}ms mean=${latency.meanMs.toFixed(0)}ms p50=${latency.p50Ms.toFixed(0)}ms p95=${latency.p95Ms.toFixed(0)}ms`,
);
console.log(
  `  git: commit=${run.meta.git.commit ?? "none"} tag=${run.meta.git.tag ?? "none"} dirty=${run.meta.git.dirty}`,
);

if (!run.meta.git.commit) {
  console.log(
    "\nwarning: no git commits yet — results are saved, but revisit/worktree needs a commit + tag. Commit the repo, then re-run to pin code.",
  );
} else if (run.meta.git.dirty) {
  console.log(
    "\nwarning: working tree was dirty — the tag points at HEAD, but uncommitted edits are not in that snapshot.",
  );
} else if (run.meta.git.tag) {
  console.log(`\nrevisit code with: bun benchmark/revisit.ts ${run.id}`);
}
