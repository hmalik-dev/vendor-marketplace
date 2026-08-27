import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const formProps = vi.fn<(props: Record<string, unknown>) => void>();

vi.mock('@/components/auth/sign-up-form', () => ({
  SignUpForm: (props: Record<string, unknown>) => {
    formProps(props);
    return <div data-testid="sign-up-form" />;
  },
}));

const { default: SignUpPage } = await import('./page');

async function renderWith(params: Record<string, string | string[] | undefined>): Promise<unknown> {
  return render(await SignUpPage({ searchParams: Promise.resolve(params) }));
}

describe('SignUpPage', () => {
  afterEach(() => {
    cleanup();
    formProps.mockClear();
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

    expect(formProps).toHaveBeenCalledWith({ initialRole: expected });
  });

  it('asks the question outright when no role is given', async () => {
    await renderWith({});

    expect(formProps).toHaveBeenCalledWith({ initialRole: null });
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

    expect(formProps).toHaveBeenCalledWith({ initialRole: null });
  });
});
