# CodeReplay — Delivery Notes

Built from **Comprehensive Architectural.md** (spec + complete codebase + Cline/MCP
integration layer). This archive is the full, runnable project.

## What's inside

| Path | Contents |
| :--- | :--- |
| `src/engine/` | Git subprocess wrapper, schema-validated manifest loader, replay session lifecycle (isolated `git worktree`, orphan branch, baseline snapshot, 1:1 verification) |
| `src/server/` | Express API + static UI server |
| `src/ui/` | Split-screen web UI: step navigator, Monaco diff viewer, Markdown + Mermaid + KaTeX panel |
| `src/cli.ts` | `init` / `verify` / `serve` / `list` / `clean` + `mcp serve` / `mcp probe` / `mcp install` |
| `src/mcp/` | MCP 2024-11-05 server (stdio, JSON-RPC 2.0) exposing 6 `codereplay_*` tools, client, connectivity probe, Cline installer |
| `schema/` | `codereplay-v2.1.schema.json` — the immutable data contract (`content` snapshots supersede `patch`, per spec §6.1) |
| `orchestrator/` | Outer AI layer: `compile.py` using OpenAI Structured Outputs |
| `tests/` | Unit (protocol, tools) + integration (stdio, workflow) + Cline probe suites |
| `examples/` | Illustrative 3-step manifest |
| `.clinerules`, `CLINE-INTEGRATION.md` | Cline workflow instructions + integration standard |

## Verification performed on this build

- `npm run build` — compiles clean (`tsc`, strict, NodeNext).
- `npm test` — **27/27 tests pass** across 5 suites (unit, integration, probe).
- `npm run test:probe` — **FULLY CONNECTED: 15/15 hard checks**, including the
  end-to-end `scan → read → validate → write → verify` byte-for-byte reconstruction.
- CLI end-to-end on a demo repo:
  - FULL scope: 4-step replay (CREATE / MODIFY / multi-file / RENAME) verified 1:1;
    `git log --stat` on the replay branch shows `src/{ => lib}/greet.js | 0` (pure
    rename, zero line churn).
  - PARTIAL scope (`src/` only): baseline = repo minus scoped paths, verified 1:1.
  - Negative case: a corrupted manifest is **rejected** with the byte diff saved to
    `.codereplay/sessions/<uuid>/verification-failure.diff`.
  - `init` serves the UI at `http://localhost:4545`; `/api/session`,
    `/api/steps/:id`, `/api/steps/:id/patch` (with native `diff-tree -M` rename
    detection) all respond correctly.
  - `clean --all` removes every session, worktree, and branch.

## Deviations from the spec document (2 minimal fixes)

The spec's code as written does not compile with current TypeScript. Two surgical
fixes were applied; behavior is unchanged:

1. **`src/engine/manifest.ts` + `src/mcp/tools.ts` — ajv import interop.**
   TypeScript ≥ 5.6 under `moduleResolution: NodeNext` types the CJS *default*
   exports of `ajv` / `ajv-formats` as the module namespace, so
   `import Ajv from 'ajv'` / `import addFormats from 'ajv-formats'` fail with
   TS2351/TS2349 on TS 5.9 (they compile on TS 5.5.4). Fixed with the named
   import `import { Ajv } from 'ajv'` (exported by every ajv 8.x) and a typed
   `FormatsPlugin` shim for `ajv-formats`, which compiles identically on
   TS 5.5 through 5.9+.

2. **`src/mcp/tools.ts` — `codereplay_scan` ENOENT guard.**
   The spec's own test ("returns isError for a non-git directory") crashes the
   handler: `spawn('git', …, { cwd: <nonexistent> })` rejects with ENOENT, so the
   handler throws — violating Tool Standard #5 ("handlers never throw"). The
   spawn is now guarded and degrades to an `isError` result, making the
   spec's test suite pass as written.

## Quick start

```bash
npm install
npm run build
npm test                 # 27/27
npm run test:probe       # 15/15 hard checks

# Point at any git repo + a manifest:
node dist/cli.js verify --manifest codereplay.json --repo /path/to/repo
node dist/cli.js init   --manifest codereplay.json --repo /path/to/repo   # UI on :4545
```

Layer 4 (Cline's LLM actually invoking the tools) requires a live VS Code —
see `CLINE-INTEGRATION.md` for the manual smoke test. Layers 1–3 are proven
deterministically by the probe.
