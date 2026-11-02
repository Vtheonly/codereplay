import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { Ajv } from 'ajv';
import { git } from '../engine/git.js';
import { loadManifest } from '../engine/manifest.js';
import { initSession, cleanSession } from '../engine/session.js';
import { languageFromPath } from '../engine/language.js';
import type { McpToolResult } from './protocol.js';
import { textResult, errorResult } from './protocol.js';

export interface ToolContext {
  cwd: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: unknown, ctx: ToolContext) => Promise<McpToolResult>;
}

const ajv = new Ajv({ allErrors: true, strict: false, coerceTypes: false });

function validate(tool: ToolDefinition, input: unknown):
  { ok: true } | { ok: false; errors: string[] } {
  const v = ajv.compile(tool.inputSchema);
  if (v(input)) return { ok: true };
  return {
    ok: false,
    errors: (v.errors ?? []).map((e) => `${e.instancePath || '/'}: ${e.message}`),
  };
}

async function* walk(dir: string): AsyncIterable<string> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (e.name === '.git' || e.name === '.codereplay' || e.name === 'node_modules') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.isFile()) yield full;
  }
}

// ---------------------------------------------------------------------------
// Tool 1: codereplay_scan
// ---------------------------------------------------------------------------

const scanTool: ToolDefinition = {
  name: 'codereplay_scan',
  description:
    'Inspect a git repository and return a file inventory for the requested scope. ' +
    'Use this FIRST to decide which files to read and whether the scope should be FULL or PARTIAL.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['repo'],
    properties: {
      repo: { type: 'string', description: 'Path to the git repository' },
      paths: {
        type: 'array',
        items: { type: 'string' },
        default: ['.'],
        description: 'Scoped paths. Use ["."] for the whole repo, or subpaths for PARTIAL scope.',
      },
      max_file_size_kb: { type: 'integer', minimum: 1, default: 1024 },
    },
  },
  async handler(input, ctx) {
    const v = validate(scanTool, input);
    if (!v.ok) return errorResult(`Invalid arguments: ${v.errors.join('; ')}`);
    const args = input as { repo: string; paths?: string[]; max_file_size_kb?: number };
    const repo = isAbsolute(args.repo) ? args.repo : resolve(ctx.cwd, args.repo);
    const paths = args.paths ?? ['.'];
    const maxBytes = (args.max_file_size_kb ?? 1024) * 1024;

    // Guard the spawn itself: a non-existent cwd makes spawn() reject with
    // ENOENT. Handlers must never throw — degrade to an isError result.
    let headResult: Awaited<ReturnType<typeof git>>;
    try {
      headResult = await git(repo, ['rev-parse', 'HEAD']);
    } catch (e) {
      return errorResult(`Not a git repository with commits: ${repo} (${(e as Error).message})`);
    }
    if (headResult.code !== 0) {
      return errorResult(`Not a git repository with commits: ${repo} (${headResult.stderr.trim()})`);
    }
    const head = headResult.stdout.trim();

    const files: Array<{ path: string; size: number; language: string }> = [];
    for (const p of paths) {
      const abs = isAbsolute(p) ? p : join(repo, p);
      if (!existsSync(abs)) continue;
      const st = await stat(abs);
      if (st.isFile()) {
        if (st.size > maxBytes) continue;
        files.push({
          path: relative(repo, abs).replace(/\\/g, '/'),
          size: st.size,
          language: languageFromPath(abs),
        });
      } else if (st.isDirectory()) {
        for await (const f of walk(abs)) {
          try {
            const s = await stat(f);
            if (s.size > maxBytes) continue;
            files.push({
              path: relative(repo, f).replace(/\\/g, '/'),
              size: s.size,
              language: languageFromPath(f),
            });
          } catch { /* skip */ }
        }
      }
    }

    const suggested = paths.length === 1 && paths[0] === '.' ? 'FULL' : 'PARTIAL';
    return textResult({
      repo,
      git_head: head,
      files,
      total_files: files.length,
      total_bytes: files.reduce((s, f) => s + f.size, 0),
      suggested_scope_type: suggested,
    });
  },
};

