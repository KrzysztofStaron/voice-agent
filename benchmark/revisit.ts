import { revisitRun } from "./lib/runs";

const id = process.argv[2];
if (!id) {
  console.error("Usage: bun benchmark/revisit.ts <run-id>");
  process.exit(1);
}

const { path, ref, run } = await revisitRun(id);
console.log(`opened worktree for ${run.id}`);
console.log(`  ref: ${ref}`);
console.log(`  path: ${path}`);
console.log(`  note: ${run.meta.note}`);
console.log(`\ncd ${path}`);
