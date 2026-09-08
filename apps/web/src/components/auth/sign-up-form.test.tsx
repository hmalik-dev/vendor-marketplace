import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CHALLENGE_STALL_BODY,
  CHALLENGE_STALL_RETRY,
  CHALLENGE_STALL_TITLE,
  SIGN_UP_CHALLENGE_RECHECK_MS,
  SIGN_UP_CHALLENGE_TIMEOUT_MS,
} from './challenge-stall';

const signUpProps = vi.fn<(props: Record<string, unknown>) => void>();

/**
 * Clerk's in-flight sign-up attempt, as `useSignUp` reports it.
 *
 * `null` is the ordinary first render — no attempt started. A populated object
 * is what the component sees **after** Clerk's email-verification step, which
 * is a path navigation that remounts this component with its local state gone.
 */
let attempt: { id?: string; status: string; unsafeMetadata: Record<string, unknown> } | null = null;

/**
 * Whether Clerk's card has locked itself, which is what it does while it waits
 * on the bot challenge — and, when the challenge never answers, for ever.
 *
 * The stub renders the real card's shape rather than a marker div, because the
 * bounded wait in #464 reads the DOM: it asks whether the person can still act
 * on the form. A stub with no fields would answer that question by accident.
 */
let clerkCardLocked = false;

vi.mock('@clerk/nextjs', () => ({
  SignUp: (props: Record<string, unknown>) => {
    signUpProps(props);
    return (
      <div data-testid="clerk-sign-up">
        <form onSubmit={(event) => event.preventDefault()}>
          <input name="emailAddress" aria-label="Email" disabled={clerkCardLocked} />
          <button type="submit" disabled={clerkCardLocked}>
            Create my account
          </button>
        </form>
      </div>
    );
  },
  useSignUp: () => ({ isLoaded: true, signUp: attempt }),
}));

const { SignUpForm } = await import('./sign-up-form');

const CUSTOMER = "I'm planning an event";
const VENDOR = "I'm a vendor";

/** The proof headline is the one `<p>` that opens with the panel's first line. */
function headlineStartingWith(container: HTMLElement, start: string): HTMLParagraphElement {
  const found = [...container.querySelectorAll('p')].find((p) => p.textContent?.startsWith(start));

  if (!found) {
    throw new Error(`no headline starting with "${start}"`);
  }

  return found;
}