// ---------------------------------------------------------------------------
// Tool 2: codereplay_read_file
// ---------------------------------------------------------------------------

const readFileTool: ToolDefinition = {
  name: 'codereplay_read_file',
  description:
    'Read a single file from the repository. Returns the file content and total line count. ' +
    'Pass start_line/end_line (1-based, inclusive) to read a slice.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['repo', 'path'],
    properties: {
      repo: { type: 'string' },
      path: { type: 'string', description: 'Repo-relative file path' },
      start_line: { type: 'integer', minimum: 1 },
      end_line: { type: 'integer', minimum: 1 },
    },
  },
  async handler(input, ctx) {
    const v = validate(readFileTool, input);
    if (!v.ok) return errorResult(`Invalid arguments: ${v.errors.join('; ')}`);
    const args = input as { repo: string; path: string; start_line?: number; end_line?: number };
    const repo = isAbsolute(args.repo) ? args.repo : resolve(ctx.cwd, args.repo);
    const target = join(repo, args.path);
    const rel = relative(repo, target);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      return errorResult(`Refusing to read outside repo: ${args.path}`);
    }
    if (!existsSync(target)) return errorResult(`File not found: ${args.path}`);

    const raw = await readFile(target, 'utf8');
    const lines = raw.split('\n');
    const total = lines.length;
    const start = args.start_line ?? 1;
    const end = args.end_line ?? total;
    if (start < 1 || end < start || start > total) {
      return errorResult(`Invalid line range ${start}..${end} (file has ${total} lines)`);
    }
    const slice = lines.slice(start - 1, end).join('\n');
    return textResult({
      path: args.path,
      total_lines: total,
      start_line: start,
      end_line: end,
      content: slice,
    });
  },
};

// ---------------------------------------------------------------------------
// Tool 3: codereplay_read_files
// ---------------------------------------------------------------------------

const readFilesTool: ToolDefinition = {
  name: 'codereplay_read_files',
  description: 'Batch-read multiple files in a single call. Prefer this over repeated read_file calls.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['repo', 'paths'],
    properties: {
      repo: { type: 'string' },
      paths: { type: 'array', items: { type: 'string' } },
    },
  },
  async handler(input, ctx) {
    const v = validate(readFilesTool, input);
    if (!v.ok) return errorResult(`Invalid arguments: ${v.errors.join('; ')}`);
    const args = input as { repo: string; paths: string[] };
    const repo = isAbsolute(args.repo) ? args.repo : resolve(ctx.cwd, args.repo);
    const files: Array<{ path: string; content: string | null; error?: string }> = [];
    for (const p of args.paths) {
      const target = join(repo, p);
      const rel = relative(repo, target);
      if (rel.startsWith('..') || isAbsolute(rel)) {
        files.push({ path: p, content: null, error: 'path outside repo' });
        continue;
      }
      try {
        files.push({ path: p, content: await readFile(target, 'utf8') });
      } catch (e) {
        files.push({ path: p, content: null, error: (e as Error).message });
      }
    }
    return textResult({ files });
  },
};

// ---------------------------------------------------------------------------
// Tool 4: codereplay_validate_manifest
// ---------------------------------------------------------------------------

