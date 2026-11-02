import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { gitOrThrow } from '../src/engine/git.js';

export const FIXTURE_FILES: Record<string, string> = {
  'package.json':
    JSON.stringify({ name: 'fixture', version: '0.1.0', type: 'module' }, null, 2) + '\n',
  'README.md': '# fixture\n',
  'src/greet.js': 'export const greet = (n) => `hi ${n}`;\n',
  'src/index.js':
    "import { greet } from './greet.js';\nconsole.log(greet('x'));\n",
};

export async function createFixtureRepo(dir: string): Promise<{ targetSha: string }> {
  await mkdir(dir, { recursive: true });
  await gitOrThrow(dir, ['init', '-q', '-b', 'main']);
  await gitOrThrow(dir, ['config', 'user.name', 'Test']);
  await gitOrThrow(dir, ['config', 'user.email', 'test@test.test']);
  for (const [path, content] of Object.entries(FIXTURE_FILES)) {
    const full = join(dir, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
  }
  await gitOrThrow(dir, ['add', '-A']);
  await gitOrThrow(dir, ['commit', '-q', '-m', 'init']);
  const sha = (await gitOrThrow(dir, ['rev-parse', 'HEAD'])).trim();
  return { targetSha: sha };
}

export async function writeFixtureManifest(dir: string, targetSha: string): Promise<string> {
  const manifest = {
    spec_version: '2.1',
    project_metadata: {
      name: 'fixture', scope_type: 'FULL', target_commit: targetSha, scoped_paths: [],
    },
    steps: [
      {
        step_id: 1, title: 'scaffold', commit_message: 'scaffold',
        explanation: { markdown: 'Project shell.' },
        code_changes: [
          { path: 'package.json', action: 'CREATE', content: FIXTURE_FILES['package.json'] },
          { path: 'README.md', action: 'CREATE', content: FIXTURE_FILES['README.md'] },
        ],
      },
      {
        step_id: 2, title: 'greet', commit_message: 'add greet',
        explanation: { markdown: 'Pure function.' },
        code_changes: [
          { path: 'src/greet.js', action: 'CREATE', content: FIXTURE_FILES['src/greet.js'] },
        ],
      },
      {
        step_id: 3, title: 'wire entrypoint', commit_message: 'wire entry',
        explanation: { markdown: 'CLI.' },
        code_changes: [
          { path: 'src/index.js', action: 'CREATE', content: FIXTURE_FILES['src/index.js'] },
        ],
      },
    ],
  };
  const path = join(dir, 'codereplay.json');
  await writeFile(path, JSON.stringify(manifest, null, 2));
  return path;
}

export async function withFixture<T>(
  fn: (dir: string, targetSha: string) => Promise<T>
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'codereplay-test-'));
  try {
    const { targetSha } = await createFixtureRepo(dir);
    return await fn(dir, targetSha);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
