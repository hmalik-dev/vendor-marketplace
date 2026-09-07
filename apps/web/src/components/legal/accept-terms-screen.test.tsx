import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CURRENT_TERMS_VERSION,
  legalDocumentSha256,
  type TermsAcceptanceStatus,
} from '@vendor-marketplace/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { legalDocument } from '@/lib/legal-content';
import { AcceptTermsScreen } from './accept-terms-screen';

const post = vi.fn();
const replace = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => post }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const TERMS = legalDocument('terms');

function status(overrides: Partial<TermsAcceptanceStatus> = {}): TermsAcceptanceStatus {
  return {
    current: CURRENT_TERMS_VERSION,
    documentSha256: legalDocumentSha256('terms_of_service'),
    accepted: false,
    acceptedAt: null,
    ...overrides,
  };
}

function box(): HTMLInputElement {
  return screen.getByRole('checkbox') as HTMLInputElement;
}

function submit(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Accept and continue' }) as HTMLButtonElement;
}

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue(status({ accepted: true, acceptedAt: new Date() }));
  replace.mockReset();
});

afterEach(cleanup);

describe('the acceptance gate', () => {
  /**
   * **The single most important assertion in this file.** A pre-ticked box is
   * not an affirmative act, and pre-ticking it is the most common way a
   * clickwrap record is thrown out — so the unticked initial state is the
   * property, not a detail of the render.
   */
  it('starts with the box unticked and the submit disabled', () => {
    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    expect(box().checked).toBe(false);
    expect(submit().disabled).toBe(true);
  });

  /** The document is named and linked beside the box, not merely alluded to. */
  it('names and links the document beside the box', () => {
    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    const link = screen.getByRole('link', { name: 'Terms of Service' });

    expect(link.getAttribute('href')).toBe('/terms');
    expect(link.getAttribute('target')).toBe('_blank');
    // And the document itself is on the page, not only linked from it.
    expect(screen.getByRole('heading', { name: TERMS.title }).textContent).toBe(TERMS.title);
  });

  /**
   * Reading the document must not cost the reader anything: the expander opens
   * in place, and a tick already made survives it. A control that navigated or
   * opened a modal would reset the form, which is how a gate becomes an
   * obstacle rather than a record.
   */
  it('expands the document in place without resetting the tick', async () => {
    const user = userEvent.setup();
    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    await user.click(box());
    await user.click(screen.getByRole('button', { name: /Read all \d+ sections/ }));

    expect(screen.getByRole('button', { name: 'Collapse the Terms' })).toBeDefined();
    expect(box().checked).toBe(true);
  });

  it('sends the tick and the version, and forwards through /after-sign-in', async () => {
    const user = userEvent.setup();
    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo="/bookings/abc" />);

    await user.click(box());
    await user.click(submit());

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));

    expect(post.mock.calls[0]?.[0]).toBe('/legal/terms/accept');
    expect(post.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: { version: CURRENT_TERMS_VERSION, accepted: true },
    });
    /*
     * Back through `/after-sign-in` rather than straight to the destination:
     * the account row exists only now, so this is the first moment its role can
     * be resolved, and that handler re-validates the destination.
     */
    expect(replace).toHaveBeenCalledWith('/after-sign-in?returnTo=%2Fbookings%2Fabc');
  });

  /**
   * The submit is inert until the box is ticked. The API refuses an untickled
   * submission too — that is where the rule lives — but a form that fired
   * anyway would be asking the server to record an act nobody made.
   */
  it('sends nothing while the box is unticked', async () => {
    const user = userEvent.setup();
    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    await user.click(submit());

    expect(post).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  /** A revision landing while the page was open must not be accepted silently. */
  it('says the Terms moved when the version is refused, and stays put', async () => {
    const { ApiClientError } = await import('@/lib/api-client');
    post.mockRejectedValue(new ApiClientError(409, 'CONFLICT', 'not current'));

    const user = userEvent.setup();
    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    await user.click(box());
    await user.click(submit());

    await waitFor(() =>
      expect(screen.getByText(/The Terms were updated while this page was open/)).toBeDefined(),
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
