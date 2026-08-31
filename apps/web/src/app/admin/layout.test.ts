import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const layout = readFileSync(join(process.cwd(), 'src/app/admin/layout.tsx'), 'utf8');

/*
 * The console's role bounce, guarded at the source rather than by rendering it.
 *
 * The layout is an async Server Component whose whole job is two awaits and a
 * `redirect`; a jsdom render of it asserts nothing about which redirect wins,
 * because `redirect()` throws and both candidates throw. What decides the
 * answer is the *order* of the two reads, and that is a fact about this file.
 */
describe('the admin layout resolves the role before anything else', () => {
  it('does not race the role check against the badge read', () => {
    /*
     * The defect: `Promise.all([requireRole('admin'), getAdminReviews(…)])`.
     * Both throw a `redirect` for a signed-in non-admin — `/bookings` for a
     * customer from the first, `/` from the second's 403 handler — so whichever
     * settled first won and the destination was non-deterministic. A browser
     * pass caught a customer landing on `/` instead of their bookings.
     */
    expect(layout).not.toMatch(/Promise\.all\(\s*\[\s*requireRole/);
  });

  it('awaits requireRole before it reads anything else', () => {
    const roleCheck = layout.indexOf("await requireRole('admin')");
    const badgeRead = layout.indexOf('await getAdminReviews(');

    expect(roleCheck).toBeGreaterThan(-1);
    expect(badgeRead).toBeGreaterThan(-1);
    expect(roleCheck).toBeLessThan(badgeRead);
  });
});
