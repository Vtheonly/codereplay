import { spawn } from 'node:child_process';

export interface GitResult {
  stdout: string;
  stderr: string;
  code: number;
}

export function git(
  cwd: string,
  args: string[],
  opts: { input?: string } = {}
): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString('utf8')));
    child.stderr.on('data', (d) => (stderr += d.toString('utf8')));
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, stderr, code: code ?? -1 }));
    if (opts.input !== undefined) child.stdin.end(opts.input);
    else child.stdin.end();
  });
}

export async function gitOrThrow(
  cwd: string,
  args: string[],
  opts?: { input?: string }
): Promise<string> {
  const r = await git(cwd, args, opts);
  if (r.code !== 0) throw new Error(`git ${args.join(' ')} failed (${r.code}): ${r.stderr}`);
  return r.stdout;
}