describe('SignUpForm', () => {
  afterEach(() => {
    cleanup();
    signUpProps.mockClear();
    attempt = null;
    clerkCardLocked = false;
  });

  /*
   * Typing first and choosing second is a normal order, so the fields stay
   * live with no role chosen — only the submit is gated.
   * See design/design-plan/21-sign-up.md.
   */
  it('shows the form with no role chosen, and marks the submit pending', () => {
    const { container } = render(<SignUpForm initialRole={null} />);

    expect(screen.getByTestId('clerk-sign-up')).toBeDefined();
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
    // No role means no role claim travels to Clerk.
    expect(signUpProps).toHaveBeenLastCalledWith(expect.objectContaining({ unsafeMetadata: {} }));
  });

  /*
   * The API narrows a missing role to `customer`, so a sign-up that got through
   * without one would put a vendor on the wrong side of the product with no way
   * back — the exact thing the subhead says can't be changed later.
   */
  it('blocks submission until a role is chosen, then stops blocking', async () => {
    const user = userEvent.setup();
    const { container } = render(<SignUpForm initialRole={null} />);

    const gate = container.querySelector('[data-role-pending]');
    const submitted = vi.fn();
    gate?.addEventListener('submit', submitted);

    const form = document.createElement('form');
    gate?.appendChild(form);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(submitted).not.toHaveBeenCalled();

    await user.click(screen.getByRole('radio', { name: new RegExp(VENDOR) }));
    expect(container.querySelector('[data-role-pending]')).toBeNull();

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it('drops the pending hint once a role is chosen', async () => {
    const user = userEvent.setup();
    render(<SignUpForm initialRole={null} />);

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
    render(<SignUpForm initialRole={null} />);

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
    expect(signUpProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ unsafeMetadata: { role: 'customer' } }),
    );
  });

  it('carries the vendor role into Clerk as unsafe metadata', async () => {
    const user = userEvent.setup();
    render(<SignUpForm initialRole={null} />);

    await user.click(screen.getByRole('radio', { name: new RegExp(VENDOR) }));

    expect(screen.getByTestId('clerk-sign-up')).toBeDefined();
    expect(signUpProps).toHaveBeenCalledWith(
      expect.objectContaining({ unsafeMetadata: { role: 'vendor' } }),
    );
  });

  it('carries the customer role into Clerk as unsafe metadata', async () => {
    const user = userEvent.setup();
    render(<SignUpForm initialRole={null} />);

    await user.click(screen.getByRole('radio', { name: new RegExp(CUSTOMER) }));

    expect(signUpProps).toHaveBeenCalledWith(
      expect.objectContaining({ unsafeMetadata: { role: 'customer' } }),
    );
  });

  it('sends the new account to the role-resolving dashboard route', async () => {
    const user = userEvent.setup();
    render(<SignUpForm initialRole={null} />);

    await user.click(screen.getByRole('radio', { name: new RegExp(CUSTOMER) }));

    expect(signUpProps).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackRedirectUrl: '/after-sign-in' }),
    );
  });

  it('groups the two roles under one labelled choice', () => {
    render(<SignUpForm initialRole={null} />);

    expect(screen.getByRole('group', { name: 'Which one are you?' })).toBeDefined();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  /*
   * `?role=vendor` is a pre-selection, not a decision made for the visitor: the
   * vendor card starts checked and the Clerk form is already up, but the
   * customer card is still one click away.
   */
  it('pre-selects the role it was given and shows the Clerk form straight away', () => {
    render(<SignUpForm initialRole="vendor" />);

    expect(screen.getByRole('radio', { name: new RegExp(VENDOR) })).toHaveProperty('checked', true);
    expect(screen.getByRole('radio', { name: new RegExp(CUSTOMER) })).toHaveProperty(
      'checked',
      false,
    );
    expect(screen.getByTestId('clerk-sign-up')).toBeDefined();
    expect(signUpProps).toHaveBeenCalledWith(
      expect.objectContaining({ unsafeMetadata: { role: 'vendor' } }),
    );
  });

  /*
   * The default panel sells a two-sided marketplace to someone who has not said
   * which side they are on, so each line names its audience. Generic copy for
   * everyone says nothing to either.
   */
  it('labels each line of the default panel with the side it belongs to', () => {
    render(<SignUpForm initialRole={null} />);

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
    render(<SignUpForm initialRole={null} />);

    await user.click(screen.getByRole('radio', { name: new RegExp(CUSTOMER) }));

    expect(screen.getByText('Live calendars — if a date shows open, it is')).toBeDefined();
    expect(screen.getByText('Payment held until the event is complete')).toBeDefined();
    expect(screen.getByText('Published prices, and no service fee on top')).toBeDefined();

    // Nothing on this screen may claim a scale the product does not have.
    expect(document.body.textContent).not.toMatch(/\d[\d,]*\s*(vendors|events|reviews|bookings)/i);
    expect(document.body.textContent).not.toMatch(/thousands|#1|trusted by/i);
  });

  it('leads the default panel with its own three-line headline', () => {
    const { container } = render(<SignUpForm initialRole={null} />);

    const headline = headlineStartingWith(container, 'Clear prices.');

    expect(headline.textContent).toBe('Clear prices.Open calendars.No back-and-forth.');
    const accent = headline.querySelector('span');
    expect(accent?.textContent).toBe('No back-and-forth.');
    expect(accent?.className).toContain('italic');
    expect(accent?.className).toContain('text-gold-150');
  });

  it('leads the customer panel with the three-line headline, closing in italic', async () => {
    const user = userEvent.setup();
    const { container } = render(<SignUpForm initialRole={null} />);

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
    render(<SignUpForm initialRole={null} />);

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
    const { container } = render(<SignUpForm initialRole={null} />);

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
    render(<SignUpForm initialRole={null} />);

    await user.click(screen.getByRole('radio', { name: new RegExp(VENDOR) }));

    expect(document.body.textContent).not.toMatch(/fee|commission|subscription|% of/i);
    // It never claims volume either — that is a platform-scale promise.
    expect(document.body.textContent).not.toMatch(/more bookings|thousands|reach \w+ couples/i);
  });

  it('accents the selected card to match the panel beside it', async () => {
    const user = userEvent.setup();
    render(<SignUpForm initialRole={null} />);

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
   * D16, `21-sign-up.md`: the role survives email verification and the picker
   * is never shown twice.
   *
   * Clerk's verification step is a path navigation that remounts this
   * component, so `role` — seeded from `?role=` — comes back `null`. The choice
   * is not lost: it went to Clerk as `unsafeMetadata` before verification. It is
   * read back from the in-flight attempt rather than asked again.
   *
   * **Re-asking is not a confirmation step.** The subhead promises the choice
   * cannot be changed later, so asking again contradicts the screen's own copy.
   */
  describe('after email verification remounts the page', () => {
    const verifying = (role: string) => ({
      status: 'missing_requirements',
      unsafeMetadata: { role },
    });

    it('reads the role back from the in-flight attempt instead of asking again', () => {
      attempt = verifying('vendor');

      const { container } = render(<SignUpForm initialRole={null} />);

      expect(screen.queryByRole('radio', { name: new RegExp(CUSTOMER) })).toBeNull();
      expect(screen.queryByRole('radio', { name: new RegExp(VENDOR) })).toBeNull();
      expect(container.querySelector('fieldset')).toBeNull();
    });

    it('keeps the panel on the side the visitor already chose', () => {
      attempt = verifying('vendor');

      const { container } = render(<SignUpForm initialRole={null} />);

      // The vendor panel's proof headline, per `21-sign-up.md`'s three states.
      expect(headlineStartingWith(container, 'Set your prices.')).toBeDefined();
    });

    it('lifts the submit gate, because the role is known', () => {
      attempt = verifying('customer');

      const { container } = render(<SignUpForm initialRole={null} />);

      expect(container.querySelector('[data-role-pending]')).toBeNull();
      expect(screen.queryByText('Pick one above to continue')).toBeNull();
    });

    /*
     * A started attempt that carries no role is not a verification remount —
     * it is someone who got further than they should have. The picker has to
     * come back, or they finish with no role at all and the API narrows them
     * to `customer`.
     */
    it('still asks when the attempt carries no role', () => {
      attempt = { status: 'missing_requirements', unsafeMetadata: {} };

      render(<SignUpForm initialRole={null} />);

      expect(screen.queryByRole('radio', { name: new RegExp(CUSTOMER) })).not.toBeNull();
    });

    it('ignores a role the product does not have', () => {
      attempt = verifying('admin');

      render(<SignUpForm initialRole={null} />);

      expect(screen.queryByRole('radio', { name: new RegExp(CUSTOMER) })).not.toBeNull();
    });
  });

  /*
   * #464. The bot challenge can hang for ever, and while it does Clerk's card
   * disables every control and says nothing. These cover the bounded wait and
   * the recovery; the network condition that causes it is reproduced for real
   * in `e2e/sign-up-challenge.spec.ts`, because a mock that rejects has already
   * done the thing the product fails to do.
   *
   * `fireEvent` rather than `userEvent` throughout, because the wait is a timer
   * and these tests own the clock. `userEvent` schedules its own work on the
   * timers it is asked to advance, and pairing the two deadlocked all five of
   * these at 60s apiece before they asserted anything.
   */
  describe('when the bot challenge never answers', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    function submitButton(): HTMLButtonElement {
      return screen.getByRole('button', { name: 'Create my account' }) as HTMLButtonElement;
    }

    function emailField(): HTMLInputElement {
      return screen.getByLabelText('Email') as HTMLInputElement;
    }

    /** Press submit, then leave the card locked exactly as clerk-js leaves it. */
    function pressSubmitAndHang(): { rerender: (ui: React.ReactElement) => void } {
      vi.useFakeTimers();
      const { rerender } = render(<SignUpForm initialRole="customer" />);

      fireEvent.change(emailField(), { target: { value: 'someone@example.com' } });
      fireEvent.submit(submitButton().closest('form') as HTMLFormElement);

      clerkCardLocked = true;
      rerender(<SignUpForm initialRole="customer" />);

      return { rerender };
    }

    function waitOut(ms: number): void {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    }

    it('says nothing until the wait is actually up', () => {
      pressSubmitAndHang();

      waitOut(SIGN_UP_CHALLENGE_TIMEOUT_MS - 1);

      expect(screen.queryByText(CHALLENGE_STALL_TITLE)).toBeNull();
    });

    it('states the failure and what to do about it once the wait is up', () => {
      pressSubmitAndHang();

      waitOut(SIGN_UP_CHALLENGE_TIMEOUT_MS);

      expect(screen.getByText(CHALLENGE_STALL_TITLE)).toBeDefined();
      expect(screen.getByText(CHALLENGE_STALL_BODY)).toBeDefined();
      /* `40-states.md`: it failed, so it is red. `Banner` derives the colour
         from the meaning, so asserting the meaning is asserting the colour. */
      expect(screen.getByRole('status').getAttribute('data-status')).toBe('failed');
    });

    /*
     * Acceptance 2. The retry is a control, not a reload — and it has to give
     * back a card that works, which means remounting Clerk's rather than
     * re-rendering the disabled one.
     */
    it('gives back a working form when the retry is pressed', () => {
      pressSubmitAndHang();

      waitOut(SIGN_UP_CHALLENGE_TIMEOUT_MS);

      clerkCardLocked = false;
      fireEvent.click(screen.getByRole('button', { name: CHALLENGE_STALL_RETRY }));

      expect(screen.queryByText(CHALLENGE_STALL_TITLE)).toBeNull();
      expect(submitButton().disabled).toBe(false);
      expect(emailField().disabled).toBe(false);
      // A remount, not a re-render: the field the person typed into is gone.
      expect(emailField().value).toBe('');
    });

    /*
     * The banner is a live reading, not a verdict. Clerk can report something
     * of its own after the bound has passed — a taken email address renders in
     * the same card with no navigation, so this component never remounts — and
     * two errors about one press is exactly what the refused-host case exists
     * to prevent. Latching the first true would walk around that.
     */
    it('takes the banner back when Clerk gives the card back', () => {
      const { rerender } = pressSubmitAndHang();

      waitOut(SIGN_UP_CHALLENGE_TIMEOUT_MS);
      expect(screen.getByText(CHALLENGE_STALL_TITLE)).toBeDefined();

      clerkCardLocked = false;
      rerender(<SignUpForm initialRole="customer" />);
      waitOut(SIGN_UP_CHALLENGE_RECHECK_MS);

      expect(screen.queryByText(CHALLENGE_STALL_TITLE)).toBeNull();
    });

    /* And when the create lands late, which is the other way the screen moves
       on underneath a banner that was true when it was drawn. */
    it('takes the banner back when the attempt lands late', () => {
      const { rerender } = pressSubmitAndHang();

      waitOut(SIGN_UP_CHALLENGE_TIMEOUT_MS);
      expect(screen.getByText(CHALLENGE_STALL_TITLE)).toBeDefined();

      attempt = { id: 'sua_464_late', status: 'missing_requirements', unsafeMetadata: {} };
      rerender(<SignUpForm initialRole="customer" />);
      waitOut(SIGN_UP_CHALLENGE_RECHECK_MS);

      expect(screen.queryByText(CHALLENGE_STALL_TITLE)).toBeNull();
    });

    /*
     * When the challenge host refuses rather than drops, Clerk gives up on its
     * own, attempts the create and reports the failure in the card with the
     * fields still live. A second error on top of that is the product talking
     * over itself.
     */
    it('stays quiet when the form is still usable', () => {
      vi.useFakeTimers();
      render(<SignUpForm initialRole="customer" />);

      fireEvent.submit(submitButton().closest('form') as HTMLFormElement);

      waitOut(SIGN_UP_CHALLENGE_TIMEOUT_MS * 2);

      expect(screen.queryByText(CHALLENGE_STALL_TITLE)).toBeNull();
    });

    /*
     * Past the create, submit belongs to the verification step. That fails for
     * its own reasons, and none of them is a challenge that never came.
     */
    it('does not watch the verification step', () => {
      attempt = { id: 'sua_464', status: 'missing_requirements', unsafeMetadata: {} };

      vi.useFakeTimers();
      const { rerender } = render(<SignUpForm initialRole="customer" />);

      fireEvent.submit(submitButton().closest('form') as HTMLFormElement);

      clerkCardLocked = true;
      rerender(<SignUpForm initialRole="customer" />);

      waitOut(SIGN_UP_CHALLENGE_TIMEOUT_MS * 2);

      expect(screen.queryByText(CHALLENGE_STALL_TITLE)).toBeNull();
    });
  });
});
