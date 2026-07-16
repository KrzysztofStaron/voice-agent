import { listRuns } from "./lib/runs";

const runs = await listRuns();
if (runs.length === 0) {
  console.log("No saved runs yet. Run: bun benchmark/sstBenchmark.ts --note \"...\"");
  process.exit(0);
}

for (const run of runs) {
  const latency = run.summary.latency;
  console.log(
    [
      run.id,
      `system=${run.system}`,
      `meanWer=${run.summary.meanWer.toFixed(4)}`,
      latency
        ? `latency(mean/p50/p95)=${latency.meanMs.toFixed(0)}/${latency.p50Ms.toFixed(0)}/${latency.p95Ms.toFixed(0)}ms`
        : "latency=n/a",
      `commit=${run.git.commit?.slice(0, 8) ?? "none"}`,
      `tag=${run.git.tag ?? "none"}`,
      run.note,
    ].join(" | "),
  );
}
