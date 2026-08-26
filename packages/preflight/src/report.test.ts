import { describe, expect, it } from 'vitest';
import { renderReport } from './report.js';
import { fail, pass } from './types.js';

describe('renderReport', () => {
  it('groups results under their capability heading', () => {
    const { lines } = renderReport(
      [pass('core', 'Node >= 20', 'v22'), pass('auth', 'CLERK_SECRET_KEY', 'set')],
      'Preflight',
    );
    const text = lines.join('\n');

    expect(text).toContain('App + Database');
    expect(text).toContain('Auth (Clerk)');
  });

  it('prints the fix on its own line under a failure', () => {
    const { lines } = renderReport(
      [fail('stripe', 'STRIPE_SECRET_KEY', 'still the placeholder', 'stripe login')],
      'Preflight',
    );

    expect(lines).toContain('  ✗ STRIPE_SECRET_KEY — still the placeholder');
    expect(lines).toContain('      → stripe login');
  });

  it('prints no fix line for a passing check', () => {
    const { lines } = renderReport([pass('core', 'Node >= 20')], 'Preflight');

    expect(lines.filter((line) => line.includes('→'))).toEqual([]);
  });

  it('counts every failure rather than reporting only the first', () => {
    const report = renderReport(
      [
        fail('stripe', 'STRIPE_SECRET_KEY', 'placeholder', 'stripe login'),
        fail('stripe', 'STRIPE_WEBHOOK_SECRET', 'placeholder', 'stripe listen'),
        pass('core', 'Node >= 20'),
      ],
      'Preflight',
    );

    expect(report.failures).toBe(2);
    expect(report.lines.at(-1)).toContain('2 of 3 checks failed');
  });

  it('reports a clean run', () => {
    const report = renderReport([pass('core', 'Node >= 20')], 'Preflight');

    expect(report.failures).toBe(0);
    expect(report.lines.at(-1)).toContain('1 checks passed');
  });

  it('omits a capability with no results', () => {
    const { lines } = renderReport([pass('core', 'Node >= 20')], 'Preflight');

    expect(lines.join('\n')).not.toContain('Payments');
  });
});
