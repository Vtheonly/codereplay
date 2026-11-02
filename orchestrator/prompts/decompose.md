# Decompose Prompt (reference)

You are given a scoped set of source files from a git repository at a specific commit.
Your task: emit a **CodeReplay Manifest v2.1** that rebuilds those files.

## Narrative arc
1. **Scaffold first** — package manifests, configs, READMEs.
2. **Leaf abstractions next** — pure functions, types, models, utilities.
3. **Composition third** — modules that import the leaf abstractions.
4. **Wiring last** — entrypoints, routes, DI containers, tests.

## Hard rules
- Never split a function across steps.
- Every step must produce a codebase that type-checks / compiles as far as the scope allows.
- Use `content` (full snapshot) for every CREATE or MODIFY. Do **not** invent patches.
- Use `RENAME` with `old_path` for moves; omit `content` to preserve bytes.
- Emit `explanation.markdown`, and optionally `explanation.diagram` (Mermaid) and `explanation.math` (LaTeX).
- Every file in the scope must be created exactly once.

## Verification
The runner will diff your replay against the target commit's tree.
If the trees differ by a single byte, the manifest is rejected.
