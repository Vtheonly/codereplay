import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { McpClient, withTimeout } from '../../src/mcp/client.js';

function findCli(): { path: string; ts: boolean } {
  for (const { ext, ts } of [{ ext: 'ts', ts: true }, { ext: 'js', ts: false }]) {
    const p = fileURLToPath(new URL(`../../src/cli.${ext}`, import.meta.url));
    if (existsSync(p)) return { path: p, ts };
  }
  throw new Error('CLI not found');
}

function findTsx(): string | null {
  let dir = process.cwd();
  while (true) {
    const exe = process.platform === 'win32' ? 'tsx.cmd' : 'tsx';
    const c = join(dir, 'node_modules', '.bin', exe);
    if (existsSync(c)) return c;
    const parent = join(dir, '..');
    if (parent === dir) return null;
    dir = parent;
  }
}

describe('MCP stdio transport', () => {
  let proc: ChildProcess;
  let client: McpClient;

  beforeAll(async () => {
    const cli = findCli();
    let command: string;
    let args: string[];

    if (cli.ts) {
      const tsx = findTsx();
      command = tsx ?? process.execPath;
      args = tsx ? [cli.path, 'mcp', 'serve'] : ['--import', 'tsx', cli.path, 'mcp', 'serve'];
    } else {
      command = process.execPath;
      args = [cli.path, 'mcp', 'serve'];
    }
    proc = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    client = new McpClient(proc.stdin!, proc.stdout!);
    await withTimeout(client.initialize(), 15_000, 'initialize');
  });

  afterAll(() => {
    proc?.kill('SIGTERM');
  });

  it('responds to ping', async () => {
    const resp = await withTimeout(client.request('ping'), 3000, 'ping');
    expect('result' in resp).toBe(true);
  });

  it('lists all six tools with valid schemas', async () => {
    const resp = await withTimeout(client.request('tools/list'), 3000, 'tools/list');
    expect('result' in resp).toBe(true);
    const tools = (resp as any).result.tools as Array<{ name: string; inputSchema: { type: string } }>;
    expect(tools.map((t) => t.name).sort()).toEqual([
      'codereplay_read_file', 'codereplay_read_files', 'codereplay_scan',
      'codereplay_validate_manifest', 'codereplay_verify', 'codereplay_write_manifest',
    ]);
    for (const t of tools) expect(t.inputSchema.type).toBe('object');
  });

  it('returns MethodNotFound for an unknown method', async () => {
    const resp = await withTimeout(client.request('nope/nope'), 3000, 'bad');
    expect('error' in resp).toBe(true);
    expect((resp as any).error.code).toBe(-32601);
  });

  it('returns ParseError for malformed JSON', async () => {
    const wait = new Promise<any>((resolve) => {
      const off = client.onMessage((m) => {
        if ('error' in m && (m as any).error.code === -32700) { off(); resolve(m); }
      });
    });
    client.sendRaw('{{{not json\n');
    const msg = await withTimeout(wait, 3000, 'parse error');
    expect(msg.error.code).toBe(-32700);
  });

  it('returns InvalidParams for a bad tool name', async () => {
    const resp = await withTimeout(
      client.request('tools/call', { name: 'nope', arguments: {} }),
      3000, 'bad tool',
    );
    expect('error' in resp).toBe(true);
    expect((resp as any).error.code).toBe(-32602);
  });

  it('surfaces tool-handler errors as isError results, not RPC errors', async () => {
    const resp = await withTimeout(
      client.request('tools/call', {
        name: 'codereplay_scan',
        arguments: { repo: '/definitely/does/not/exist' },
      }),
      5000, 'scan fail',
    );
    expect('result' in resp).toBe(true);
    const result = (resp as any).result;
    expect(result.isError).toBe(true);
  });
});
