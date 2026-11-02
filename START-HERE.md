# CodeReplay — codebase + live-proof bundle (2026-11-03)

CodeReplay is a **deterministic, Git-native replay engine for AI-generated codebases**.
Its only input is a **manifest JSON (v2.1)** — which can come from a human, a chatbot,
or any AI pipeline. The engine itself contains zero AI and zero network calls: it
replays the manifest as real git commits in an isolated worktree and **cryptographically
verifies** (byte-for-byte `git diff`) that the reconstruction matches the target commit.
This bundle contains the full source code plus two end-to-end live proofs that a
chatbot can produce the tool's input directly.

## Layout

```
codereplay/                    ← the tool itself (TypeScript, 27/27 tests passing)
  src/engine/                  git worktrees, manifest compilation, session state
  src/mcp/                     MCP server + Cline installer + probe (protocol 2024-11-05)
  src/server/, src/ui/         replay website (localhost:4545, dark split-screen UI)
  src/cli.ts                   init / verify / serve / list / clean / mcp
  orchestrator/compile.py      Outer AI Layer reference (OpenAI structured outputs)
  schema/codereplay-v2.1.schema.json   ← the chatbot-facing contract
  examples/sample-manifest.json
  dist/                        prebuilt — runnable without compiling
  tests/                       27 tests (unit / integration / cline)

scripts/demo-target/           tiny git repo (HEAD b54ccd7) used as the replay target
  .git                         included — this is the exact commit the proofs verified
scripts/ai-compile/            the chatbot→tool pipeline scripts (rollup / handoff / reconcile)
  state/rollup.txt             the codebase rolled up into one text file (demo artifact)

download/chatbot-handoff/      PROOF 1 (2026-11-03): chatbot → JSON → tool, live
download/cline-test/           PROOF 2 (2026-11-02): real Cline extension + official
                               MCP client stack, 17/17 checks, byte-exact verification
```

## Quickstart

```bash
cd codereplay
npm install                        # dist/ is prebuilt; this only adds dependencies

# replay the chatbot-authored proof session (verified 1:1 against b54ccd7):
node dist/cli.js init \
  --manifest ../download/chatbot-handoff/chatbot-reconciled-manifest.json \
  --repo ../scripts/demo-target
# → website at http://localhost:4545 (←/→ to navigate steps)

# watch the tool REJECT a drifted chatbot manifest (the trust boundary):
node dist/cli.js verify \
  --manifest ../download/chatbot-handoff/chatbot-manifest.json \
  --repo ../scripts/demo-target     # exit 1: 3 files missing trailing newlines

# full test suite:
npx vitest run                      # 27/27

# Cline integration (register the MCP server in the real extension):
node dist/cli.js mcp install && node dist/cli.js mcp probe --e2e
```

## What the two proofs establish

1. **Chatbot handoff (any chatbot)** — a chat was given the rolled-up code text and
   returned a complete v2.1 manifest: structure 100% correct (3 steps, all files,
   correct target SHA, real explanations). Fed to the tool *verbatim*, it was
   accepted, replayed, and **rejected at byte verification** (3 trailing-newline
   drifts) — then, after the prescribed git-byte reconciliation (chatbot's structure
   and explanations kept 100%), **verified 1:1** and served on the website.
   Transcripts: `download/chatbot-handoff/chatbot-round{1,2,3}-raw.txt`.
2. **MCP direct input (Cline and any MCP chatbot)** — the real Cline VSIX
   (4.1.26) and the official `@modelcontextprotocol/sdk@1.29.0` client stack drove
   `scan → read_files → validate → write_manifest → verify` end-to-end:
   17/17 checks, 13,924-byte manifest, byte-exact reconstruction of cline@a6507a6,
   and a corrupted manifest correctly rejected. See `download/cline-test/TEST-REPORT.md`.

## Notes

- `codereplay/.git` was rebuilt fresh on 2026-11-03 (single commit `b548b87`) after a
  sandbox recycle dropped the original 3-commit history. All source, tests, and docs
  are intact and the suite passes 27/27. The replay-target repo `scripts/demo-target`
  kept its **original** history including the exact verified commit `b54ccd7`.
- `node_modules` is not included (run `npm install`); `dist/` is prebuilt so the CLI
  works immediately.
- `download/cline-test/cline-mcp-manifest.json` targets the public `cline/cline` repo
  (`git clone https://github.com/cline/cline` @ `a6507a6`) — clone it to reproduce
  that proof; the clone is not bundled here.
- Manifest input format: `codereplay/schema/codereplay-v2.1.schema.json`.
  Anyone (human or chatbot) who can emit that JSON can drive the tool.
