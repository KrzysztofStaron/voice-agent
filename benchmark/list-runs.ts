import { listRuns } from "./lib/runs";

const runs = await listRuns();
if (runs.length === 0) {
  console.log("No saved runs yet. Run: bun benchmark/sstBenchmark.ts --note \"...\"");
  process.exit(0);
}

for (const run of runs) {
  console.log(
    [
      run.id,
      `system=${run.system}`,
      `meanWer=${run.summary.meanWer.toFixed(4)}`,
      `commit=${run.git.commit?.slice(0, 8) ?? "none"}`,
      `tag=${run.git.tag ?? "none"}`,
      run.note,
    ].join(" | "),
  );
}
