# Cline Integration Standard

This document defines precisely what "fully connected to Cline" means, and what
the `codereplay mcp probe` command verifies.

## Layer model

There are four layers. The probe can verify layers 1–3 automatically. Layer 4
requires a live VS Code instance and must be verified manually.

| Layer | What it is | Verified by |
| --- | --- | --- |
| **1. Protocol** | The MCP server correctly speaks JSON-RPC 2.0 / MCP 2024-11-05 | `probe` (hard), `tests/integration/stdio.test.ts` |
| **2. Tools** | Every tool has a valid `inputSchema` and a working handler | `probe` (hard), `tests/unit/tools.test.ts` |
| **3. Workflow** | `scan → read → validate → write → verify` reproduces the target byte-for-byte | `probe --e2e` (hard), `tests/integration/workflow.test.ts` |
| **4. Cline runtime** | Cline's LLM actually chooses to call the tools when prompted | **Manual** — see below |

## The probe (`codereplay mcp probe`)

Runs in an isolated fixture repo. Never touches your working tree. Exit code
is `0` iff every hard check passes.

### Hard checks (probe fails if any fail)

- `server:spawn` — server process starts
- `initialize` — handshake with a valid `protocolVersion`
- `capabilities.tools` — `tools` capability is declared
- `tools/list` — returns ≥1 tool; each tool has `{name, description, inputSchema}`
- `tool:<name>` — for every tool: valid MCP schema
- `tools/call:codereplay_scan` — returns an inventory
- `tools/call:codereplay_validate_manifest` — accepts a valid manifest
- `error:unknown_method` — returns `-32601`
- `error:malformed_json` — returns `-32700`
- *(opt-in `--e2e`)* `tools/call:codereplay_verify` — reconstructs the fixture

### Soft checks (probe warns but still succeeds)

- `cline:extension` — Cline extension installed under `~/.vscode/extensions/`
- `cline:mcp_config` — `codereplay` registered in `cline_mcp_settings.json`

## The standards

Any CodeReplay build that intends to ship with Cline support must satisfy all of:

### Protocol standards
1. Every message to stdout is a single line of valid JSON-RPC 2.0.
2. No non-JSON output is ever written to stdout (log to stderr only).
3. Unknown methods return `-32601`.
4. Malformed JSON returns `-32700` with `id: null`.
5. Missing/invalid parameters return `-32602`.
6. Errors raised inside a tool handler become tool results with `isError: true`, never JSON-RPC errors.
7. `notifications/initialized` is silently accepted (no response).

### Tool standards
1. Every tool name matches `^codereplay_[a-z_]+$`.
2. Every tool `description` is ≥ 20 characters (Cline rejects empty descriptions).
3. Every `inputSchema` has `type: 'object'` and a `properties` map.
4. Every `inputSchema` sets `additionalProperties: false` (rejects hallucinated fields).
5. Tool handlers never throw — they always return a `McpToolResult`.

### Workflow standards
1. A valid manifest written by `codereplay_write_manifest` must be accepted by `codereplay_verify`.
2. A manifest whose replay differs from the target MUST be rejected by `codereplay_verify` with `verified: false` and a non-empty `error`.
3. `codereplay_verify` must always clean up its temporary worktree and branch, whether verification succeeds or fails.

### Cline-specific standards
1. `.clinerules` must instruct the model to run the full six-step workflow.
2. `.clinerules` must forbid `patch` strings.
3. `codereplay mcp install` must produce an `mcpServers` entry with `disabled: false`.
4. The installer must auto-approve only the read-only tools (never `write_manifest` or `verify`).

## Manual verification (layer 4)

After installing:

```bash
codereplay mcp probe            # all hard checks must pass
codereplay mcp install          # register in Cline
codereplay mcp probe            # cline:mcp_config should now be [PASS]
```

Then, in Cline (VS Code sidebar):

1. Open **MCP Servers** → confirm `codereplay` is listed and green.
2. In a workspace that contains a `.git` directory, paste:

   > Use the codereplay tools to deconstruct the `src/` folder of this repo
   > into a manifest, validate it, write it to `./codereplay.json`, and run
   > verify. Report the final `verified` field.

3. Expected behavior: Cline calls `codereplay_scan`, then `codereplay_read_files`,
   then composes a manifest, then calls `codereplay_validate_manifest`, then
   `codereplay_write_manifest`, then `codereplay_verify`, and reports
   `"verified": true`.

If any of the steps are skipped or `verified` is `false`, the integration is
considered **not fully connected** — file a bug with the probe output.
