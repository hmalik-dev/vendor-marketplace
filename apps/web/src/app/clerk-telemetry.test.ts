import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8');

/*
 * Under the enforced Content-Security-Policy (#396), Clerk's browser SDK
 * tried to POST its usage telemetry to `clerk-telemetry.com`, which no
 * directive allows, and every signed-in page logged a violation. The fix is
 * to not send it: the telemetry is Clerk's product analytics, not anything
 * this app relies on, and widening `connect-src` for it would be trading a
 * console error for an outbound channel nobody asked for.
 */
describe('Clerk telemetry', () => {
  it('is switched off on the provider, so the enforced CSP has nothing to block', () => {
    const provider = layout.slice(
      layout.indexOf('<ClerkProvider'),
      layout.indexOf('>', layout.indexOf('<ClerkProvider')),
    );

    expect(provider).toContain('telemetry={false}');
  });
});
