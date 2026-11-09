import express from 'express';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { loadSession, type SessionState } from '../engine/session.js';
import { git } from '../engine/git.js';
import { languageFromPath } from '../engine/language.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findUiDir(): string {
  const candidates = [
    resolve(__dirname, '..', 'ui'),              // dist/ui
    resolve(__dirname, '..', '..', 'src', 'ui'), // src/ui (dev)
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

export interface ServerHandle {
  url: string;
  close: () => Promise<void>;
}

export async function startServer(opts: {
  repo: string;
  uuid: string;
  port: number;
}): Promise<ServerHandle> {
  const state = await loadSession(opts.repo, opts.uuid);
  const app = express();

  app.use(express.static(findUiDir()));

  app.get('/api/session', (_req, res) => {
    res.json({
      uuid: state.uuid,
      project_name: state.project_name,
      scope_type: state.scope_type,
      target_sha: state.target_sha,
      verified: state.verified,
      created_at: state.created_at,
      steps: state.steps.map((s) => ({
        step_id: s.step_id,
        title: s.title,
        sha: s.sha,
        parent_sha: s.parent_sha,
      })),
    });
  });

  app.get('/api/steps/:id', async (req, res) => {
    const id = Number(req.params.id);
    const step = state.steps.find((s) => s.step_id === id);
    if (!step) { res.status(404).json({ error: 'step not found' }); return; }

    const files = [] as Array<{
      path: string; old_path: string | null; action: string;
      old_content: string | null; new_content: string | null; language: string;
    }>;

    for (const change of step.code_changes) {
      const oldPath = change.action === 'RENAME' ? (change.old_path ?? change.path) : change.path;
      const oldContent = step.parent_sha
        ? await readBlob(state.worktree, step.parent_sha, oldPath)
        : null;
      const newContent = change.action === 'DELETE'
        ? null
        : await readBlob(state.worktree, step.sha, change.path);

      files.push({
        path: change.path,
        old_path: change.action === 'RENAME' ? (change.old_path ?? null) : null,
        action: change.action,
        old_content: oldContent,
        new_content: newContent,
        language: languageFromPath(change.path),
      });
    }

    res.json({
      step_id: step.step_id,
      title: step.title,
      commit_message: step.commit_message,
      sha: step.sha,
      parent_sha: step.parent_sha,
      explanation: step.explanation,
      files,
    });
  });

  app.get('/api/steps/:id/patch', async (req, res) => {
    const id = Number(req.params.id);
    const step = state.steps.find((s) => s.step_id === id);
    if (!step || !step.parent_sha) { res.status(404).send('step not found'); return; }
    const r = await git(state.worktree, [
      'diff-tree', '-p', '-M', '-C',
      '--color-moved=zebra', '--color-moved-ws=ignore-all-space',
      step.parent_sha, step.sha,
    ]);
    res.type('text/plain').send(r.stdout);
  });

  return await new Promise<ServerHandle>((resolvePromise, reject) => {
    const server = app.listen(opts.port, () => {
      resolvePromise({
        url: `http://localhost:${opts.port}`,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
    server.on('error', reject);
  });
}

async function readBlob(worktree: string, sha: string, path: string): Promise<string | null> {
  const r = await git(worktree, ['show', `${sha}:${path}`]);
  if (r.code !== 0) return null;
  return r.stdout;
}
