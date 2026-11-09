import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { readdir, readFile, mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import type { Readable, Writable } from 'node:stream';
import { McpClient, withTimeout } from './client.js';
import { gitOrThrow } from '../engine/git.js';
import type { JsonRpcResponse } from './protocol.js';

export type CheckStatus = 'pass' | 'fail' | 'warn';

export interface ProbeCheck {
  name: string;
  status: CheckStatus;
  detail: string;
  group: 'protocol' | 'cline' | 'e2e';
}

export interface ProbeReport {
  checks: ProbeCheck[];
  hard_failures: number;
  warnings: number;
  connected: boolean;
}

export interface SpawnedServer {
  proc: ChildProcess;
  stdin: Writable;
  stdout: Readable;
}

export interface ProbeOptions {
  cwd?: string;
  e2e?: boolean;
  spawnServer?: (cwd: string) => SpawnedServer;
}

// ---------------------------------------------------------------------------
// Default server spawner (re-executes the CLI's `mcp serve` command)
// ---------------------------------------------------------------------------

function resolveCliPath(): { path: string; ts: boolean } | null {
  const candidates: Array<{ ext: string; ts: boolean }> = [
    { ext: 'ts', ts: true },
    { ext: 'js', ts: false },
  ];
  for (const c of candidates) {
    try {
      const url = new URL(`../cli.${c.ext}`, import.meta.url);
      const p = fileURLToPath(url);
      if (existsSync(p)) return { path: p, ts: c.ts };
    } catch { /* continue */ }
  }
  return null;
}

function findInNodeModules(name: string): string | null {
  let dir = process.cwd();
  const exe = process.platform === 'win32' ? `${name}.cmd` : name;
  while (true) {
    const candidate = join(dir, 'node_modules', '.bin', exe);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function defaultSpawnServer(cwd: string): SpawnedServer {
  const cli = resolveCliPath();
  if (!cli) throw new Error('Cannot locate CLI entry point (dist/cli.js or src/cli.ts)');

  let command: string;
  let args: string[];
  if (cli.ts) {
    const tsx = findInNodeModules('tsx');
    if (tsx) {
      command = tsx;
      args = [cli.path, 'mcp', 'serve'];
    } else {
      command = process.execPath;
      args = ['--import', 'tsx', cli.path, 'mcp', 'serve'];
    }
  } else {
    command = process.execPath;
    args = [cli.path, 'mcp', 'serve'];
  }

  const proc = spawn(command, args, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  return { proc, stdin: proc.stdin!, stdout: proc.stdout! };
}

// ---------------------------------------------------------------------------
// Fixture repo (self-contained, so the probe never touches the user's repo)
// ---------------------------------------------------------------------------

async function createFixture(): Promise<{ dir: string; sha: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), 'codereplay-probe-'));
  await gitOrThrow(dir, ['init', '-q', '-b', 'main']);
  await gitOrThrow(dir, ['config', 'user.name', 'Probe']);
  await gitOrThrow(dir, ['config', 'user.email', 'probe@test.test']);
  await mkdir(join(dir, 'src'), { recursive: true });
  await writeFile(join(dir, 'README.md'), '# probe\n');
  await writeFile(join(dir, 'src/greet.js'), 'export const greet = (n) => `hi ${n}`;\n');
  await gitOrThrow(dir, ['add', '-A']);
  await gitOrThrow(dir, ['commit', '-q', '-m', 'init']);
  const sha = (await gitOrThrow(dir, ['rev-parse', 'HEAD'])).trim();
  return { dir, sha, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

async function writeFixtureManifest(dir: string, sha: string): Promise<string> {
  const manifest = {
    spec_version: '2.1',
    project_metadata: {
      name: 'probe', scope_type: 'FULL', target_commit: sha, scoped_paths: [],
    },
    steps: [
      {
        step_id: 1, title: 'scaffold', commit_message: 'scaffold',
        explanation: { markdown: 'README.' },
        code_changes: [{ path: 'README.md', action: 'CREATE', content: '# probe\n' }],
      },
      {
        step_id: 2, title: 'greet', commit_message: 'add greet',
        explanation: { markdown: 'Pure function.' },
        code_changes: [
          { path: 'src/greet.js', action: 'CREATE', content: 'export const greet = (n) => `hi ${n}`;\n' },
        ],
      },
    ],
  };
  const path = join(dir, 'codereplay.json');
  await writeFile(path, JSON.stringify(manifest, null, 2));
  return path;
}

// ---------------------------------------------------------------------------
// Cline environment detection (soft checks)
// ---------------------------------------------------------------------------

function vsCodeExtensionDirs(): string[] {
  const home = homedir();
  const dirs = [
    join(home, '.vscode', 'extensions'),
    join(home, '.vscode-insiders', 'extensions'),
    join(home, '.vscode-server', 'extensions'),
    join(home, '.vscode-server-insiders', 'extensions'),
    join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage'),
  ];
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? join(home, 'AppData', 'Roaming');
    dirs.push(join(appData, 'Code', 'User', 'globalStorage'));
    dirs.push(join(appData, 'Code - Insiders', 'User', 'globalStorage'));
  }
  return dirs;
}

export async function detectClineExtension(): Promise<string | null> {
  // Known publisher IDs for Cline
  const publishers = ['saoudrizwan.claude-dev', 'cline.cline', 'claude-dev'];
  for (const base of vsCodeExtensionDirs()) {
    if (!base.endsWith('extensions')) continue;
    if (!existsSync(base)) continue;
    try {
      const entries = await readdir(base);
      for (const e of entries) {
        if (publishers.some((p) => e.toLowerCase().startsWith(p.toLowerCase()))) {
          return join(base, e);
        }
      }
    } catch { /* skip */ }
  }
  return null;
}

export async function detectClineMcpConfig(): Promise<{ path: string; hasCodereplay: boolean } | null> {
  const homes = [homedir()];
  const search: string[] = [];
  for (const h of homes) {
    search.push(join(h, 'Library', 'Application Support', 'Code', 'User', 'globalStorage',
      'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'));
    search.push(join(h, '.config', 'Code', 'User', 'globalStorage',
      'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'));
    if (process.platform === 'win32') {
      const appData = process.env.APPDATA ?? join(h, 'AppData', 'Roaming');
      search.push(join(appData, 'Code', 'User', 'globalStorage',
        'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'));
    }
  }
  for (const p of search) {
    if (existsSync(p)) {
      try {
        const raw = await readFile(p, 'utf8');
        const parsed = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
        return { path: p, hasCodereplay: !!(parsed.mcpServers && parsed.mcpServers['codereplay']) };
      } catch {
        return { path: p, hasCodereplay: false };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// The probe itself
// ---------------------------------------------------------------------------

export async function runProbe(opts: ProbeOptions = {}): Promise<ProbeReport> {
  const cwd = opts.cwd ?? process.cwd();
  const spawnServer = opts.spawnServer ?? defaultSpawnServer;
  const checks: ProbeCheck[] = [];

  const push = (name: string, status: CheckStatus, detail: string, group: ProbeCheck['group']) => {
    checks.push({ name, status, detail, group });
  };

  // 1. Spawn
  let spawned: SpawnedServer | null = null;
  let client: McpClient | null = null;
  try {
    spawned = spawnServer(cwd);
    push('server:spawn', 'pass', `pid ${spawned.proc.pid}`, 'protocol');
    client = new McpClient(spawned.stdin, spawned.stdout);

    // 2. Initialize handshake
    try {
      const resp = await withTimeout(client.initialize(), 5000, 'initialize');
      if ('result' in resp && resp.result) {
        const r = resp.result as { protocolVersion?: string; capabilities?: { tools?: unknown } };
        push('initialize', 'pass', `protocol ${r.protocolVersion ?? '?'}`, 'protocol');
        push('capabilities.tools',
          r.capabilities?.tools ? 'pass' : 'fail',
          r.capabilities?.tools ? 'declared' : 'missing',
          'protocol');
      } else {
        push('initialize', 'fail', 'no result', 'protocol');
      }
    } catch (e) {
      push('initialize', 'fail', (e as Error).message, 'protocol');
    }

    // 3. tools/list
    try {
      const listResp = await withTimeout(client.request('tools/list'), 3000, 'tools/list');
      const tools = ('result' in listResp && (listResp.result as { tools?: unknown[] })?.tools) || [];
      if (Array.isArray(tools) && tools.length > 0) {
        push('tools/list', 'pass', `${tools.length} tools`, 'protocol');
        for (const t of tools as Array<{ name?: string; description?: string; inputSchema?: { type?: string } }>) {
          const ok =
            typeof t.name === 'string' &&
            typeof t.description === 'string' &&
            t.description.length > 10 &&
            t.inputSchema?.type === 'object';
          push(`tool:${t.name ?? '?'}`, ok ? 'pass' : 'fail',
            ok ? 'valid schema' : 'invalid tool definition', 'protocol');
        }
      } else {
        push('tools/list', 'fail', 'no tools', 'protocol');
      }
    } catch (e) {
      push('tools/list', 'fail', (e as Error).message, 'protocol');
    }

    // 4. tools/call:codereplay_scan against a fixture
    const fixture = await createFixture();
    try {
      const scan = await withTimeout(client.request('tools/call', {
        name: 'codereplay_scan',
        arguments: { repo: fixture.dir, paths: ['.'] },
      }), 8000, 'tools/call:scan');
      const text = ('result' in scan && (scan.result as { content?: Array<{ text?: string }> })?.content?.[0]?.text) || '';
      const ok = text.includes('total_files') && text.includes(fixture.sha);
      push('tools/call:codereplay_scan', ok ? 'pass' : 'fail',
        ok ? 'inventory returned' : 'malformed scan response', 'protocol');

      // 5. tools/call:codereplay_validate_manifest (valid)
      const manifestPath = await writeFixtureManifest(fixture.dir, fixture.sha);
      const manifestJson = await readFile(manifestPath, 'utf8');
      const val = await withTimeout(client.request('tools/call', {
        name: 'codereplay_validate_manifest',
        arguments: { manifest: manifestJson },
      }), 5000, 'tools/call:validate');
      const valText = ('result' in val && (val.result as { content?: Array<{ text?: string }> })?.content?.[0]?.text) || '';
      const valParsed = (() => { try { return JSON.parse(valText) as { valid?: boolean }; } catch { return null; } })();
      push('tools/call:codereplay_validate_manifest', valParsed?.valid ? 'pass' : 'fail',
        valParsed?.valid ? 'valid manifest accepted' : 'valid manifest rejected', 'protocol');

      // 6. Error handling: unknown method → -32601
      const bad = await withTimeout(client.request('does/not/exist'), 3000, 'unknown method');
      const code = 'error' in bad ? (bad.error as { code?: number })?.code : 0;
      push('error:unknown_method', code === -32601 ? 'pass' : 'fail',
        `code=${code} (expected -32601)`, 'protocol');

      // 7. Error handling: malformed JSON → -32700
      const malformed = new Promise<JsonRpcResponse>((resolve) => {
        const off = client!.onMessage((msg) => {
          if (msg && 'error' in msg && (msg.error as { code?: number })?.code === -32700) {
            off();
            resolve(msg);
          }
        });
      });
      client.sendRaw('{not valid json\n');
      const malResp = await withTimeout(malformed, 3000, 'malformed json');
      const malCode = 'error' in malResp ? (malResp.error as { code?: number })?.code : 0;
      push('error:malformed_json', malCode === -32700 ? 'pass' : 'fail',
        `code=${malCode} (expected -32700)`, 'protocol');

      // Optional end-to-end
      if (opts.e2e) {
        const verify = await withTimeout(client.request('tools/call', {
          name: 'codereplay_verify',
          arguments: { repo: fixture.dir, manifest_path: manifestPath },
        }), 30000, 'tools/call:verify');
        const vText = ('result' in verify && (verify.result as { content?: Array<{ text?: string }> })?.content?.[0]?.text) || '';
        const vParsed = (() => { try { return JSON.parse(vText) as { verified?: boolean; steps?: number }; } catch { return null; } })();
        push('e2e:verify', vParsed?.verified ? 'pass' : 'fail',
          vParsed?.verified ? `reconstructed ${vParsed.steps} steps` : 'verification failed',
          'e2e');
      }
    } finally {
      await fixture.cleanup();
    }
  } catch (e) {
    push('server:spawn', 'fail', (e as Error).message, 'protocol');
  } finally {
    if (spawned?.proc && !spawned.proc.killed) {
      spawned.proc.kill('SIGTERM');
    }
  }

  // Cline environment detection (soft)
  const extPath = await detectClineExtension();
  push('cline:extension',
    extPath ? 'pass' : 'warn',
    extPath ?? 'Cline extension not found — install from VS Code marketplace',
    'cline');

  const mcpConfig = await detectClineMcpConfig();
  if (!mcpConfig) {
    push('cline:mcp_config', 'warn',
      'Cline MCP settings not found — run `codereplay mcp install` after installing Cline',
      'cline');
  } else if (!mcpConfig.hasCodereplay) {
    push('cline:mcp_config', 'warn',
      `settings found at ${mcpConfig.path} but codereplay is not registered — run \`codereplay mcp install\``,
      'cline');
  } else {
    push('cline:mcp_config', 'pass', `codereplay registered in ${mcpConfig.path}`, 'cline');
  }

  const hardFailures = checks.filter((c) => c.status === 'fail').length;
  return {
    checks,
    hard_failures: hardFailures,
    warnings: checks.filter((c) => c.status === 'warn').length,
    connected: hardFailures === 0,
  };
}

// ---------------------------------------------------------------------------
// Human-readable report
// ---------------------------------------------------------------------------

const GROUP_LABELS: Record<ProbeCheck['group'], string> = {
  protocol: 'MCP PROTOCOL (hard)',
  cline: 'CLINE ENVIRONMENT (soft)',
  e2e: 'END-TO-END (opt-in)',
};

export function formatProbeReport(report: ProbeReport): string {
  const lines: string[] = [];
  lines.push('CodeReplay × Cline Connectivity Probe');
  lines.push('='.repeat(50));
  lines.push('');

  const groups: Array<ProbeCheck['group']> = ['protocol', 'e2e', 'cline'];
  for (const g of groups) {
    const items = report.checks.filter((c) => c.group === g);
    if (items.length === 0) continue;
    lines.push(GROUP_LABELS[g]);
    for (const c of items) {
      const tag = c.status === 'pass' ? '[PASS]' : c.status === 'warn' ? '[WARN]' : '[FAIL]';
      lines.push(`  ${tag} ${c.name.padEnd(38)} ${c.detail}`);
    }
    lines.push('');
  }

  const total = report.checks.filter((c) => c.group !== 'cline').length;
  const passed = report.checks.filter((c) => c.group !== 'cline' && c.status === 'pass').length;

  lines.push('─'.repeat(50));
  if (report.connected) {
    lines.push(`RESULT: ✅  FULLY CONNECTED (${passed}/${total} hard checks passed, ${report.warnings} warning(s))`);
  } else {
    lines.push(`RESULT: ❌  NOT CONNECTED (${report.hard_failures} hard failure(s))`);
  }
  return lines.join('\n');
}
