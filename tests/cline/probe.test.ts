import { describe, it, expect } from 'vitest';
import { runProbe } from '../../src/mcp/probe.js';

describe('Cline connectivity probe', () => {
  it('passes every hard (protocol) check', async () => {
    const report = await runProbe({ e2e: true });

    const hard = report.checks.filter((c) => c.group === 'protocol' || c.group === 'e2e');
    const failed = hard.filter((c) => c.status === 'fail');

    if (failed.length > 0) {
      console.error('Failed hard checks:', failed);
    }
    expect(failed).toEqual([]);
    expect(report.connected).toBe(true);
    expect(report.hard_failures).toBe(0);
  }, 90_000);

  it('reports a soft warning (not a failure) if Cline is not installed', async () => {
    const report = await runProbe();
    // Cline may or may not be installed in the CI environment.
    // Either way, this must be a warn — never a hard failure.
    const clineChecks = report.checks.filter((c) => c.group === 'cline');
    expect(clineChecks.length).toBeGreaterThan(0);
    for (const c of clineChecks) {
      expect(['pass', 'warn']).toContain(c.status);
    }
  }, 60_000);
});
