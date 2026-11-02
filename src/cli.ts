#!/usr/bin/env node
import { Command } from 'commander';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import {
  initSession, listSessions, loadSession, cleanSession,
} from './engine/session.js';
import { startServer } from './server/index.js';
import { startMcpServer } from './mcp/server.js';
import { runProbe, formatProbeReport } from './mcp/probe.js';
import { installClineMcp } from './mcp/install.js';

const program = new Command();

program
  .name('codereplay')
  .description('Deterministic, Git-native replay engine for AI-generated codebases')
  .version('0.1.0');

program
  .command('init')
  .description('Compile a manifest into a replay session and start the UI')
  .requiredOption('--manifest <path>', 'Path to codereplay.json')
  .option('--repo <path>', 'Path to target repository', '.')
  .option('--port <n>', 'Port for the web UI', '4545')
  .option('--no-open', 'Do not auto-open the browser')
  .action(async (opts) => {
    const repo = resolve(opts.repo);
    const manifest = resolve(opts.manifest);
    if (!existsSync(manifest)) {
      console.error(`✗ Manifest not found: ${manifest}`);
      process.exit(1);
    }
    console.log(`▶ Initializing CodeReplay session in ${repo}`);
    const state = await initSession({ repo, manifestPath: manifest });
    console.log(
      `✓ Session ${state.uuid} built. Branch: ${state.branch} | Steps: ${state.steps.length} | Verified: ${state.verified}`
    );
    await serve(state.repo, state.uuid, Number(opts.port), opts.open);
  });

program
  .command('verify')
  .description('Verify that a manifest reconstructs the target without launching the UI')
  .requiredOption('--manifest <path>', 'Path to codereplay.json')
  .option('--repo <path>', 'Path to target repository', '.')
  .action(async (opts) => {
    const repo = resolve(opts.repo);
    const manifest = resolve(opts.manifest);
    try {
      const state = await initSession({ repo, manifestPath: manifest });
      await cleanSession(repo, state.uuid);
      console.log('✓ Verified — replay reconstructs the target 1:1.');
      process.exit(0);
    } catch (e) {
      console.error(`✗ ${(e as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('Serve an existing session')
  .requiredOption('--session <uuid>', 'Session UUID')
  .option('--repo <path>', 'Path to target repository', '.')
  .option('--port <n>', 'Port for the web UI', '4545')
  .option('--no-open', 'Do not auto-open the browser')
  .action(async (opts) => {
    const repo = resolve(opts.repo);
    await loadSession(repo, opts.session); // validates existence
    await serve(repo, opts.session, Number(opts.port), opts.open);
  });

program
  .command('list')
  .description('List all sessions in a repository')
  .option('--repo <path>', 'Path to target repository', '.')
  .action(async (opts) => {
    const sessions = await listSessions(resolve(opts.repo));
    if (sessions.length === 0) { console.log('No sessions found.'); return; }
    for (const s of sessions) {
      console.log(
        `${s.uuid}  ${s.created_at}  ${s.project_name}  steps=${s.steps.length}  verified=${s.verified}`
      );
    }
  });

program
  .command('clean')
  .description('Remove a session and its isolated worktree')
  .option('--session <uuid>', 'Session UUID')
  .option('--all', 'Clean all sessions')
  .option('--repo <path>', 'Path to target repository', '.')
  .action(async (opts) => {
    const repo = resolve(opts.repo);
    if (opts.all) {
      const sessions = await listSessions(repo);
      for (const s of sessions) await cleanSession(repo, s.uuid);
      console.log(`✓ Cleaned ${sessions.length} session(s).`);
    } else if (opts.session) {
      await cleanSession(repo, opts.session);
      console.log(`✓ Cleaned ${opts.session}.`);
    } else {
      console.error('Specify --session <uuid> or --all');
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// MCP: server, probe, and Cline installation helpers
// ---------------------------------------------------------------------------

const mcp = program.command('mcp').description('MCP server, probe, and Cline installation helpers');

mcp
  .command('serve')
  .description('Run the MCP server on stdio (this is what Cline launches)')
  .option('--cwd <path>', 'Working directory for relative paths', process.cwd())
  .action((opts) => {
    // MCP requires stdout to carry only JSON-RPC. Log to stderr.
    process.stderr.write(`[codereplay-mcp] serving on stdio (cwd=${opts.cwd})\n`);
    startMcpServer({ cwd: opts.cwd });
    // Keep alive
    setInterval(() => {}, 1 << 30).unref();
  });

mcp
  .command('probe')
  .description('Verify MCP protocol compliance and Cline environment connectivity')
  .option('--e2e', 'Also run the full scan→verify workflow against a fixture repo', false)
  .option('--json', 'Emit raw JSON report instead of the human-readable table', false)
  .option('--cwd <path>', 'Working directory', process.cwd())
  .action(async (opts) => {
    const report = await runProbe({ e2e: opts.e2e, cwd: opts.cwd });
    if (opts.json) {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
      process.stdout.write(formatProbeReport(report) + '\n');
    }
    process.exit(report.connected ? 0 : 1);
  });

mcp
  .command('install')
  .description('Register this server in Cline\'s MCP settings file')
  .option('--print-only', 'Only print the snippet; do not write any file', false)
  .option('--config-path <path>', 'Explicit path to cline_mcp_settings.json')
  .action(async (opts) => {
    const result = await installClineMcp({
      printOnly: opts.printOnly,
      configPath: opts.configPath,
    });
    if (result.wrote) {
      console.log(`✓ ${result.note}`);
    } else {
      console.log(result.note);
      console.log('\nMCP config snippet:\n');
      console.log(result.snippet);
    }
  });

async function serve(repo: string, uuid: string, port: number, shouldOpen: boolean) {
  const { url, close } = await startServer({ repo, uuid, port });
  console.log(`\n🎬 CodeReplay running at ${url}`);
  console.log(`   Press Ctrl+C to stop.\n`);
  if (shouldOpen) {
    try { const { default: open } = await import('open'); await open(url); }
    catch { /* ignore */ }
  }
  process.on('SIGINT', async () => { await close(); process.exit(0); });
  process.on('SIGTERM', async () => { await close(); process.exit(0); });
}

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
