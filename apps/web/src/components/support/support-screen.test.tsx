import {
  MAX_SUPPORT_MESSAGE_LENGTH,
  SUPPORT_TOPICS,
  SUPPORT_TOPIC_LABELS,
} from '@vendor-marketplace/shared';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api-client';

const request = vi.fn();
vi.mock('@/lib/use-api', () => ({ useApi: () => request }));

const { SupportScreen } = await import('./support-screen');

const ERROR_CONTEXT = {
  digest: 'err_9f4c2a71b3',
  route: '/bookings/abc/checkout',
  occurredAt: '2026-06-12T14:41:00.000Z',
} as const;

const MESSAGE = 'The checkout page broke twice, right after I hit Confirm and pay.';

/** Fills the form for a signed-out visitor and presses the button. */
async function sendAsVisitor(): Promise<void> {
  const user = userEvent.setup();

  await user.click(screen.getByRole('button', { name: 'Topic' }));
  await user.click(await screen.findByRole('option', { name: 'Something else' }));
  await user.type(screen.getByLabelText('Your email'), 'visitor@example.com');
  await user.type(screen.getByLabelText('Message'), MESSAGE);
  await user.click(screen.getByRole('button', { name: 'Send message' }));
}

describe('SupportScreen', () => {
  beforeEach(() => {
    request.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  // --- State 1: signed out --------------------------------------------------

  it('asks a signed-out visitor for an address, and says why it is asking', () => {
    render(<SupportScreen accountEmail={null} errorContext={null} />);

    expect(screen.getByLabelText('Your email')).toBeDefined();
    expect(screen.getByText('The only address we’ll use, and only to answer this.')).toBeDefined();
    expect(screen.queryByText(/the email on your account/)).toBeNull();
  });

  // --- State 2: signed in ---------------------------------------------------

  it('names the account it will reply to, and offers no email field', () => {
    render(<SupportScreen accountEmail="ana@nandakumar.co" errorContext={null} />);

    // A statement, not an input: changing where replies go means changing the
    // account, so there is nothing here to type into and no typo to make.
    expect(screen.queryByLabelText('Your email')).toBeNull();
    expect(screen.getByText(/the email on your account/).textContent).toContain(
      'ana@nandakumar.co',
    );
  });

  // --- State 3: prefilled from an error -------------------------------------

  it('attaches the reference as context rather than as a field, and preselects the topic', () => {
    render(<SupportScreen accountEmail="ana@nandakumar.co" errorContext={ERROR_CONTEXT} />);

    expect(screen.getByText('Attached automatically')).toBeDefined();

    const digest = screen.getByText(ERROR_CONTEXT.digest);
    // No input chrome and no clear affordance — nothing to accidentally empty.
    expect(digest.tagName).toBe('SPAN');
    expect(screen.queryByDisplayValue(ERROR_CONTEXT.digest)).toBeNull();

    expect(screen.getByText(/Jun 12, 2:41 PM/).textContent).toContain(ERROR_CONTEXT.route);

    // `Something broke` is preselected only when a reference is attached.
    expect(screen.getByRole('button', { name: 'Topic' }).textContent).toBe('Something broke');
  });

  it('leaves the topic unchosen when no reference is attached', () => {
    render(<SupportScreen accountEmail={null} errorContext={null} />);

    expect(screen.getByRole('button', { name: 'Topic' }).textContent).toBe('Choose a topic');
  });

  it('offers the five topics, and only those five', async () => {
    const user = userEvent.setup();
    render(<SupportScreen accountEmail={null} errorContext={null} />);

    await user.click(screen.getByRole('button', { name: 'Topic' }));

    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(
      SUPPORT_TOPICS.map((topic) => SUPPORT_TOPIC_LABELS[topic]),
    );
  });

  /*
   * `web-route-boundaries.md`: every input whose value reaches a length-capped
   * API field carries the matching `maxLength`, so the refusal is unreachable
   * by typing rather than reported after a round trip.
   */
  it("caps the message at the API's own limit", () => {
    render(<SupportScreen accountEmail={null} errorContext={null} />);

    expect(screen.getByLabelText('Message').getAttribute('maxlength')).toBe(
      String(MAX_SUPPORT_MESSAGE_LENGTH),
    );
  });

  it('holds the button shut until there is something to send', async () => {
    const user = userEvent.setup();
    render(<SupportScreen accountEmail={null} errorContext={null} />);

    const button = screen.getByRole('button', { name: 'Send message' });
    expect(button.hasAttribute('disabled')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Topic' }));
    await user.click(await screen.findByRole('option', { name: 'Something else' }));
    await user.type(screen.getByLabelText('Message'), MESSAGE);

    // Still shut: a signed-out visitor has no address for the answer to go to.
    expect(button.hasAttribute('disabled')).toBe(true);

    await user.type(screen.getByLabelText('Your email'), 'visitor@example.com');
    expect(button.hasAttribute('disabled')).toBe(false);
  });

  it('sends the topic, message and attached context the screen is holding', async () => {
    request.mockResolvedValue({ reference: 'ORL-4K7Q-P2' });
    render(<SupportScreen accountEmail="ana@nandakumar.co" errorContext={ERROR_CONTEXT} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Message'), MESSAGE);
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request.mock.calls[0]?.[0]).toBe('/support/messages');
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: {
        topic: 'something-broke',
        message: MESSAGE,
        errorContext: ERROR_CONTEXT,
      },
    });
    // Identity comes from the session; the screen never sends an address for
    // an account that has one.
    expect(request.mock.calls[0]?.[1].body.email).toBeUndefined();
  });

  // --- State 4: submitting --------------------------------------------------

  it('uses one loading idiom: the button works, the fields lock, nothing else moves', async () => {
    // Never settles, so the screen stays in state 4 for the assertions below.
    request.mockImplementation(() => new Promise(() => undefined));
    render(<SupportScreen accountEmail={null} errorContext={null} />);

    await sendAsVisitor();

    const button = await screen.findByRole('button', { name: /Sending/ });
    // Busy is announced rather than merely greyed out.
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toContain('Sending…');
    expect(screen.getByText('Fields locked')).toBeDefined();

    // Read-only, not disabled: the message they just wrote stays readable and
    // selectable, which a disabled field's own fade would work against.
    expect(screen.getByLabelText('Message').hasAttribute('readonly')).toBe(true);
    expect(screen.getByLabelText('Your email').hasAttribute('readonly')).toBe(true);

    // No skeleton — the content is already on screen — and no overlay, which
    // would hide it.
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0);
  });

  // --- State 5: sent --------------------------------------------------------

  it('hands back the message id, and says there is nothing to check back on', async () => {
    request.mockResolvedValue({ reference: 'ORL-4K7Q-P2' });
    render(<SupportScreen accountEmail={null} errorContext={ERROR_CONTEXT} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Your email'), 'visitor@example.com');
    await user.type(screen.getByLabelText('Message'), MESSAGE);
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('Message sent')).toBeDefined();
    expect(screen.getByText('Your reference')).toBeDefined();

    /*
     * The reference is the **message id**, not the error digest. A send from
     * the footer carries no digest, so the digest cannot be what this state
     * returns — and this screen had one to confuse it with.
     */
    expect(screen.getByText('ORL-4K7Q-P2')).toBeDefined();
    expect(screen.queryByText(ERROR_CONTEXT.digest)).toBeNull();

    expect(
      screen.getByText('Quote this if you follow up. It’s in the confirmation email too.'),
    ).toBeDefined();
    expect(
      screen.getByText('There’s nothing to check back on here — the answer comes to your inbox.'),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Back to browsing' })).toBeDefined();
  });

  it('copies the reference, and says so when the browser will not', async () => {
    request.mockResolvedValue({ reference: 'ORL-4K7Q-P2' });

    render(<SupportScreen accountEmail="ana@nandakumar.co" errorContext={null} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Topic' }));
    await user.click(await screen.findByRole('option', { name: 'Something else' }));
    await user.type(screen.getByLabelText('Message'), MESSAGE);
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByText('Message sent');

    /*
     * Installed **after** `userEvent.setup()`, which replaces
     * `navigator.clipboard` with a stub of its own — defining it first and
     * asserting afterwards would assert on a `writeText` nothing ever called,
     * which is exactly how this test passed while proving nothing.
     *
     * Defined on the instance rather than spread over: `navigator.clipboard`
     * is a prototype accessor, and a spread copies none of those.
     */
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(writeText).toHaveBeenCalledWith('ORL-4K7Q-P2');
    /*
     * A Copy that looks like it worked and did not is worse than no Copy at
     * all — the visitor walks away believing they have the reference.
     */
    expect(await screen.findByText(/Your browser wouldn’t let us copy it/)).toBeDefined();

    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('reports a successful copy', async () => {
    request.mockResolvedValue({ reference: 'ORL-4K7Q-P2' });

    render(<SupportScreen accountEmail="ana@nandakumar.co" errorContext={null} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Topic' }));
    await user.click(await screen.findByRole('option', { name: 'Something else' }));
    await user.type(screen.getByLabelText('Message'), MESSAGE);
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByText('Message sent');

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(writeText).toHaveBeenCalledWith('ORL-4K7Q-P2');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeDefined();
    expect(screen.queryByText(/Your browser wouldn’t let us copy it/)).toBeNull();

    Reflect.deleteProperty(navigator, 'clipboard');
  });

  // --- State 6: failed to send ----------------------------------------------

  it('names transport as the cause, keeps the message, and offers one action', async () => {
    request.mockRejectedValue(
      new ApiClientError(502, 'INTERNAL_ERROR', 'The mail service rejected the message', {
        reference: 'ORL-4K7Q-P2',
      }),
    );
    render(<SupportScreen accountEmail={null} errorContext={null} />);

    await sendAsVisitor();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(
      'Your message didn’t go through — our mail service rejected it',
    );
    // Transport, not their input — so nobody rewords a message that was fine.
    expect(alert.textContent).toContain('it isn’t something you can fix by editing it');

    /*
     * The reference is issued **before** the send resolves, which is what lets
     * a failed message still be something the visitor can ask about.
     */
    expect(alert.textContent).toContain('ORL-4K7Q-P2');

    // Nothing they typed is lost.
    expect(screen.getByLabelText('Message')).toHaveProperty('value', MESSAGE);

    /*
     * Exactly one action. There is no fallback address yet (#374), so a second
     * button would imply a choice that does not exist.
     */
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Send message' })).toBeNull();
    expect(screen.queryByRole('link', { name: /support@/ })).toBeNull();
  });

  it('still reaches the failed state when the failure carried no reference', async () => {
    // A network failure never reached the API, so no reference was ever
    // issued. The cause is still transport and the action is still retry.
    request.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<SupportScreen accountEmail={null} errorContext={null} />);

    await sendAsVisitor();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Your message didn’t go through');
    expect(alert.textContent).not.toContain('We’ve logged the failure as');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  });

  it('sends again on Try again, and reaches the sent state', async () => {
    request
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ reference: 'ORL-8M2X-QD' });
    render(<SupportScreen accountEmail={null} errorContext={null} />);

    await sendAsVisitor();
    await screen.findByRole('button', { name: 'Try again' });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Message sent')).toBeDefined();
    expect(screen.getByText('ORL-8M2X-QD')).toBeDefined();
    expect(request).toHaveBeenCalledTimes(2);
  });

  /*
   * The split state 6 exists to preserve. State 6 names the cause as
   * **transport** and says editing cannot fix it — so routing a refusal about
   * the request there tells someone whose address is missing its `.com` that
   * the mail service is at fault, and hands them a retry that re-sends the
   * identical body and fails identically, forever.
   */
  describe('a refusal about the request is not the transport failing', () => {
    it.each([
      [400, 'Request validation failed', 'Check the details above, then send again.'],
      [
        400,
        'Enter the email address we should reply to',
        'Enter the email address we should reply to',
      ],
      [
        429,
        'Too many requests. Please try again shortly.',
        'Too many requests. Please try again shortly.',
      ],
      [401, 'Session token is invalid or expired', 'Session token is invalid or expired'],
    ])('shows a %s as a field refusal, not as state 6', async (status, apiMessage, shown) => {
      request.mockRejectedValue(new ApiClientError(status, 'VALIDATION_ERROR', apiMessage));
      render(<SupportScreen accountEmail={null} errorContext={null} />);

      await sendAsVisitor();

      expect((await screen.findByRole('alert')).textContent).toBe(shown);

      // The screen stays editable, and the button stays `Send message`: there
      // is something for them to change, which is the whole difference.
      expect(screen.getByRole('button', { name: 'Send message' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
      expect(screen.queryByText(/our mail service rejected it/)).toBeNull();
      expect(screen.getByLabelText('Message').hasAttribute('readonly')).toBe(false);
    });

    /*
     * The commonest typo there is, and it clears every "contains an @" check.
     * `40-states.md` prefers a blocker the reader cannot cross to a message
     * explaining that they did, so it never reaches the round trip at all.
     */
    it('will not send to an address the answer could never reach', async () => {
      const user = userEvent.setup();
      render(<SupportScreen accountEmail={null} errorContext={null} />);

      await user.click(screen.getByRole('button', { name: 'Topic' }));
      await user.click(await screen.findByRole('option', { name: 'Something else' }));
      await user.type(screen.getByLabelText('Message'), MESSAGE);
      await user.type(screen.getByLabelText('Your email'), 'ana@nandakumar');

      expect(screen.getByRole('button', { name: 'Send message' }).hasAttribute('disabled')).toBe(
        true,
      );

      await user.type(screen.getByLabelText('Your email'), '.co');

      expect(screen.getByRole('button', { name: 'Send message' }).hasAttribute('disabled')).toBe(
        false,
      );
      expect(request).not.toHaveBeenCalled();
    });
  });

  /*
   * `Button`'s own `disabled ?? loading` cannot fire here — `incomplete` is
   * always a boolean, never `undefined` — so the control has to be held shut
   * explicitly. Two sends would put two reports in the inbox, two receipts in
   * their mailbox, and two references on a screen that shows only the last.
   */
  it('refuses a second submit while the first is in flight', async () => {
    request.mockImplementation(() => new Promise(() => undefined));
    render(<SupportScreen accountEmail={null} errorContext={null} />);

    await sendAsVisitor();

    const button = await screen.findByRole('button', { name: /Sending/ });
    expect(button.hasAttribute('disabled')).toBe(true);

    // Driven as well as asserted: a disabled attribute the click still reaches
    // would pass the assertion above and send twice anyway.
    await userEvent.setup({ pointerEventsCheck: 0 }).click(button);
    expect(request).toHaveBeenCalledTimes(1);
  });

  // --- The scope line -------------------------------------------------------

  it('promises no thread, no status and no attachment', () => {
    render(<SupportScreen accountEmail="ana@nandakumar.co" errorContext={null} />);

    expect(screen.getByText(/doesn’t open a chat thread here/)).toBeDefined();
    expect(screen.getByText('One email, no ticket to track.')).toBeDefined();
    // Not a helpdesk: there is nothing here to attach a file with.
    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
  });
});