const validateManifestTool: ToolDefinition = {
  name: 'codereplay_validate_manifest',
  description:
    'Validate a candidate codereplay.json against the v2.1 schema. ALWAYS call this before ' +
    'codereplay_write_manifest. Returns { valid, errors?, warnings? }.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['manifest'],
    properties: {
      manifest: {
        description: 'The manifest as a JSON string or an object.',
        oneOf: [{ type: 'string' }, { type: 'object' }],
      },
    },
  },
  async handler(input, ctx) {
    const v = validate(validateManifestTool, input);
    if (!v.ok) return errorResult(`Invalid arguments: ${v.errors.join('; ')}`);
    const args = input as { manifest: string | object };
    const raw = typeof args.manifest === 'string'
      ? args.manifest
      : JSON.stringify(args.manifest);

    // Write to a temp file and reuse the canonical loader
    const tmp = join(ctx.cwd, `.codereplay-validate-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    try {
      await writeFile(tmp, raw, 'utf8');
      const manifest = await loadManifest(tmp);
      const warnings: string[] = [];
      if (manifest.spec_version !== '2.1') {
        warnings.push(`spec_version is "${manifest.spec_version}", expected "2.1"`);
      }
      return textResult({ valid: true, warnings: warnings.length ? warnings : undefined });
    } catch (e) {
      return textResult({ valid: false, errors: [(e as Error).message] });
    } finally {
      try { await (await import('node:fs/promises')).unlink(tmp); } catch { /* ignore */ }
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 5: codereplay_write_manifest
// ---------------------------------------------------------------------------

const writeManifestTool: ToolDefinition = {
  name: 'codereplay_write_manifest',
  description:
    'Validate and persist a manifest to disk. Refuses to write an invalid manifest.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['manifest'],
    properties: {
      manifest: { oneOf: [{ type: 'string' }, { type: 'object' }] },
      path: { type: 'string', description: 'Output path (default: ./codereplay.json in cwd)' },
    },
  },
  async handler(input, ctx) {
    const v = validate(writeManifestTool, input);
    if (!v.ok) return errorResult(`Invalid arguments: ${v.errors.join('; ')}`);
    const args = input as { manifest: string | object; path?: string };
    const raw = typeof args.manifest === 'string'
      ? args.manifest
      : JSON.stringify(args.manifest, null, 2);

    // Validate first — reject invalid manifests
    const tmp = join(ctx.cwd, `.codereplay-validate-${Date.now()}.json`);
    try {
      await writeFile(tmp, raw, 'utf8');
      await loadManifest(tmp);
    } catch (e) {
      return errorResult(`Refusing to write invalid manifest: ${(e as Error).message}`);
    } finally {
      try { await (await import('node:fs/promises')).unlink(tmp); } catch { /* ignore */ }
    }

    const target = args.path
      ? (isAbsolute(args.path) ? args.path : resolve(ctx.cwd, args.path))
      : join(ctx.cwd, 'codereplay.json');
    await (await import('node:fs/promises')).mkdir(dirname(target), { recursive: true });
    await writeFile(target, raw, 'utf8');
    return textResult({ path: target, bytes: Buffer.byteLength(raw, 'utf8') });
  },
};

// ---------------------------------------------------------------------------
// Tool 6: codereplay_verify
// ---------------------------------------------------------------------------

const verifyTool: ToolDefinition = {
  name: 'codereplay_verify',
  description:
    'Run the full replay pipeline against a manifest and prove the reconstruction is 1:1 ' +
    'against the target commit. Cleans up the temporary worktree afterward. ' +
    'ALWAYS call this after write_manifest to prove correctness before declaring done.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['repo', 'manifest_path'],
    properties: {
      repo: { type: 'string' },
      manifest_path: { type: 'string' },
    },
  },
  async handler(input, ctx) {
    const v = validate(verifyTool, input);
    if (!v.ok) return errorResult(`Invalid arguments: ${v.errors.join('; ')}`);
    const args = input as { repo: string; manifest_path: string };
    const repo = isAbsolute(args.repo) ? args.repo : resolve(ctx.cwd, args.repo);
    const manifest = isAbsolute(args.manifest_path) ? args.manifest_path : resolve(ctx.cwd, args.manifest_path);

    try {
      const state = await initSession({ repo, manifestPath: manifest });
      try {
        return textResult({
          verified: true,
          steps: state.steps.length,
          session_id: state.uuid,
          target_sha: state.target_sha,
          scope_type: state.scope_type,
        });
      } finally {
        await cleanSession(repo, state.uuid);
      }
    } catch (e) {
      return textResult({ verified: false, error: (e as Error).message });
    }
  },
};

export const TOOLS: ToolDefinition[] = [
  scanTool,
  readFileTool,
  readFilesTool,
  validateManifestTool,
  writeManifestTool,
  verifyTool,
];

export function findTool(name: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.name === name);
}
