import { describe, expect, it } from 'vitest';
import { LEGACY_REDIRECTS } from './legacy-redirects';

describe('legacy redirects', () => {
  it('sends the old admins console path to /admin/admins with a 308', () => {
    expect(LEGACY_REDIRECTS).toEqual([
      { source: '/admin/operators', destination: '/admin/admins', permanent: true },
    ]);
  });
});
