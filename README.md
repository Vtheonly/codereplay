# CodeReplay

Deterministic, Git-native replay engine for AI-generated codebases.

CodeReplay solves **AI-Induced Code Blindness**: it reconstructs an opaque codebase into a chronological, byte-for-byte-verified sequence of pedagogical commits that a developer can actually understand.

## Architecture at a glance

```
┌─────────────────────────┐
│  Outer AI Layer         │  orchestrator/compile.py
│  (Structured Outputs)   │  → emits codereplay.json
└──────────┬──────────────┘
           │  manifest (v2.1)
           ▼
┌─────────────────────────┐
│  Core Replay Engine     │  src/engine/, src/server/
│  AI-free, deterministic │  → real git commits + web UI
└─────────────────────────┘
```

## Guarantees

- **Deterministic:** zero AI at runtime. Zero network calls.
- **Verified:** the replay tip must `git diff --exit-code` against the target commit or the whole manifest is rejected.
- **Isolated:** every session lives in its own `git worktree` — your working tree is never touched.
- **Semantic:** uses `git diff-tree -M -C --color-moved=zebra` for rename and code-move detection.
- **Rich:** renders Markdown, Mermaid diagrams, and KaTeX math natively.

## Quick start

```bash
# 1. Install
git clone <this repo> codereplay && cd codereplay
npm install
npm run build

# 2. Generate a manifest from any repo (needs OPENAI_API_KEY)
python orchestrator/compile.py \
  --repo /path/to/target-repo \
  --paths src/services/billing/ \
  --name "Billing Service" \
  --out /tmp/codereplay.json

# 3. Launch the replay
node dist/cli.js init \
  --manifest /tmp/codereplay.json \
  --repo /path/to/target-repo
```

The browser opens to `http://localhost:4545`. Use `←`/`→` to navigate.

## CLI

| Command                          | Purpose                                                        |
| :------------------------------- | :------------------------------------------------------------- |
| `codereplay init --manifest <p>` | Compile a manifest into a session and launch the UI.          |
| `codereplay verify --manifest <p>` | Dry-run the whole pipeline; exit 0 on verified, 1 on failure. |
| `codereplay serve --session <u>` | Serve an existing session.                                     |
| `codereplay list`                | List sessions in the current repo.                             |
| `codereplay clean --session <u>` | Delete a session and its worktree.                             |
| `codereplay clean --all`         | Delete all sessions.                                           |
| `codereplay mcp serve`           | Run the MCP server on stdio (what Cline launches).            |
| `codereplay mcp probe [--e2e]`   | Prove MCP protocol compliance + Cline connectivity.           |
| `codereplay mcp install`         | Register this server in Cline's MCP settings file.            |

## Manifest format (v2.1)

The **critical divergence** from the original spec (§5.1): `patch` is replaced by `content` (full file snapshot) for CREATE/MODIFY. See §6.1 of the spec — LLMs cannot reliably count line offsets, so letting *Git* compute the diff from full snapshots is 100% deterministic. `patch` remains supported as a fallback but is discouraged.

```json
{
  "spec_version": "2.1",
  "project_metadata": {
    "name": "…", "scope_type": "FULL|PARTIAL",
    "target_commit": "<40-char sha>", "scoped_paths": ["…"]
  },
  "steps": [{
    "step_id": 1, "title": "…", "commit_message": "…",
    "explanation": { "markdown": "…", "diagram": "<mermaid>", "math": ["<latex>"] },
    "code_changes": [
      { "path": "src/a.ts", "action": "CREATE|MODIFY", "content": "<full text>" },
      { "path": "src/b.ts", "action": "RENAME", "old_path": "src/a.ts" },
      { "path": "src/c.ts", "action": "DELETE" }
    ]
  }]
}
```

## How verification works

After replaying every step, the engine runs:

```bash
git -C <isolated-worktree> diff --exit-code HEAD <target_sha> -- <scoped_paths>
```

- **Exit 0** → the reconstruction is byte-identical to the target. Playback is unlocked.
- **Exit 1** → the diff is dumped to `.codereplay/sessions/<uuid>/verification-failure.diff` and the session aborts.

This is *cryptographic* verification: Git's SHA-1/SHA-256 tree hashing proves byte-equality.

## Vulnerability mitigations (§6 of spec)

| Spec §  | Vulnerability                            | Mitigation in this implementation                                            |
| :------ | :--------------------------------------- | :--------------------------------------------------------------------------- |
| **6.1** | LLM patch-line hallucination             | Manifest uses `content` (full snapshots); Git computes diffs.                |
| **6.2** | Destructive disk checkout                | Every session gets its own `git worktree` under `.codereplay/worktrees/`.   |
| **6.3** | Partial-scope dependency breakage        | Step-0 baseline = target tree **minus scoped files**, so intermediates compile. |
| **6.4** | Cline as a manifest compiler             | `orchestrator/compile.py` uses OpenAI Structured Outputs (`response_format`). |

## Data layout

```
<target-repo>/
└── .codereplay/
    ├── worktrees/<uuid>/    # isolated replay worktree (safe to delete)
    └── sessions/<uuid>/
        └── session.json     # session state
```

`.codereplay/` is auto-added to `.git/info/exclude` — your `.gitignore` is untouched.

## License

MIT.
