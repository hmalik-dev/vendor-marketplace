import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const readIdentityForSupport = vi.fn();
vi.mock('@/lib/current-user', () => ({ readIdentityForSupport }));
vi.mock('@/lib/use-api', () => ({ useApi: () => vi.fn() }));

const { default: SupportPage } = await import('./page');

const VALID = {
  digest: 'err_9f4c2a71b3',
  from: '/bookings/abc/checkout',
  at: '2026-06-12T14:41:00.000Z',
};

/** Renders the route with the given query, signed out unless told otherwise. */
async function renderPage(
  params: Record<string, string | string[] | undefined>,
  user: { email: string } | null = null,
): Promise<void> {
  readIdentityForSupport.mockResolvedValue(user);
  render(await SupportPage({ searchParams: Promise.resolve(params) }));
}

describe('/support', () => {
  afterEach(() => {
    cleanup();
    readIdentityForSupport.mockReset();
  });

  it('renders for a signed-out visitor arriving with no query at all', async () => {
    await renderPage({});

    expect(screen.getByRole('heading', { name: 'Tell us what happened' })).toBeDefined();
    expect(screen.getByLabelText('Your email')).toBeDefined();
    expect(screen.queryByText('Attached automatically')).toBeNull();
  });

  it('names the account address for a signed-in visitor', async () => {
    await renderPage({}, { email: 'ana@nandakumar.co' });

    expect(screen.queryByLabelText('Your email')).toBeNull();
    expect(screen.getByText(/the email on your account/).textContent).toContain(
      'ana@nandakumar.co',
    );
  });

  it('attaches the reference when the whole context parses', async () => {
    await renderPage(VALID);

    expect(screen.getByText('Attached automatically')).toBeDefined();
    expect(screen.getByText(VALID.digest)).toBeDefined();
  });

  /*
   * `web-route-boundaries.md`: `searchParams` is attacker-controlled, and this
   * screen quotes what it is given back into an email. So each hostile shape is
   * driven rather than reasoned about — the rule's own regression test asks for
   * the *outcome*, not the parse.
   *
   * The block is dropped **whole** rather than per field: a reference with a
   * plausible digest and a junk route reaches the support inbox looking like a
   * server-log entry, and half of it is a lie.
   */
  const HOSTILE: [string, Record<string, string | string[] | undefined>][] = [
    ['an absolute URL as the route', { ...VALID, from: 'https://evil.example.com/pay' }],
    // A protocol-relative URL clears a naive `^/` and is a real address.
    ['a protocol-relative route', { ...VALID, from: '//evil.example.com' }],
    // Every browser normalises the backslash to a slash, so it is the same.
    ['a backslash-relative route', { ...VALID, from: String.raw`/\evil.example.com` }],
    ['a route that is not a path at all', { ...VALID, from: 'javascript:alert(1)' }],
    ['a digest carrying markup', { ...VALID, digest: '<script>alert(1)</script>' }],
    ['a digest 400 characters long', { ...VALID, digest: 'a'.repeat(400) }],
    ['a timestamp that is not a date', { ...VALID, at: 'not-a-date' }],
    ['a timestamp that cannot exist', { ...VALID, at: '2026-13-45T99:99:99Z' }],
    ['a repeated parameter, which arrives as an array', { ...VALID, digest: ['a', 'b'] }],
    ['a digest with no route or moment', { digest: VALID.digest }],
    ['every value empty', { digest: '', from: '', at: '' }],
  ];

  it.each(HOSTILE)('renders the screen with no reference for %s', async (_name, params) => {
    await renderPage(params);

    // The page renders — it does not throw into the error boundary, which is
    // what a `new Date()` or an `Intl` formatter on an unvalidated value does.
    expect(screen.getByRole('heading', { name: 'Tell us what happened' })).toBeDefined();
    expect(screen.queryByText('Attached automatically')).toBeNull();
  });
});
