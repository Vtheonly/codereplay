import {
  mkdir, rm, writeFile, readFile, unlink, access, readdir,
} from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { git, gitOrThrow } from './git.js';
import { loadManifest, type Manifest, type Step, type CodeChange } from './manifest.js';

export interface SessionStepRecord {
  step_id: number;
  sha: string;
  parent_sha: string | null;
  title: string;
  commit_message: string;
  explanation: Step['explanation'];
  code_changes: CodeChange[];
}

export interface SessionState {
  uuid: string;
  repo: string;
  worktree: string;
  branch: string;
  target_sha: string;
  manifest_path: string;
  scope_type: 'FULL' | 'PARTIAL';
  scoped_paths: string[];
  project_name: string;
  steps: SessionStepRecord[];
  verified: boolean;
  created_at: string;
}

const SESSIONS_DIR = '.codereplay/sessions';
const WORKTREES_DIR = '.codereplay/worktrees';

// ---------------------------------------------------------------------------
// Session initialization (compile the manifest into a real git history)
// ---------------------------------------------------------------------------

export async function initSession(opts: {
  repo: string;
  manifestPath: string;
}): Promise<SessionState> {
  const repo = resolve(opts.repo);
  const manifestPath = resolve(opts.manifestPath);

  // -- 0. Sanity: repo is a git worktree
  const inside = await git(repo, ['rev-parse', '--is-inside-work-tree']);
  if (inside.code !== 0 || inside.stdout.trim() !== 'true') {
    throw new Error(`Not a git working tree: ${repo}`);
  }

  // -- 1. Load + validate manifest
  const manifest = await loadManifest(manifestPath);
  const targetSha = manifest.project_metadata.target_commit;
  const scopeType = manifest.project_metadata.scope_type;
  const scopedPaths = manifest.project_metadata.scoped_paths ?? [];

  // -- 2. Verify target commit exists locally
  const targetCheck = await git(repo, ['cat-file', '-e', `${targetSha}^{commit}`]);
  if (targetCheck.code !== 0) {
    throw new Error(`target_commit not found in repository: ${targetSha}`);
  }

  // -- 3. Ground-Truth Integrity: working tree must match target for scoped paths
  const diffArgs = ['diff', '--quiet', targetSha];
  if (scopeType === 'PARTIAL' && scopedPaths.length > 0) diffArgs.push('--', ...scopedPaths);
  const wtDiff = await git(repo, diffArgs);
  if (wtDiff.code !== 0 && wtDiff.code !== 1) {
    throw new Error(`Failed to verify working tree against target: ${wtDiff.stderr}`);
  }
  if (wtDiff.code === 1) {
    console.warn(
      '⚠  Working tree differs from target_commit for scoped paths. ' +
      'CodeReplay will use target_commit as ground truth, not the working tree.'
    );
  }

  // -- 4. Prepare session + worktree directories
  const uuid = randomUUID();
  const codereplayDir = join(repo, '.codereplay');
  const sessionDir = join(codereplayDir, 'sessions', uuid);
  const worktree = join(codereplayDir, 'worktrees', uuid);
  await mkdir(sessionDir, { recursive: true });
  await mkdir(dirname(worktree), { recursive: true });

  // Exclude .codereplay/ from git status without touching user's .gitignore
  await ensureGitExclude(repo, '.codereplay/');

  // -- 5. Create isolated worktree at the target commit (Vulnerability 2 fix)
  const addWt = await git(repo, ['worktree', 'add', '--detach', worktree, targetSha]);
  if (addWt.code !== 0) {
    throw new Error(`Failed to create isolated worktree: ${addWt.stderr}`);
  }

  const branch = `codereplay/session-${uuid}`;
  try {
    // -- 6. Create an orphan branch inside the worktree
    const orphan = await git(worktree, ['checkout', '--orphan', branch]);
    if (orphan.code !== 0) throw new Error(`Failed to create orphan branch: ${orphan.stderr}`);

    // -- 7. Build the baseline commit (Vulnerability 3 fix)
    //    FULL: clear the worktree entirely (empty baseline).
    //    PARTIAL: keep out-of-scope files as a compilable baseline.
    await buildBaseline(worktree, scopeType, scopedPaths);
    const baselineSha = await commit(
      worktree,
      scopeType === 'FULL'
        ? 'CodeReplay baseline: empty tree'
        : `CodeReplay baseline: repository minus scoped paths (${scopedPaths.join(', ')})`
    );

    // -- 8. Replay every step, creating one real git commit per pedagogical unit
    const stepRecords: SessionStepRecord[] = [];
    let parentSha: string | null = baselineSha;

    for (const step of manifest.steps) {
      await applyStep(worktree, step);
      await git(worktree, ['add', '-A']);
      const sha = await commit(worktree, `[${step.step_id}] ${step.commit_message}`);
      stepRecords.push({
        step_id: step.step_id,
        sha,
        parent_sha: parentSha,
        title: step.title,
        commit_message: step.commit_message,
        explanation: step.explanation,
        code_changes: step.code_changes,
      });
      parentSha = sha;
      process.stdout.write(`  ✓ step ${step.step_id}: ${step.title}\n`);
    }

    // -- 9. Cryptographic verification: the reconstructed tip must byte-match the target
    const verifyArgs = ['diff', '--exit-code', 'HEAD', targetSha];
    if (scopeType === 'PARTIAL' && scopedPaths.length > 0) verifyArgs.push('--', ...scopedPaths);
    const verify = await git(worktree, verifyArgs);

    if (verify.code !== 0) {
      const failArgs = ['diff', 'HEAD', targetSha];
      if (scopeType === 'PARTIAL' && scopedPaths.length > 0) failArgs.push('--', ...scopedPaths);
      const failureDiff = await git(worktree, failArgs);
      const diagPath = join(sessionDir, 'verification-failure.diff');
      await writeFile(diagPath, failureDiff.stdout);
      throw new Error(
        `1:1 reconstruction verification FAILED. ` +
        `The replay does not reproduce target_commit. Diff saved to ${diagPath}`
      );
    }

    // -- 10. Persist session state
    const state: SessionState = {
      uuid,
      repo,
      worktree,
      branch,
      target_sha: targetSha,
      manifest_path: manifestPath,
      scope_type: scopeType,
      scoped_paths: scopedPaths,
      project_name: manifest.project_metadata.name,
      steps: stepRecords,
      verified: true,
      created_at: new Date().toISOString(),
    };
    await writeFile(join(sessionDir, 'session.json'), JSON.stringify(state, null, 2));
    return state;
  } catch (err) {
    // Roll back any partial worktree state
    await git(repo, ['worktree', 'remove', '--force', worktree]).catch(() => {});
    await git(repo, ['branch', '-D', branch]).catch(() => {});
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Baseline construction
// ---------------------------------------------------------------------------

async function buildBaseline(
  worktree: string,
  scopeType: 'FULL' | 'PARTIAL',
  scopedPaths: string[]
): Promise<void> {
  // Track which files exist on disk right now (inherited from target checkout)
  const entries = await readdir(worktree);

  if (scopeType === 'FULL') {
    // Wipe everything except .git
    for (const e of entries) {
      if (e === '.git') continue;
      await rm(join(worktree, e), { recursive: true, force: true });
    }
    // Clear the index too (in case it still references old blobs)
    await git(worktree, ['rm', '-rf', '--cached', '.']);
    await git(worktree, ['rm', '-rf', '.']);
    return;
  }

  // PARTIAL: remove only the scoped paths (both from disk and index)
  for (const p of scopedPaths) {
    const full = join(worktree, p);
    await rm(full, { recursive: true, force: true });
  }
  // Remove scoped paths from the index
  await git(worktree, ['rm', '-rf', '--cached', '--ignore-unmatch', '--', ...scopedPaths]);
  await git(worktree, ['rm', '-rf', '--ignore-unmatch', '--', ...scopedPaths]);
}

// ---------------------------------------------------------------------------
// Per-step application
// ---------------------------------------------------------------------------

async function applyStep(worktree: string, step: Step): Promise<void> {
  for (const change of step.code_changes) {
    await applyChange(worktree, step.step_id, change);
  }
}

async function applyChange(worktree: string, stepId: number, change: CodeChange): Promise<void> {
  const targetPath = join(worktree, change.path);

  // PATCH fallback path (per spec §6.1, discouraged but supported)
  if (change.content === undefined && change.patch !== undefined) {
    const res = await git(worktree, ['apply', '--whitespace=fix', '--recount'], { input: change.patch });
    if (res.code !== 0) {
      throw new Error(
        `Step ${stepId}: git apply failed for ${change.path}: ${res.stderr.trim()}`
      );
    }
    return;
  }

  // Snapshot content path (the preferred, vulnerability-1-safe path)
  switch (change.action) {
    case 'CREATE':
    case 'MODIFY': {
      if (change.content === undefined) {
        throw new Error(
          `Step ${stepId}: ${change.action} for ${change.path} requires 'content' (or 'patch')`
        );
      }
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, change.content, 'utf8');
      return;
    }

    case 'DELETE': {
      if (existsSync(targetPath)) await unlink(targetPath);
      return;
    }

    case 'RENAME': {
      if (!change.old_path) {
        throw new Error(`Step ${stepId}: RENAME for ${change.path} requires 'old_path'`);
      }
      const oldPath = join(worktree, change.old_path);
      if (!existsSync(oldPath)) {
        throw new Error(
          `Step ${stepId}: RENAME source '${change.old_path}' does not exist in the replay tree`
        );
      }
      await mkdir(dirname(targetPath), { recursive: true });
      // Use `git mv` so that rename detection in `git diff-tree -M` fires correctly
      const mv = await git(worktree, ['mv', change.old_path, change.path]);
      if (mv.code !== 0) throw new Error(`Step ${stepId}: git mv failed: ${mv.stderr}`);
      // Optionally overwrite content post-rename
      if (change.content !== undefined) {
        await writeFile(targetPath, change.content, 'utf8');
      }
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Session persistence / cleanup
// ---------------------------------------------------------------------------

export async function loadSession(repo: string, uuid: string): Promise<SessionState> {
  const p = join(resolve(repo), SESSIONS_DIR, uuid, 'session.json');
  const raw = await readFile(p, 'utf8');
  return JSON.parse(raw) as SessionState;
}

export async function listSessions(repo: string): Promise<SessionState[]> {
  const dir = join(resolve(repo), SESSIONS_DIR);
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  const out: SessionState[] = [];
  for (const e of entries) {
    try { out.push(await loadSession(repo, e)); } catch { /* skip corrupt */ }
  }
  return out;
}

export async function cleanSession(repo: string, uuid: string): Promise<void> {
  const state = await loadSession(repo, uuid);
  await git(resolve(repo), ['worktree', 'remove', '--force', state.worktree]).catch(() => {});
  await git(resolve(repo), ['branch', '-D', state.branch]).catch(() => {});
  await rm(join(resolve(repo), SESSIONS_DIR, uuid), { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function commit(cwd: string, message: string): Promise<string> {
  const res = await git(cwd, [
    '-c', 'user.name=CodeReplay',
    '-c', 'user.email=noreply@codereplay.local',
    '-c', 'commit.gpgsign=false',
    'commit', '--allow-empty', '-m', message,
  ]);
  if (res.code !== 0) throw new Error(`Commit failed: ${res.stderr}`);
  const sha = await gitOrThrow(cwd, ['rev-parse', 'HEAD']);
  return sha.trim();
}

async function ensureGitExclude(repo: string, pattern: string): Promise<void> {
  const excludePath = join(repo, '.git', 'info', 'exclude');
  try {
    await mkdir(dirname(excludePath), { recursive: true });
    let existing = '';
    try { existing = await readFile(excludePath, 'utf8'); } catch { /* none */ }
    if (!existing.split(/\r?\n/).includes(pattern)) {
      const suffix = existing && !existing.endsWith('\n') ? '\n' : '';
      await writeFile(excludePath, existing + suffix + pattern + '\n');
    }
  } catch {
    /* non-fatal */
  }
}
