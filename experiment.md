# Experiments

How we run R&D benchmarks, pin code, and revisit old runs.

## Mental model

| What | Where |
| --- | --- |
| Code changes | Normal git commits on feature/experiment branches |
| Hyperparams (model, prompt, …) | Run `meta.json` → `params` (and constructor args) |
| Metrics / transcripts | `benchmark/results/<run-id>/` |
| “Show me the code for run X” | Git SHA / tag on that run → worktree |

We do **not** keep forever-copies like `OpenAIASR_v2_final.ts`. One evolving codebase; git is the archive of variants. We do **not** use a special branch where every commit is a benchmark run — results are data, code is git.

## Workflow

### 1. Change something

Edit the ASR (or other) implementation, or change params passed into it.

Use short-lived branches when exploring in parallel:

```bash
git switch -c exp/asr-domain-prompt
```

### 2. Commit the code

Official runs should point at a **clean** commit so revisit is trustworthy.

```bash
git add -A
git commit -m "asr: add domain prompt for product names"
```

If you run with a dirty tree, `meta.json` still records `git.dirty: true`. The tag/commit will **not** include uncommitted edits — treat that run as unofficial.

### 3. Run the benchmark

```bash
bun benchmark/sstBenchmark.ts --note "OpenAI ASR bakeoff"
```

`--note` is free text: hypothesis, what changed, what you’re comparing. It lands in `NOTES.md` and `meta.note`.

This saves one run per OpenAI transcription model under `benchmark/results/`, updates `benchmark/results/index.json`, and (when git allows) creates an annotated tag `benchmark/<run-id>` at `HEAD`.

### 4. Browse history

```bash
bun benchmark/list-runs.ts
```

Open a run folder for details:

```text
benchmark/results/<run-id>/
  meta.json       # identity, git pin, summary, params
  results.json    # per-sample WER, latency, transcript
  NOTES.md        # human-readable write-up
```

### 5. Revisit the code that produced a run

```bash
bun benchmark/revisit.ts <run-id>
```

That creates a git worktree at `.worktrees/<run-id>` checked out to the run’s tag (or commit). Your main working tree stays put.

```bash
cd .worktrees/<run-id>
# inspect / re-run against that exact code
```

Remove when done:

```bash
git worktree remove .worktrees/<run-id>
```

If `meta.git.commit` / `tag` is null, revisit can’t work — commit first, then re-run.

## `meta.json`

Example shape (fields marked *planned* may not be written by the saver yet; use them as the convention when extending runs):

```json
{
  "id": "20260716-171200Z-openai-gpt-4o-transcribe",
  "system": "openai-gpt-4o-transcribe",
  "createdAt": "2026-07-16T17:12:00.000Z",
  "note": "OpenAI ASR bakeoff\n\nModel: gpt-4o-transcribe",
  "git": {
    "commit": "89d75acefacb8dd4c8a69cf646498d5406a8f99f",
    "dirty": false,
    "tag": "benchmark/20260716-171200Z-openai-gpt-4o-transcribe"
  },
  "params": {
    "provider": "openai",
    "model": "gpt-4o-transcribe",
    "prompt": null,
    "language": null,
    "suite": "asr",
    "dataset": {
      "labelsPath": "benchmark/labels.json",
      "samplesDir": "benchmark/samples"
    }
  },
  "summary": {
    "samples": 12,
    "meanWer": 0.0424,
    "latency": {
      "totalMs": 18420,
      "meanMs": 1535,
      "p50Ms": 1420,
      "p95Ms": 2100,
      "minMs": 900,
      "maxMs": 2400
    }
  }
}
```

### Field guide

| Field | Meaning |
| --- | --- |
| `id` | Stable run id (`timestamp` + system slug). Folder name under `results/`. |
| `system` | Implementation id from `ASR.id` (e.g. `openai-gpt-4o-transcribe`). |
| `createdAt` | When the run was saved (ISO UTC). |
| `note` | Why you ran it — hypothesis / changelog in prose. |
| `git.commit` | `HEAD` SHA at save time. Pin for revisit. |
| `git.tag` | Annotated tag `benchmark/<id>` if tagging succeeded. |
| `git.dirty` | `true` if there were uncommitted changes — code pin is incomplete. |
| `params` | *Convention:* knobs that aren’t “new source files” — model, prompt, language, suite, dataset paths/version. Same commit + different params = valid distinct runs. |
| `summary.meanWer` | Average word error rate over samples. |
| `summary.latency` | Aggregate latency (`total` / `mean` / `p50` / `p95` / `min` / `max` in ms). |

### What belongs in `params` vs git

- **git commit** — logic changes (WER math, retry/backoff, new preprocessing, API wiring).
- **`params`** — model name, prompt string, temperature, language hint, feature flags, dataset pointer.

If two experiments only differ by prompt or model, prefer one commit and two runs with different `params`, not two class files.

## Rules of thumb

1. Commit code before an official bakeoff; keep the tree clean.
2. Always pass a meaningful `--note`.
3. Compare systems via `list-runs` + `results.json`, not by eyeballing the terminal.
4. Revisit with `revisit.ts` / worktrees — never by copying old files back into `main` by hand.
5. Grow suites under `benchmark/` (e.g. ASR today; TTS / e2e later) with the same results + meta conventions.
