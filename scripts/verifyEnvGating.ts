// scripts/verifyEnvGating.ts
// Codifies the env-gating verification for the diagnostic tracing
// infrastructure (src/lib/finalRotaTrace.ts). Run after any change
// to the trace module or its call-sites in finalRotaConstruction.ts:
//
//   npx tsx scripts/verifyEnvGating.ts
//
// Asserts: when ROTAGEN_TRACE is unset, runAlgorithm.ts does NOT
// write to the trace output path. Distinguishes absence (file did
// not exist before AND does not exist after) from no-change (file
// existed before AND its mtime is unchanged after) — the second
// case lets the verification run safely after a diagnostic session
// has already produced /tmp/rotagen_trace.jsonl, without deleting
// the artefact.
//
// Why this matters: the prior gate-4 pattern was
//   `rm -f /tmp/rotagen_trace.jsonl ; npx tsx scripts/runAlgorithm.ts ; test -f ...`
// which deletes the trace file as a side-effect. That meant any
// subsequent diagnostic analysis session had to regenerate the
// trace before proceeding (ROTAGEN_TRACE=1 ...). The absence-check
// version preserves the file across verification.
//
// Exit codes:
//   0 — gate passes (file absent OR present-and-unchanged after run)
//   1 — gate fails (file appeared, or its mtime changed)

import * as fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const TRACE_PATH =
  process.env.ROTAGEN_TRACE_OUTPUT ?? '/tmp/rotagen_trace.jsonl';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const RUN_ALGO_PATH = path.resolve(SCRIPT_DIR, 'runAlgorithm.ts');

interface FileSnapshot {
  exists: boolean;
  mtimeMs: number | null;
  size: number | null;
}

function snapshot(p: string): FileSnapshot {
  try {
    const s = fs.statSync(p);
    return { exists: true, mtimeMs: s.mtimeMs, size: s.size };
  } catch {
    return { exists: false, mtimeMs: null, size: null };
  }
}

function describe(s: FileSnapshot): string {
  if (!s.exists) return 'absent';
  return `present (size=${s.size}, mtime=${new Date(s.mtimeMs!).toISOString()})`;
}

function main(): void {
  console.log('=== verifyEnvGating ===');
  console.log(`Trace path: ${TRACE_PATH}`);
  console.log(`runAlgorithm path: ${RUN_ALGO_PATH}`);
  console.log();

  const before = snapshot(TRACE_PATH);
  console.log(`Pre-run state:  ${describe(before)}`);

  // Build a child env that explicitly OMITS ROTAGEN_TRACE. Copying
  // process.env preserves PATH and other essentials; deleting the
  // var ensures we're testing the unset case, not whatever the
  // current shell happens to have.
  const childEnv = { ...process.env };
  delete childEnv.ROTAGEN_TRACE;

  // Run runAlgorithm.ts via tsx in a child process. Inherit stdio so
  // any errors surface; redirect stdout to /dev/null equivalent by
  // capturing it (we don't print the report — we only care about the
  // gating side-effect).
  const result = spawnSync(
    'npx',
    ['tsx', RUN_ALGO_PATH],
    {
      env: childEnv,
      cwd: path.resolve(SCRIPT_DIR, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
    },
  );

  if (result.status !== 0) {
    console.error(`runAlgorithm.ts exited with code ${result.status}`);
    if (result.stderr) console.error('stderr:', result.stderr.slice(0, 500));
    console.error('Cannot complete env-gating check.');
    process.exit(1);
  }

  const after = snapshot(TRACE_PATH);
  console.log(`Post-run state: ${describe(after)}`);
  console.log();

  // Three pass cases, one fail case:
  //   PASS — file was absent before AND is absent after.
  //   PASS — file was present before AND is present after with same mtime + size.
  //   PASS — file was present before AND is present after with same mtime (size check
  //          covers the rare clock-rollback case).
  //   FAIL — anything else.
  let passed: boolean;
  let reason: string;
  if (!before.exists && !after.exists) {
    passed = true;
    reason = 'trace file absent before and after — gate intact';
  } else if (before.exists && !after.exists) {
    passed = false;
    reason = 'trace file existed before but not after — runAlgorithm or another process deleted it';
  } else if (!before.exists && after.exists) {
    passed = false;
    reason = 'trace file appeared during run with ROTAGEN_TRACE unset — env-gating broken';
  } else {
    // both exist
    const mtimeMatches = before.mtimeMs === after.mtimeMs;
    const sizeMatches = before.size === after.size;
    if (mtimeMatches && sizeMatches) {
      passed = true;
      reason = 'trace file unchanged across run (mtime + size match) — gate intact';
    } else {
      passed = false;
      reason = `trace file modified during run (mtime ${mtimeMatches ? 'unchanged' : 'changed'}, size ${sizeMatches ? 'unchanged' : 'changed'}) — env-gating broken`;
    }
  }

  if (passed) {
    console.log(`GATE PASS — ${reason}`);
    process.exit(0);
  } else {
    console.error(`GATE FAIL — ${reason}`);
    process.exit(1);
  }
}

main();
