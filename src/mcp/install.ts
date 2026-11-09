import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SERVER_NAME = 'codereplay';

const AUTO_APPROVE = [
  'codereplay_scan',
  'codereplay_read_file',
  'codereplay_read_files',
  'codereplay_validate_manifest',
];

function candidateConfigPaths(): string[] {
  const home = homedir();
  const paths = [
    join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage',
      'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
    join(home, '.config', 'Code', 'User', 'globalStorage',
      'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
  ];
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? join(home, 'AppData', 'Roaming');
    paths.push(join(appData, 'Code', 'User', 'globalStorage',
      'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'));
  }
  return paths;
}

function resolveCliEntry(): { command: string; args: string[] } {
  // Prefer the compiled entry — Cline must not need tsx installed at runtime.
  const tryJs = fileURLToPath(new URL('../cli.js', import.meta.url));
  if (existsSync(tryJs)) return { command: 'node', args: [tryJs, 'mcp', 'serve'] };
  const tryTs = fileURLToPath(new URL('../cli.ts', import.meta.url));
  if (existsSync(tryTs)) {
    return {
      command: 'node',
      args: ['--import', 'tsx', tryTs, 'mcp', 'serve'],
    };
  }
  throw new Error('Cannot locate CLI entry point');
}

export interface InstallResult {
  path: string | null;
  wrote: boolean;
  snippet: string;
  note: string;
}

export async function installClineMcp(opts: {
  printOnly?: boolean;
  configPath?: string;
}): Promise<InstallResult> {
  const cli = resolveCliEntry();
  const entry = {
    command: cli.command,
    args: cli.args,
    disabled: false,
    autoApprove: AUTO_APPROVE,
    timeout: 60,
  };
  const snippet = JSON.stringify({ mcpServers: { [SERVER_NAME]: entry } }, null, 2);

  if (opts.printOnly) {
    return { path: null, wrote: false, snippet, note: 'Printed only; no file written.' };
  }

  const target = opts.configPath ?? candidateConfigPaths().find((p) => existsSync(p));
  if (!target && !opts.configPath) {
    return {
      path: null, wrote: false, snippet,
      note:
        'No existing Cline MCP config found. Install the Cline extension first, ' +
        'or pass --config-path <path>. You can also paste the snippet into Cline → MCP Servers → Configure.',
    };
  }

  const path = target!;
  let config: { mcpServers?: Record<string, unknown> } = {};
  if (existsSync(path)) {
    try {
      config = JSON.parse(await readFile(path, 'utf8'));
    } catch {
      throw new Error(`Existing config is not valid JSON: ${path}`);
    }
  }
  config.mcpServers = { ...(config.mcpServers ?? {}), [SERVER_NAME]: entry };

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(config, null, 2) + '\n', 'utf8');
  return {
    path, wrote: true, snippet,
    note: `Registered "${SERVER_NAME}" in ${path}. Restart Cline (or reload VS Code) to pick up the server.`,
  };
}
