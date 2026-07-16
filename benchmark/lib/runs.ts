import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  latencyStats,
  type ASR,
  type BenchmarkResult,
  type LatencyStats,
} from "../../asr/asr";

export type RunGitInfo = {
  commit: string | null;
  dirty: boolean;
  tag: string | null;
};

export type RunMeta = {
  id: string;
  system: string;
  createdAt: string;
  note: string;
  git: RunGitInfo;
  summary: {
    samples: number;
    meanWer: number;
    latency: LatencyStats;
  };
};

export type SavedRun = {
  id: string;
  dir: string;
  meta: RunMeta;
};

const RESULTS_DIR = "benchmark/results";

function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function runId(system: string, createdAt: Date) {
  const stamp = createdAt
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z")
    .replace("T", "-")
    .replace("Z", "");
  return `${stamp}-${slug(system)}`;
}

function meanWer(results: BenchmarkResult[]) {
  if (results.length === 0) return 0;
  return results.reduce((sum, r) => sum + r.wer, 0) / results.length;
}

function formatMs(ms: number) {
  return `${ms.toFixed(0)}ms`;
}

async function git(args: string[]) {
  const proc = Bun.spawn(["git", ...args], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { ok: exitCode === 0, stdout: stdout.trim(), stderr: stderr.trim() };
}

async function captureGit(runIdValue: string): Promise<RunGitInfo> {
  const head = await git(["rev-parse", "HEAD"]);
  if (!head.ok) {
    return { commit: null, dirty: true, tag: null };
  }

  const dirty = await git(["status", "--porcelain"]);
  const tagName = `benchmark/${runIdValue}`;
  const tag = await git(["tag", "-a", tagName, "-m", `benchmark run ${runIdValue}`]);

  return {
    commit: head.stdout,
    dirty: dirty.ok && dirty.stdout.length > 0,
    tag: tag.ok ? tagName : null,
  };
}

export async function saveRun(options: {
  system: ASR;
  results: BenchmarkResult[];
  note: string;
}): Promise<SavedRun> {
  const createdAt = new Date();
  const id = runId(options.system.id, createdAt);
  const dir = join(RESULTS_DIR, id);
  await mkdir(dir, { recursive: true });

  const gitInfo = await captureGit(id);
  const latency = latencyStats(options.results);
  const meta: RunMeta = {
    id,
    system: options.system.id,
    createdAt: createdAt.toISOString(),
    note: options.note,
    git: gitInfo,
    summary: {
      samples: options.results.length,
      meanWer: meanWer(options.results),
      latency,
    },
  };

  await Bun.write(join(dir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
  await Bun.write(join(dir, "results.json"), JSON.stringify(options.results, null, 2) + "\n");
  await Bun.write(
    join(dir, "NOTES.md"),
    `# ${id}\n\n` +
      `- **System:** ${meta.system}\n` +
      `- **Created:** ${meta.createdAt}\n` +
      `- **Mean WER:** ${meta.summary.meanWer.toFixed(4)}\n` +
      `- **Samples:** ${meta.summary.samples}\n` +
      `- **Latency total:** ${formatMs(latency.totalMs)}\n` +
      `- **Latency mean / p50 / p95:** ${formatMs(latency.meanMs)} / ${formatMs(latency.p50Ms)} / ${formatMs(latency.p95Ms)}\n` +
      `- **Latency min / max:** ${formatMs(latency.minMs)} / ${formatMs(latency.maxMs)}\n` +
      `- **Git commit:** ${meta.git.commit ?? "none"}\n` +
      `- **Git tag:** ${meta.git.tag ?? "none"}\n` +
      `- **Dirty tree:** ${meta.git.dirty}\n\n` +
      `## What was tested\n\n${options.note.trim()}\n`,
  );

  await updateIndex(meta);
  return { id, dir, meta };
}

async function updateIndex(meta: RunMeta) {
  const indexPath = join(RESULTS_DIR, "index.json");
  const existing = (await Bun.file(indexPath).exists())
    ? ((await Bun.file(indexPath).json()) as RunMeta[])
    : [];
  const next = [meta, ...existing.filter((entry) => entry.id !== meta.id)];
  await Bun.write(indexPath, JSON.stringify(next, null, 2) + "\n");
}

export async function listRuns(): Promise<RunMeta[]> {
  const indexPath = join(RESULTS_DIR, "index.json");
  if (!(await Bun.file(indexPath).exists())) return [];
  return Bun.file(indexPath).json();
}

export async function loadRun(id: string): Promise<SavedRun> {
  const dir = join(RESULTS_DIR, id);
  const metaPath = join(dir, "meta.json");
  if (!(await Bun.file(metaPath).exists())) {
    throw new Error(`Unknown run: ${id}`);
  }
  const meta = (await Bun.file(metaPath).json()) as RunMeta;
  return { id, dir, meta };
}

/** Open a git worktree at the commit/tag recorded for this run. */
export async function revisitRun(id: string, worktreesRoot = ".worktrees") {
  const run = await loadRun(id);
  const ref = run.meta.git.tag ?? run.meta.git.commit;
  if (!ref) {
    throw new Error(
      `Run ${id} has no git commit/tag. Commit your code, re-run the benchmark, then revisit.`,
    );
  }

  const path = join(worktreesRoot, id);
  await mkdir(worktreesRoot, { recursive: true });
  const result = await git(["worktree", "add", path, ref]);
  if (!result.ok) {
    throw new Error(result.stderr || `Failed to create worktree for ${ref}`);
  }
  return { path, ref, run };
}
