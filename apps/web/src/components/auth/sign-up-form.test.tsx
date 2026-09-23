import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { AUTH_COPY } from '@/app/auth-copy';
import { readSignUpRole } from '@/lib/auth/signup-role';

const replace = vi.fn();
const refresh = vi.fn();
const signUpWithEmail = vi.fn();
const signInWithEmail = vi.fn();
const verifyEmailCode = vi.fn();
const resendVerificationCode = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock('@/lib/auth/auth-requests', () => ({
  signUpWithEmail: (input: unknown) => signUpWithEmail(input),
  signInWithEmail: (input: unknown) => signInWithEmail(input),
  verifyEmailCode: (input: unknown) => verifyEmailCode(input),
  resendVerificationCode: (email: unknown) => resendVerificationCode(email),
}));

const { SignUpForm } = await import('./sign-up-form');

const CUSTOMER = "I'm planning an event";
const VENDOR = "I'm a vendor";
const CREATE = 'Create my account';

/** The proof headline is the one `<p>` that opens with the panel's first line. */
function headlineStartingWith(container: HTMLElement, start: string): HTMLParagraphElement {
  const found = [...container.querySelectorAll('p')].find((p) => p.textContent?.startsWith(start));

  if (!found) {
    throw new Error(`no headline starting with "${start}"`);
  }

  return found;
}

async function fillCredentials(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText('Email'), 'sam@example.com');
  await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
}

