import { describe, expect, it } from 'vitest';
import { isInstalled, runCommand } from './exec.js';

describe('runCommand', () => {
  it('reports a missing executable distinctly from a non-zero exit', async () => {
    expect((await runCommand('definitely-not-a-real-binary-xyz', [])).status).toBe('missing');
    expect((await runCommand('false', [])).status).toBe('failed');
  });

  it('captures stdout from a successful command', async () => {
    const outcome = await runCommand('echo', ['hello']);
    expect(outcome.status).toBe('ok');
    expect(outcome.stdout).toBe('hello');
  });

  it('passes an explicit environment through to the child', async () => {
    const outcome = await runCommand('printenv', ['LANE_PROBE'], 10_000, {
      ...process.env,
      LANE_PROBE: 'lane-42',
    });

    expect(outcome.status).toBe('ok');
    expect(outcome.stdout).toBe('lane-42');
  });

  it('lets an explicit environment override an inherited value', async () => {
    process.env.LANE_PROBE_INHERITED = 'from-parent';

    const outcome = await runCommand('printenv', ['LANE_PROBE_INHERITED'], 10_000, {
      ...process.env,
      LANE_PROBE_INHERITED: 'from-lane',
    });

    expect(outcome.stdout).toBe('from-lane');
    delete process.env.LANE_PROBE_INHERITED;
  });
});

describe('isInstalled', () => {
  it('distinguishes a real executable from a missing one', async () => {
    expect(await isInstalled('echo')).toBe(true);
    expect(await isInstalled('definitely-not-a-real-binary-xyz')).toBe(false);
  });
});
