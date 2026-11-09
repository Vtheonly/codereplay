import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { McpClient, withTimeout } from '../../src/mcp/client.js';
import { createFixtureRepo, writeFixtureManifest, withFixture } from '../helpers.js';

function findCli() {
  for (const ext of ['ts', 'js']) {
    const p = fileURLToPath(new URL(`../../src/cli.${ext}`, import.meta.url));
    if (existsSync(p)) return { path: p, ts: ext === 'ts' };
  }
  throw new Error('CLI not found');
}

function findTsx() {
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

async function spawnClient(cwd: string): Promise<{ proc: ChildProcess; client: McpClient }> {
  const cli = findCli();
  let command: string; let args: string[];
  if (cli.ts) {
    const tsx = findTsx();
    command = tsx ?? process.execPath;
    args = tsx ? [cli.path, 'mcp', 'serve'] : ['--import', 'tsx', cli.path, 'mcp', 'serve'];
  } else {
    command = process.execPath;
    args = [cli.path, 'mcp', 'serve'];
  }
  const proc = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  const client = new McpClient(proc.stdin!, proc.stdout!);
  await withTimeout(client.initialize(), 15_000, 'initialize');
  return { proc, client };
}

function parseToolResult(resp: any): any {
  return JSON.parse(resp.result.content[0].text);
}

describe('Full scan → read → validate → write → verify workflow', () => {
  it('executes end-to-end against a fixture repo', async () => {
    await withFixture(async (dir, sha) => {
      const { proc, client } = await spawnClient(dir);
      try {
        // 1. Scan
        const scan = await withTimeout(client.request('tools/call', {
          name: 'codereplay_scan', arguments: { repo: dir, paths: ['.'] },
        }), 8000, 'scan');
        const inventory = parseToolResult(scan);
        expect(inventory.git_head).toBe(sha);
        expect(inventory.total_files).toBe(4);

        // 2. Read files
        const read = await withTimeout(client.request('tools/call', {
          name: 'codereplay_read_files',
          arguments: { repo: dir, paths: inventory.files.map((f: any) => f.path) },
        }), 8000, 'read');
        const readData = parseToolResult(read);
        expect(readData.files).toHaveLength(4);

        // 3. Validate manifest
        const manifestPath = await writeFixtureManifest(dir, sha);
        const raw = await readFile(manifestPath, 'utf8');
        const validate = await withTimeout(client.request('tools/call', {
          name: 'codereplay_validate_manifest', arguments: { manifest: raw },
        }), 5000, 'validate');
        expect(parseToolResult(validate).valid).toBe(true);

        // 4. Write manifest
        const outPath = `${dir}/written.json`;
        const write = await withTimeout(client.request('tools/call', {
          name: 'codereplay_write_manifest',
          arguments: { manifest: raw, path: outPath },
        }), 5000, 'write');
        expect(parseToolResult(write).path).toBe(outPath);

        // 5. Verify
        const verify = await withTimeout(client.request('tools/call', {
          name: 'codereplay_verify',
          arguments: { repo: dir, manifest_path: outPath },
        }), 30_000, 'verify');
        const vData = parseToolResult(verify);
        expect(vData.verified).toBe(true);
        expect(vData.steps).toBe(3);
      } finally {
        proc.kill('SIGTERM');
      }
    });
  });
});