describe('SignUpForm', () => {
  beforeEach(() => {
    signUpWithEmail.mockReset().mockResolvedValue('ok');
    signInWithEmail.mockReset().mockResolvedValue('ok');
    verifyEmailCode.mockReset().mockResolvedValue('ok');
    resendVerificationCode.mockReset().mockResolvedValue('ok');
    replace.mockReset();
    refresh.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  /*
   * Typing first and choosing second is a normal order, so the fields stay
   * live with no role chosen — only the submit is gated.
   * See design/design-plan/21-sign-up.md.
   */
  it('shows the form with no role chosen, and marks the submit pending', () => {
    const { container } = render(<SignUpForm initialRole={null} vendorInviteOnly={false} />);

    expect(screen.getByLabelText('Email')).toHaveProperty('disabled', false);
    expect(screen.getByLabelText('Password')).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: CREATE })).toBeDefined();
    expect(screen.getByRole('radio', { name: new RegExp(CUSTOMER) })).toHaveProperty(
      'checked',
      false,
    );
    expect(screen.getByRole('radio', { name: new RegExp(VENDOR) })).toHaveProperty(
      'checked',
      false,
    );
    expect(container.querySelector('[data-role-pending]')).not.toBeNull();
    expect(screen.getByText('Pick one above to continue')).toBeDefined();
  });

  /* VEN-451: frame `12` draws the card description at 12px and the fields on stone-0. */
  it('shows one agreement line, frame 12s, with working links under the submit and no checkbox', () => {
    render(<SignUpForm initialRole={null} vendorInviteOnly={false} />);

    const notice = screen.getByText(/^By signing up/);
    expect(notice.textContent).toBe(
      'By signing up, you agree to the Terms of Service and Privacy Policy.',
    );
    expect(document.querySelector('[data-continue-notice]')).toBeNull();
    expect(
      within(notice).getByRole('link', { name: 'Terms of Service' }).getAttribute('href'),
    ).toBe('/terms');
    expect(within(notice).getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe(
      '/privacy',
    );
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(
      screen.getByRole('button', { name: CREATE }).compareDocumentPosition(notice) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('draws the role descriptions at 12px and the fields on stone-0', () => {
    render(<SignUpForm initialRole={null} vendorInviteOnly={false} />);

    const description = screen.getByText('Find and book vendors near you.');
    expect(description.className.split(' ')).toContain('text-[12px]');
    expect(description.className.split(' ')).not.toContain('text-sm');
    expect(screen.getByLabelText('Email').className.split(' ')).toContain('bg-stone-0');
  });

  /*
   * The API narrows a missing role to `customer`, so a sign-up that got through
   * without one would put a vendor on the wrong side of the product with no way
   * back — the exact thing the subhead says can't be changed later.
   */
  it('blocks submission until a role is chosen, then stops blocking', async () => {
    const user = userEvent.setup();
    const { container } = render(<SignUpForm initialRole={null} vendorInviteOnly={false} />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: CREATE }));

    expect(signUpWithEmail).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Pick one above to continue');

    await user.click(screen.getByRole('radio', { name: new RegExp(VENDOR) }));
    expect(container.querySelector('[data-role-pending]')).toBeNull();

    await user.click(screen.getByRole('button', { name: CREATE }));
    await waitFor(() => expect(signUpWithEmail).toHaveBeenCalledTimes(1));
  });

  it('blocks the Enter key the same way as the button', async () => {
    const user = userEvent.setup();
    render(<SignUpForm initialRole={null} vendorInviteOnly={false} />);

    await fillCredentials(user);
    fireEvent.submit(screen.getByLabelText('Email').closest('form') as HTMLFormElement);

    expect(signUpWithEmail).not.toHaveBeenCalled();
  });

  it('drops the pending hint once a role is chosen', async () => {
    const user = userEvent.setup();
    render(<SignUpForm initialRole={null} vendorInviteOnly={false} />);

    await user.click(screen.getByRole('radio', { name: new RegExp(CUSTOMER) }));

    expect(screen.queryByText('Pick one above to continue')).toBeNull();
  });

  /*
   * The choice is irreversible, so both options stay on screen after selection
   * rather than collapsing to a line of text — the visitor can still see what
   * they did not pick, and change it, right up until the form is submitted.
   */
  it('keeps both roles visible and selectable after one is chosen', async () => {
    const user = userEvent.setup();
    render(<SignUpForm initialRole={null} vendorInviteOnly={false} />);

    await user.click(screen.getByRole('radio', { name: new RegExp(VENDOR) }));

    const vendor = screen.getByRole('radio', { name: new RegExp(VENDOR) });
    const customer = screen.getByRole('radio', { name: new RegExp(CUSTOMER) });

    expect(vendor).toHaveProperty('checked', true);
    expect(customer).toHaveProperty('checked', false);

    await user.click(customer);
    expect(screen.getByRole('radio', { name: new RegExp(CUSTOMER) })).toHaveProperty(
      'checked',
      true,
    );
  });

  it('creates the account with the address, the password and a name from the address', async () => {
    const user = userEvent.setup();
    render(<SignUpForm initialRole="vendor" vendorInviteOnly={false} />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: CREATE }));

    await waitFor(() => expect(signUpWithEmail).toHaveBeenCalledTimes(1));
    expect(signUpWithEmail).toHaveBeenCalledWith({
      email: 'sam@example.com',
      password: 'correct-horse-battery',
      name: 'sam',
    });
  });

  it('asks for the emailed code once the account exists, and hides the role question', async () => {
    const user = userEvent.setup();
    render(<SignUpForm initialRole="customer" vendorInviteOnly={false} />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: CREATE }));

    expect(await screen.findByLabelText('Verification code')).toBeDefined();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('asks Neon for the code once the account exists', async () => {
    const user = userEvent.setup();
    render(<SignUpForm initialRole="customer" vendorInviteOnly={false} />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: CREATE }));
    await screen.findByLabelText('Verification code');

    expect(resendVerificationCode).toHaveBeenCalledTimes(1);
    expect(resendVerificationCode).toHaveBeenCalledWith('sam@example.com');
    expect(screen.queryByText(AUTH_COPY.throttled)).toBeNull();
    expect(screen.queryByText(AUTH_COPY.unreachable)).toBeNull();
  });

  /*
   * VEN-620, seen live: Neon's own limiter answered the post-sign-up send 429
   * ("Too many requests"), the account existed, and the code step showed
   * nothing — asking for a code that was never mailed.
   */
  it.each([
    ['throttled', "This isn't going through right now. Wait a few minutes and try again."],
    ['unreachable', 'We could not reach the sign-in service. Try again in a moment.'],
  ] as const)('says so on the code step when the code send is %s', async (outcome, copy) => {
    resendVerificationCode.mockResolvedValue(outcome);
    const user = userEvent.setup();
    render(<SignUpForm initialRole="customer" vendorInviteOnly={false} />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: CREATE }));

    expect(await screen.findByLabelText('Verification code')).toBeDefined();
    expect(screen.getByText(copy)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Send a new code' })).toBeDefined();
  });

  it('remembers the chosen role for the accept-terms screen once the account exists', async () => {
    const user = userEvent.setup();
    render(<SignUpForm initialRole="vendor" vendorInviteOnly={false} />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: CREATE }));
    await screen.findByLabelText('Verification code');

    expect(readSignUpRole()).toBe('vendor');
  });

  it('does not remember a role, or leave the form, when the sign-up is refused', async () => {
    signUpWithEmail.mockResolvedValue('rejected');
    const user = userEvent.setup();
    render(<SignUpForm initialRole="vendor" vendorInviteOnly={false} />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: CREATE }));

    expect(await screen.findByText(/could not create that account/)).toBeDefined();
    expect(readSignUpRole()).toBeNull();
    expect(screen.queryByLabelText('Verification code')).toBeNull();
  });

  /*
   * `sign-up/email` is address-budgeted at 5 per 10 minutes (VEN-462). Before
   * the `throttled` outcome existed, a 429 there fell into the same bucket as
   * a genuine refusal and told the visitor their details were bad.
   */
  it('says to wait, not that the account could not be created, once throttled', async () => {
    signUpWithEmail.mockResolvedValue('throttled');
    const user = userEvent.setup();
    render(<SignUpForm initialRole="vendor" vendorInviteOnly={false} />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: CREATE }));

    expect(
      await screen.findByText(
        "This isn't going through right now. Wait a few minutes and try again.",
      ),
    ).toBeDefined();
    expect(screen.queryByText(/could not create that account/)).toBeNull();
    expect(readSignUpRole()).toBeNull();
    expect(screen.queryByLabelText('Verification code')).toBeNull();
  });

  it('signs in and lands on /after-sign-in after a good code', async () => {
    const user = userEvent.setup();
    render(<SignUpForm initialRole="customer" vendorInviteOnly={false} />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: CREATE }));
    await user.type(await screen.findByLabelText('Verification code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify email' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/after-sign-in'));
    expect(verifyEmailCode).toHaveBeenCalledWith({ email: 'sam@example.com', otp: '123456' });
    expect(signInWithEmail).toHaveBeenCalledWith({
      email: 'sam@example.com',
      password: 'correct-horse-battery',
    });
  });

  it('says to wait, not that the service is unreachable, when the post-verify sign-in is throttled', async () => {
    signInWithEmail.mockResolvedValue('throttled');
    const user = userEvent.setup();
    render(<SignUpForm initialRole="customer" vendorInviteOnly={false} />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: CREATE }));
    await user.type(await screen.findByLabelText('Verification code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify email' }));

    expect(
      await screen.findByText(
        "This isn't going through right now. Wait a few minutes and try again.",
      ),
    ).toBeDefined();
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows the error and stays on the code step after a wrong code', async () => {
    verifyEmailCode.mockResolvedValue('rejected');
    const user = userEvent.setup();
    render(<SignUpForm initialRole="customer" vendorInviteOnly={false} />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: CREATE }));
    await user.type(await screen.findByLabelText('Verification code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify email' }));

    expect(
      await screen.findByText('That code did not work. Check it and try again.'),
    ).toBeDefined();
    expect(screen.getByLabelText('Verification code')).toBeDefined();
    expect(signInWithEmail).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('asks for a fresh code on request', async () => {
    const user = userEvent.setup();
    render(<SignUpForm initialRole="customer" vendorInviteOnly={false} />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: CREATE }));
    await user.click(await screen.findByRole('button', { name: 'Send a new code' }));

    expect(resendVerificationCode).toHaveBeenCalledWith('sam@example.com');
    expect(await screen.findByText('A new code is on its way.')).toBeDefined();
  });

  /*
   * Neon's per-address budget on `email-otp/verify-email` is 5 calls per 10
   * minutes, right or wrong (VEN-462): a person who mistypes a couple of times
   * hits it. Before the `throttled` outcome existed, `outcomeOf` folded a 429
   * into the same `rejected` bucket as a wrong code, so this screen told them
   * their code was wrong even on a correct one they were no longer allowed to
   * spend.
   */
  it('says to wait, not that the code is wrong, once the address is throttled', async () => {
    verifyEmailCode.mockResolvedValue('throttled');
    const user = userEvent.setup();
    render(<SignUpForm initialRole="customer" vendorInviteOnly={false} />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: CREATE }));
    await user.type(await screen.findByLabelText('Verification code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify email' }));

    expect(
      await screen.findByText(
        "This isn't going through right now. Wait a few minutes and try again.",
      ),
    ).toBeDefined();
    expect(screen.queryByText('That code did not work. Check it and try again.')).toBeNull();
    expect(signInWithEmail).not.toHaveBeenCalled();
  });

  /*
   * Better Auth's `emailOTP` plugin invalidates a code after `allowedAttempts`
   * wrong guesses (default 3) — its own docs say the fix is a fresh code, not
   * a wait, so this must read differently from both the address-throttle
   * banner above and the ordinary wrong-code banner: waiting a few minutes
   * would still fail on this exact code.
   */
  it('says the code is dead, not to wait, once attempts on it are exhausted', async () => {
    verifyEmailCode.mockResolvedValue('codeInvalid');
    const user = userEvent.setup();
    render(<SignUpForm initialRole="customer" vendorInviteOnly={false} />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: CREATE }));
    await user.type(await screen.findByLabelText('Verification code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify email' }));

    expect(
      await screen.findByText('That code can no longer be used. Send a new one below.'),
    ).toBeDefined();
    expect(screen.queryByText('That code did not work. Check it and try again.')).toBeNull();
    expect(
      screen.queryByText("This isn't going through right now. Wait a few minutes and try again."),
    ).toBeNull();
    expect(signInWithEmail).not.toHaveBeenCalled();
  });

  it('says to wait, not that the service is unreachable, when a resend is throttled', async () => {
    // The send right after sign-up succeeds; only the resend is refused.
    resendVerificationCode.mockResolvedValueOnce('ok').mockResolvedValue('throttled');
    const user = userEvent.setup();
    render(<SignUpForm initialRole="customer" vendorInviteOnly={false} />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: CREATE }));
    const resend = await screen.findByRole('button', { name: 'Send a new code' });
    expect(
      screen.queryByText("This isn't going through right now. Wait a few minutes and try again."),
    ).toBeNull();
    await user.click(resend);

    expect(
      await screen.findByText(
        "This isn't going through right now. Wait a few minutes and try again.",
      ),
    ).toBeDefined();
  });

  it('does not call an actual refusal a throttle when a resend is refused', async () => {
    // The send right after sign-up succeeds; only the resend is refused.
    resendVerificationCode.mockResolvedValueOnce('ok').mockResolvedValue('rejected');
    const user = userEvent.setup();
    render(<SignUpForm initialRole="customer" vendorInviteOnly={false} />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: CREATE }));
    const resend = await screen.findByRole('button', { name: 'Send a new code' });
    expect(
      screen.queryByText('We could not reach the sign-in service. Try again in a moment.'),
    ).toBeNull();
    await user.click(resend);

    expect(
      await screen.findByText('We could not reach the sign-in service. Try again in a moment.'),
    ).toBeDefined();
    expect(
      screen.queryByText("This isn't going through right now. Wait a few minutes and try again."),
    ).toBeNull();
  });

  it('groups the two roles under one labelled choice', () => {
    render(<SignUpForm initialRole={null} vendorInviteOnly={false} />);

    expect(screen.getByRole('group', { name: 'Which one are you?' })).toBeDefined();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  /*
   * `?role=vendor` is a pre-selection, not a decision made for the visitor: the
   * vendor card starts checked and the form is already up, but the customer
   * card is still one click away.
   */
  it('pre-selects the role it was given and shows the form straight away', () => {
    render(<SignUpForm initialRole="vendor" vendorInviteOnly={false} />);

    expect(screen.getByRole('radio', { name: new RegExp(VENDOR) })).toHaveProperty('checked', true);
    expect(screen.getByRole('radio', { name: new RegExp(CUSTOMER) })).toHaveProperty(
      'checked',
      false,
    );
    expect(screen.getByLabelText('Email')).toBeDefined();
  });

  /*
   * The default panel sells a two-sided marketplace to someone who has not said
   * which side they are on, so each line names its audience. Generic copy for
   * everyone says nothing to either.
   */
  it('labels each line of the default panel with the side it belongs to', () => {
    render(<SignUpForm initialRole={null} vendorInviteOnly={false} />);

    for (const [label, line] of [
      ['Booking', "See what a vendor charges and when they're free"],
      ['Vending', 'Publish your prices and own your calendar'],
      ['Both', 'Payment held until the event is complete'],
    ]) {
      expect(screen.getByText(label), label).toBeDefined();
      expect(screen.getByText(line), line).toBeDefined();
    }
  });

  it('states the three customer guarantees and no platform statistics', async () => {
    const user = userEvent.setup();
    render(<SignUpForm initialRole={null} vendorInviteOnly={false} />);

    await user.click(screen.getByRole('radio', { name: new RegExp(CUSTOMER) }));

    expect(screen.getByText('Live calendars — if a date shows open, it is')).toBeDefined();
    expect(screen.getByText('Payment held until the event is complete')).toBeDefined();
    expect(screen.getByText('Published prices, and no service fee on top')).toBeDefined();

    // Nothing on this screen may claim a scale the product does not have.
    expect(document.body.textContent).not.toMatch(/\d[\d,]*\s*(vendors|events|reviews|bookings)/i);
    expect(document.body.textContent).not.toMatch(/thousands|#1|trusted by/i);
  });

  it('leads the default panel with its own three-line headline', () => {
    const { container } = render(<SignUpForm initialRole={null} vendorInviteOnly={false} />);

    const headline = headlineStartingWith(container, 'Clear prices.');

    expect(headline.textContent).toBe('Clear prices.Open calendars.No back-and-forth.');
    const accent = headline.querySelector('span');
    expect(accent?.textContent).toBe('No back-and-forth.');
    expect(accent?.className).toContain('italic');
    expect(accent?.className).toContain('text-gold-150');
  });

  it('leads the customer panel with the three-line headline, closing in italic', async () => {
    const user = userEvent.setup();
    const { container } = render(<SignUpForm initialRole={null} vendorInviteOnly={false} />);

    await user.click(screen.getByRole('radio', { name: new RegExp(CUSTOMER) }));

    const headline = headlineStartingWith(container, 'See the price.');

    // Both halves of the premise, then the line that hands over the decision.
    expect(headline.textContent).toBe('See the price.See the open dates.Then decide.');
    // "Then decide." is the only italic run, in the scrimmed-panel gold (D30).
    const accent = headline.querySelector('span');
    expect(accent?.textContent).toBe('Then decide.');
    expect(accent?.className).toContain('italic');
    expect(accent?.className).toContain('text-gold-150');
  });

  it('demonstrates published pricing rather than calling it transparent', async () => {
    const user = userEvent.setup();
    render(<SignUpForm initialRole={null} vendorInviteOnly={false} />);

    await user.click(screen.getByRole('radio', { name: new RegExp(CUSTOMER) }));

    expect(
      screen.getByText(/Every vendor publishes what they charge and when they're free/),
    ).toBeDefined();
    // 21-sign-up.md: never use the word, show the mechanism instead.
    expect(document.body.textContent).not.toMatch(/transparen/i);
  });

  /*
   * Same premise, inverted: a customer is promised they will *see* the price
   * and the open dates; a vendor is promised they *set* them.
   */
  it('swaps the marketing panel to the vendor pitch when the vendor role is chosen', async () => {
    const user = userEvent.setup();
    const { container } = render(<SignUpForm initialRole={null} vendorInviteOnly={false} />);

    await user.click(screen.getByRole('radio', { name: new RegExp(VENDOR) }));

    const headline = headlineStartingWith(container, 'Set your prices.');
    expect(headline.textContent).toBe('Set your prices.Set your dates.Get booked.');

    const accent = headline.querySelector('span');
    expect(accent?.textContent).toBe('Get booked.');
    expect(accent?.className).toContain('italic');
    // Sage, not gold — the accent matches the panel and the selected card.
    expect(accent?.className).toContain('text-sage-150');

    expect(screen.getByText('You publish your own packages and prices')).toBeDefined();
    expect(screen.getByText("Your calendar decides which dates you're offered")).toBeDefined();
    expect(screen.getByText('Paid out after the event — no chasing invoices')).toBeDefined();

    // The customer pitch is gone, not stacked underneath.
    expect(screen.queryByText('Live calendars — if a date shows open, it is')).toBeNull();
  });

  /*
   * Vendors do pay something and the model isn't settled, so no vendor-facing
   * surface makes a fee claim in either direction — see 98-post-mvp.md.
   */
  it('makes no fee claim anywhere on the vendor panel', async () => {
    const user = userEvent.setup();
    render(<SignUpForm initialRole={null} vendorInviteOnly={false} />);

    await user.click(screen.getByRole('radio', { name: new RegExp(VENDOR) }));

    expect(document.body.textContent).not.toMatch(/fee|commission|subscription|% of/i);
    // It never claims volume either — that is a platform-scale promise.
    expect(document.body.textContent).not.toMatch(/more bookings|thousands|reach \w+ couples/i);
  });

  it('accents the selected card to match the panel beside it', async () => {
    const user = userEvent.setup();
    render(<SignUpForm initialRole={null} vendorInviteOnly={false} />);

    const cardOf = (name: string): HTMLElement => {
      const label = screen.getByRole('radio', { name: new RegExp(name) }).closest('label');

      if (!label) {
        throw new Error(`no card for ${name}`);
      }

      return label;
    };

    await user.click(screen.getByRole('radio', { name: new RegExp(CUSTOMER) }));
    expect(cardOf(CUSTOMER).className).toContain('border-clay-400');
    expect(cardOf(CUSTOMER).className).toContain('bg-clay-100');

    await user.click(screen.getByRole('radio', { name: new RegExp(VENDOR) }));
    expect(cardOf(VENDOR).className).toContain('border-sage-400');
    expect(cardOf(VENDOR).className).toContain('bg-sage-50');
    // The unselected card drops back to the plain stone treatment.
    expect(cardOf(CUSTOMER).className).toContain('border-stone-300');
  });

  /*
   * VEN-515. The notice is true only for a vendor while the gate is on, so each
   * other combination asserts its absence; the agreement line is for everyone.
   */
  describe('invitation notice and agreement line', () => {
    const NOTICE = `Vendors join ${BRAND_NAME} by invitation for now. Sign up and we'll add you to the waitlist.`;

    it('tells a vendor about the waitlist while the gate is on', () => {
      render(<SignUpForm initialRole="vendor" vendorInviteOnly />);

      expect(screen.getByText(NOTICE)).toBeTruthy();
    });

    it('follows the chosen card after load', async () => {
      const user = userEvent.setup();

      render(<SignUpForm initialRole={null} vendorInviteOnly />);
      expect(screen.queryByText(NOTICE)).toBeNull();

      await user.click(screen.getByRole('radio', { name: new RegExp(VENDOR) }));
      expect(screen.getByText(NOTICE)).toBeTruthy();

      await user.click(screen.getByRole('radio', { name: new RegExp(CUSTOMER) }));
      expect(screen.queryByText(NOTICE)).toBeNull();
    });

    it.each([
      ['a customer, gate on', 'customer', true],
      ['no role, gate on', null, true],
      ['a vendor, gate off or unreadable', 'vendor', false],
      ['a customer, gate off', 'customer', false],
      ['no role, gate off', null, false],
    ] as const)('shows no notice for %s', (_label, initialRole, vendorInviteOnly) => {
      render(<SignUpForm initialRole={initialRole} vendorInviteOnly={vendorInviteOnly} />);

      expect(screen.queryByText(NOTICE)).toBeNull();
      expect(document.querySelector('[data-invite-notice]')).toBeNull();
    });

    it.each([
      ['a customer', 'customer', true],
      ['a vendor', 'vendor', true],
      ['no role', null, true],
      ['a customer', 'customer', false],
      ['a vendor', 'vendor', false],
      ['no role', null, false],
    ] as const)('shows the agreement line for %s (gate on: %j)', (_label, initialRole, gateOn) => {
      const { container } = render(
        <SignUpForm initialRole={initialRole} vendorInviteOnly={gateOn} />,
      );

      const line = [...container.querySelectorAll('p')].find((p) =>
        p.textContent?.startsWith('By signing up'),
      );

      expect(line?.textContent).toBe(
        'By signing up, you agree to the Terms of Service and Privacy Policy.',
      );
      expect(screen.getByRole('link', { name: 'Terms of Service' }).getAttribute('href')).toBe(
        '/terms',
      );
      expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe(
        '/privacy',
      );
    });

    /*
     * The line is a notice. Acceptance is the versioned, audited write on the
     * Terms screen, and the form's only network call is the auth provider's
     * (mocked above), so submitting reaches nothing that could record one.
     */
    it('writes no acceptance when the account is created', async () => {
      const user = userEvent.setup();
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      render(<SignUpForm initialRole="vendor" vendorInviteOnly />);
      await fillCredentials(user);
      await user.click(screen.getByRole('button', { name: CREATE }));

      expect(await screen.findByLabelText('Verification code')).toBeDefined();
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('sits between the submit button and the sign-in line', () => {
      render(<SignUpForm initialRole="vendor" vendorInviteOnly />);

      const notice = screen.getByText(NOTICE);
      const submit = screen.getByRole('button', { name: CREATE });
      const terms = screen.getByRole('link', { name: 'Terms of Service' });
      const signIn = screen.getByRole('link', { name: 'Sign in' });
      const follows = (a: Node, b: Node): boolean =>
        Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

      expect(follows(notice, submit)).toBe(true);
      expect(follows(submit, terms)).toBe(true);
      expect(follows(terms, signIn)).toBe(true);
    });
  });
});
