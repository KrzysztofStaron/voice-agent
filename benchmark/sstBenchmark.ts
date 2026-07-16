import { OpenAIASH } from "../openai-ash";
import { saveRun } from "./lib/runs";

function noteFromArgs(argv: string[]) {
  const idx = argv.indexOf("--note");
  if (idx === -1) return "Untitled benchmark run";
  return argv.slice(idx + 1).join(" ").trim() || "Untitled benchmark run";
}

const stt = new OpenAIASH();
const note = noteFromArgs(process.argv.slice(2));
const results = await stt.benchmark();
const run = await saveRun({ system: stt, results, note });

console.log(JSON.stringify(results, null, 2));
console.log(`\nsaved run: ${run.id}`);
console.log(`  dir: ${run.dir}`);
console.log(`  notes: ${run.dir}/NOTES.md`);
console.log(`  mean WER: ${run.meta.summary.meanWer.toFixed(4)}`);
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
