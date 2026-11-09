#!/usr/bin/env python3
"""
Compile a codebase into a CodeReplay v2.1 manifest using OpenAI Structured Outputs.

This is the 'Outer Layer'. It is deliberately decoupled from the runner:
its only responsibility is to emit a schema-valid codereplay.json.
"""
import argparse, json, subprocess, sys
from pathlib import Path
from openai import OpenAI

SCHEMA_PATH = Path(__file__).parent.parent / "schema" / "codereplay-v2.1.schema.json"

SYSTEM_PROMPT = """You are a pedagogical code architect. Your job is to decompose a codebase into an ordered sequence of reconstruction steps that, when replayed, rebuild the target tree BYTE-FOR-BYTE.

Rules you MUST follow:
1.  Each step is an atomic conceptual unit (a feature, layer, refactor, or test). Never slice a function mid-body.
2.  Multi-file steps are encouraged whenever a single concept touches multiple files.
3.  Every intermediate state must be syntactically coherent. Create dependencies before dependents (import order matters).
4.  Use `content` (full file snapshot) for CREATE and MODIFY. Do NOT invent `patch` diffs — LLMs miscount line offsets.
5.  Use `action: "RENAME"` with `old_path` for moves. Omit `content` when the file is moved unchanged.
6.  Explanations must be rich: Markdown narrative, optional Mermaid `diagram`, optional KaTeX `math` array.
7.  The final reconstructed tree MUST equal the target commit. The runner will cryptographically verify this and reject any manifest that fails.
8.  Every file inside the scoped paths that exists in the target must be created by exactly one step.
9.  `spec_version` must be exactly "2.1".
"""


def gather(repo: Path, scoped_paths: list[str]) -> tuple[str, list[str]]:
    """Return (concatenated_source, list_of_relative_paths)."""
    parts: list[str] = []
    seen: list[str] = []
    for sp in scoped_paths:
        p = repo / sp
        if p.is_file():
            rel = str(p.relative_to(repo)).replace("\\", "/")
            parts.append(f"\n=== FILE: {rel} ===\n{p.read_text()}")
            seen.append(rel)
        elif p.is_dir():
            for f in sorted(p.rglob("*")):
                if not f.is_file():
                    continue
                if ".git" in f.parts or ".codereplay" in f.parts:
                    continue
                rel = str(f.relative_to(repo)).replace("\\", "/")
                try:
                    parts.append(f"\n=== FILE: {rel} ===\n{f.read_text()}")
                    seen.append(rel)
                except UnicodeDecodeError:
                    continue  # skip binaries
    return "".join(parts), seen


def main() -> None:
    ap = argparse.ArgumentParser(description="Compile a repo into a CodeReplay manifest.")
    ap.add_argument("--repo", required=True, help="Path to the target git repository")
    ap.add_argument("--paths", nargs="+", required=True, help="Scoped paths (use '.' for full scope)")
    ap.add_argument("--name", required=True, help="Project name for the manifest")
    ap.add_argument("--out", default="codereplay.json", help="Output manifest path")
    ap.add_argument("--model", default="gpt-4o-2024-08-06", help="OpenAI model with structured-output support")
    args = ap.parse_args()

    repo = Path(args.repo).resolve()
    if not (repo / ".git").exists() and not subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "--git-dir"],
        capture_output=True,
    ).returncode == 0:
        print(f"error: {repo} is not a git repository", file=sys.stderr)
        sys.exit(1)

    head = subprocess.check_output(
        ["git", "-C", str(repo), "rev-parse", "HEAD"], text=True
    ).strip()

    scope_type = "FULL" if args.paths == ["."] else "PARTIAL"
    scoped = [p.strip("./") or "." for p in args.paths]
    code, file_list = gather(repo, scoped)
    schema = json.loads(SCHEMA_PATH.read_text())

    user_prompt = f"""Project name: {args.name}
Target commit: {head}
Scope type: {scope_type}
Scoped paths: {args.paths}

Files in scope ({len(file_list)}):
{chr(10).join(' - ' + p for p in file_list)}

=== SOURCE ===
{code}

Produce the complete manifest. Every file listed above must appear in exactly one step's `code_changes` with action CREATE (or in a MODIFY/RENAME step). The final tree must byte-match {head} on the scoped paths.
"""

    client = OpenAI()
    resp = client.chat.completions.create(
        model=args.model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "codereplay_manifest",
                "strict": True,
                "schema": schema,
            },
        },
        temperature=0.2,
    )

    manifest = json.loads(resp.choices[0].message.content)
    # Authoritative overrides — never trust the model on facts we already know
    manifest["project_metadata"]["target_commit"] = head
    manifest["project_metadata"]["scope_type"] = scope_type
    manifest["project_metadata"]["scoped_paths"] = scoped

    Path(args.out).write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"✓ Wrote {args.out} with {len(manifest['steps'])} steps.")


if __name__ == "__main__":
    main()
