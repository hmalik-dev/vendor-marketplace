import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const formProps = vi.fn<(props: Record<string, unknown>) => void>();

vi.mock('@/components/auth/sign-up-form', () => ({
  SignUpForm: (props: Record<string, unknown>) => {
    formProps(props);
    return <div data-testid="sign-up-form" />;
  },
}));

const gate = vi.hoisted(() => ({ vendorInviteOnly: false }));

vi.mock('@/lib/vendor-data', () => ({
  getVendorSignUpGate: async () => ({ vendorInviteOnly: gate.vendorInviteOnly }),
}));

const redirectIfSignedIn = vi.fn<() => Promise<void>>();

vi.mock('@/lib/current-user', () => ({ redirectIfSignedIn: () => redirectIfSignedIn() }));

const { default: SignUpPage } = await import('./page');

async function renderWith(params: Record<string, string | string[] | undefined>): Promise<unknown> {
  return render(await SignUpPage({ searchParams: Promise.resolve(params) }));
}

describe('SignUpPage', () => {
  afterEach(() => {
    cleanup();
    formProps.mockClear();
    gate.vendorInviteOnly = false;
    redirectIfSignedIn.mockReset();
  });

  /*
   * Regression (VEN-582): this guard used to live in a shared `layout.tsx`
   * wrapping every `/sign-up/*` route, including `/sign-up/vendor-details` —
   * which meant a verified vendor session the invite gate refused (answering
   * TERMS_REQUIRED, which `redirectIfSignedIn` treats as held) was bounced off
   * its own waitlist details screen back to `/after-sign-in`, in a loop, and
   * never saw the form VEN-512 built for it. The guard now belongs to this
   * page alone.
   */
  it('never renders when the signed-in guard redirects', async () => {
    redirectIfSignedIn.mockRejectedValue(new Error('NEXT_REDIRECT:/after-sign-in'));

    await expect(SignUpPage({ searchParams: Promise.resolve({ role: 'vendor' }) })).rejects.toThrow(
      'NEXT_REDIRECT:/after-sign-in',
    );

    expect(formProps).not.toHaveBeenCalled();
  });

  it('renders the form for a signed-out visitor', async () => {
    redirectIfSignedIn.mockResolvedValue(undefined);

    await renderWith({ role: 'vendor' });

    expect(formProps).toHaveBeenCalledWith({ initialRole: 'vendor', vendorInviteOnly: false });
  });

  /* Read on the server so the notice is in the first paint (VEN-515). */
  it.each([true, false])('passes the invite gate (%s) to the form', async (on) => {
    gate.vendorInviteOnly = on;

    await renderWith({ role: 'vendor' });

    expect(formProps).toHaveBeenCalledWith({ initialRole: 'vendor', vendorInviteOnly: on });
  });

  /*
   * The header's "List your services" link is the vendor door, and it has to
   * land with the vendor card already chosen — a pre-selection that arrives a
   * frame late reads as the page changing its mind.
   */
  it.each([
    ['vendor', 'vendor'],
    ['customer', 'customer'],
  ] as const)('pre-selects the %s role from ?role=', async (param, expected) => {
    await renderWith({ role: param });

    expect(formProps).toHaveBeenCalledWith({ initialRole: expected, vendorInviteOnly: false });
  });

  it('asks the question outright when no role is given', async () => {
    await renderWith({});

    expect(formProps).toHaveBeenCalledWith({ initialRole: null, vendorInviteOnly: false });
  });

  /*
   * The role is irreversible, so an unrecognised string must never quietly
   * become a choice — including a repeated param, which arrives as an array.
   */
  it.each([
    ['an unknown role', { role: 'admin' }],
    ['an empty role', { role: '' }],
    ['a repeated role', { role: ['vendor', 'customer'] }],
  ])('falls back to no pre-selection for %s', async (_label, params) => {
    await renderWith(params);

    expect(formProps).toHaveBeenCalledWith({ initialRole: null, vendorInviteOnly: false });
  });
});
