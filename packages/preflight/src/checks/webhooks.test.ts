import { describe, expect, it, vi } from 'vitest';
import type { CommandOutcome } from '../exec.js';
import { type CommandRunner, evaluateStripeSecretDrift } from './webhooks.js';

const ok = (stdout: string): CommandOutcome => ({ status: 'ok', stdout, stderr: '' });
const failed = (stderr = 'You must first run `stripe login`'): CommandOutcome => ({
  status: 'failed',
  stdout: '',
  stderr,
});

/*
 * The bug: preflight checked `STRIPE_WEBHOOK_SECRET`'s shape and that the CLI
 * was installed, and reported the capability green — but the forwarder mints
 * its own secret, and the two can disagree. Every locally delivered webhook
 * then 401s, which reads exactly like a signature-verification bug in the
 * route under test.
 */
describe('evaluateStripeSecretDrift', () => {
  it('passes when the configured secret matches what the forwarder would mint', async () => {
    const run = vi.fn<CommandRunner>().mockResolvedValue(ok('whsec_abc123'));

    const result = await evaluateStripeSecretDrift({ STRIPE_WEBHOOK_SECRET: 'whsec_abc123' }, run);

    expect(result?.ok).toBe(true);
    expect(run).toHaveBeenCalledWith('stripe', ['listen', '--print-secret']);
  });

  it('fails when the two secrets disagree', async () => {
    const run = vi.fn<CommandRunner>().mockResolvedValue(ok('whsec_freshly_minted'));

    const result = await evaluateStripeSecretDrift(
      { STRIPE_WEBHOOK_SECRET: 'whsec_stale_from_dotenv' },
      run,
    );

    expect(result?.ok).toBe(false);
    expect(result?.detail).toContain('401');
    expect(result?.fix).toContain('stripe listen --print-secret');
  });

  /* The whole point: neither secret may reach a result a failure gets pasted into. */
  it('never places either secret in the result it returns', async () => {
    const run = vi.fn<CommandRunner>().mockResolvedValue(ok('whsec_freshly_minted'));

    const result = await evaluateStripeSecretDrift(
      { STRIPE_WEBHOOK_SECRET: 'whsec_stale_from_dotenv' },
      run,
    );

    const rendered = JSON.stringify(result);
    expect(rendered).not.toContain('whsec_freshly_minted');
    expect(rendered).not.toContain('whsec_stale_from_dotenv');
  });

  it('has nothing to compare when STRIPE_WEBHOOK_SECRET is unset', async () => {
    const run = vi.fn<CommandRunner>();

    const result = await evaluateStripeSecretDrift({}, run);

    expect(result).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it('stays silent rather than failing when the CLI is not logged in', async () => {
    const run = vi.fn<CommandRunner>().mockResolvedValue(failed());

    const result = await evaluateStripeSecretDrift({ STRIPE_WEBHOOK_SECRET: 'whsec_abc123' }, run);

    expect(result).toBeNull();
  });

  it('stays silent when the CLI is missing rather than reporting drift', async () => {
    const run = vi
      .fn<CommandRunner>()
      .mockResolvedValue({ status: 'missing', stdout: '', stderr: '' });

    const result = await evaluateStripeSecretDrift({ STRIPE_WEBHOOK_SECRET: 'whsec_abc123' }, run);

    expect(result).toBeNull();
  });

  it('stays silent when the CLI answers something that is not a secret', async () => {
    const run = vi.fn<CommandRunner>().mockResolvedValue(ok('Getting ready...'));

    const result = await evaluateStripeSecretDrift({ STRIPE_WEBHOOK_SECRET: 'whsec_abc123' }, run);

    expect(result).toBeNull();
  });
});
