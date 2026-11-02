import { describe, it, expect } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { findTool, TOOLS } from '../../src/mcp/tools.js';
import { withFixture, writeFixtureManifest } from '../helpers.js';

function parseContent(r: { content: Array<{ text: string }> }): any {
  return JSON.parse(r.content[0].text);
}

describe('MCP tool definitions', () => {
  it('exposes exactly the expected tools', () => {
    expect(TOOLS.map((t) => t.name).sort()).toEqual([
      'codereplay_read_file',
      'codereplay_read_files',
      'codereplay_scan',
      'codereplay_validate_manifest',
      'codereplay_verify',
      'codereplay_write_manifest',
    ]);
  });

  it('every tool is a valid MCP tool definition', () => {
    for (const t of TOOLS) {
      expect(t.name).toMatch(/^codereplay_/);
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.inputSchema).toMatchObject({ type: 'object' });
      expect(t.inputSchema.properties).toBeTruthy();
    }
  });
});

describe('codereplay_scan', () => {
  it('returns a full inventory for a git repo', async () => {
    await withFixture(async (dir, sha) => {
      const r = await findTool('codereplay_scan')!.handler({ repo: dir, paths: ['.'] }, { cwd: dir });
      expect(r.isError).toBeUndefined();
      const data = parseContent(r);
      expect(data.git_head).toBe(sha);
      expect(data.total_files).toBe(4);
      expect(data.suggested_scope_type).toBe('FULL');
    });
  });

  it('returns isError for a non-git directory', async () => {
    await withFixture(async (dir) => {
      const r = await findTool('codereplay_scan')!.handler(
        { repo: `${dir}/does-not-exist`, paths: ['.'] }, { cwd: dir },
      );
      expect(r.isError).toBe(true);
    });
  });
});

describe('codereplay_read_file', () => {
  it('reads an entire file', async () => {
    await withFixture(async (dir) => {
      const r = await findTool('codereplay_read_file')!.handler(
        { repo: dir, path: 'src/greet.js' }, { cwd: dir },
      );
      const data = parseContent(r);
      expect(data.content).toContain('greet');
      expect(data.total_lines).toBeGreaterThan(1);
    });
  });

  it('respects start_line/end_line', async () => {
    await withFixture(async (dir) => {
      const r = await findTool('codereplay_read_file')!.handler(
        { repo: dir, path: 'src/index.js', start_line: 1, end_line: 1 }, { cwd: dir },
      );
      const data = parseContent(r);
      expect(data.content).toBe("import { greet } from './greet.js';");
    });
  });

  it('rejects path traversal', async () => {
    await withFixture(async (dir) => {
      const r = await findTool('codereplay_read_file')!.handler(
        { repo: dir, path: '../../etc/passwd' }, { cwd: dir },
      );
      expect(r.isError).toBe(true);
    });
  });
});

describe('codereplay_read_files', () => {
  it('batch-reads multiple files', async () => {
    await withFixture(async (dir) => {
      const r = await findTool('codereplay_read_files')!.handler(
        { repo: dir, paths: ['package.json', 'src/greet.js'] }, { cwd: dir },
      );
      const data = parseContent(r);
      expect(data.files).toHaveLength(2);
      expect(data.files.every((f: any) => f.content !== null)).toBe(true);
    });
  });
});

describe('codereplay_validate_manifest', () => {
  it('returns valid=true for a correct manifest', async () => {
    await withFixture(async (dir, sha) => {
      const manifestPath = await writeFixtureManifest(dir, sha);
      const raw = await readFile(manifestPath, 'utf8');
      const r = await findTool('codereplay_validate_manifest')!.handler(
        { manifest: raw }, { cwd: dir },
      );
      const data = parseContent(r);
      expect(data.valid).toBe(true);
    });
  });

  it('returns valid=false with structured errors for a bad manifest', async () => {
    await withFixture(async (dir) => {
      const r = await findTool('codereplay_validate_manifest')!.handler(
        { manifest: { spec_version: '2.1', project_metadata: {}, steps: [] } }, { cwd: dir },
      );
      const data = parseContent(r);
      expect(data.valid).toBe(false);
      expect(Array.isArray(data.errors)).toBe(true);
      expect(data.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('codereplay_write_manifest', () => {
  it('writes a valid manifest', async () => {
    await withFixture(async (dir, sha) => {
      const manifestPath = await writeFixtureManifest(dir, sha);
      const raw = await readFile(manifestPath, 'utf8');
      const out = `${dir}/out/manifest.json`;
      const r = await findTool('codereplay_write_manifest')!.handler(
        { manifest: raw, path: out }, { cwd: dir },
      );
      const data = parseContent(r);
      expect(data.path).toBe(out);
      expect(data.bytes).toBeGreaterThan(0);
    });
  });

  it('refuses to write an invalid manifest', async () => {
    await withFixture(async (dir) => {
      const r = await findTool('codereplay_write_manifest')!.handler(
        { manifest: { spec_version: '2.0' }, path: `${dir}/bad.json` }, { cwd: dir },
      );
      expect(r.isError).toBe(true);
    });
  });
});

describe('codereplay_verify', () => {
  it('verifies a correct manifest end-to-end', async () => {
    await withFixture(async (dir, sha) => {
      const manifestPath = await writeFixtureManifest(dir, sha);
      const r = await findTool('codereplay_verify')!.handler(
        { repo: dir, manifest_path: manifestPath }, { cwd: dir },
      );
      const data = parseContent(r);
      expect(data.verified).toBe(true);
      expect(data.steps).toBe(3);
    });
  });

  it('rejects a manifest whose replay differs from the target', async () => {
    await withFixture(async (dir, sha) => {
      const manifestPath = await writeFixtureManifest(dir, sha);
      const bad = JSON.parse(await readFile(manifestPath, 'utf8'));
      bad.steps[1].code_changes[0].content = '// corrupted\n';
      await writeFile(manifestPath, JSON.stringify(bad, null, 2));

      const r = await findTool('codereplay_verify')!.handler(
        { repo: dir, manifest_path: manifestPath }, { cwd: dir },
      );
      const data = parseContent(r);
      expect(data.verified).toBe(false);
      expect(typeof data.error).toBe('string');
    });
  });
});
