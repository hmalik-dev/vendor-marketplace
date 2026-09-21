import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CURRENT_TERMS_VERSION,
  legalDocumentSha256,
  type TermsAcceptanceStatus,
} from '@vendor-marketplace/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api-client';
import {
  readSignUpRole,
  rememberSignUpRole,
  SIGN_UP_ROLE_KEY,
  SIGN_UP_ROLE_TTL_MS,
} from '@/lib/auth/signup-role';
import { legalDocument } from '@/lib/legal-content';
import { AcceptTermsScreen } from './accept-terms-screen';

const post = vi.fn();
const replace = vi.fn();
const signOut = vi.fn<() => Promise<void>>();
const assign = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => post }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/auth/auth-requests', () => ({ signOut: () => signOut() }));

const TERMS = legalDocument('terms');

function status(overrides: Partial<TermsAcceptanceStatus> = {}): TermsAcceptanceStatus {
  return {
    current: CURRENT_TERMS_VERSION,
    documentSha256: legalDocumentSha256('terms_of_service'),
    accepted: false,
    acceptedAt: null,
    account: { exists: false, role: null },
    suggestedRole: null,
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
  signOut.mockReset();
  signOut.mockResolvedValue(undefined);
  assign.mockReset();
  vi.stubGlobal('location', { ...window.location, assign });
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function radio(name: RegExp): HTMLInputElement {
  return screen.getByRole('radio', { name }) as HTMLInputElement;
}

const CUSTOMER_RADIO = /planning an event/;
const VENDOR_RADIO = /I'm a vendor/;

function bodyOfPost(): Record<string, unknown> {
  return (post.mock.calls[0]?.[1] as { body: Record<string, unknown> }).body;
}

function stored(role: 'customer' | 'vendor' | 'admin'): TermsAcceptanceStatus {
  return status({ account: { exists: true, role } });
}

describe('the role confirmed on this screen (VEN-507)', () => {
  it('preselects nothing without a hint and keeps the submit disabled after the tick', async () => {
    const user = userEvent.setup();
    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    expect(radio(CUSTOMER_RADIO).checked).toBe(false);
    expect(radio(VENDOR_RADIO).checked).toBe(false);

    await user.click(box());
    expect(submit().disabled).toBe(true);
    await user.click(submit());
    expect(post).not.toHaveBeenCalled();
  });

  it('asks the same way when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const user = userEvent.setup();
    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    await user.click(box());

    expect(radio(CUSTOMER_RADIO).checked).toBe(false);
    expect(radio(VENDOR_RADIO).checked).toBe(false);
    expect(submit().disabled).toBe(true);
    vi.restoreAllMocks();
  });

  it('preselects a hint under a day old, and still needs the submit', async () => {
    const user = userEvent.setup();
    rememberSignUpRole('vendor');
    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    expect(radio(VENDOR_RADIO).checked).toBe(true);
    expect(post).not.toHaveBeenCalled();

    await user.click(box());
    await user.click(submit());

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(bodyOfPost()).toEqual({
      version: CURRENT_TERMS_VERSION,
      accepted: true,
      role: 'vendor',
    });
    expect(readSignUpRole()).toBeNull();
  });

  it('ignores a hint older than a day', () => {
    window.localStorage.setItem(
      SIGN_UP_ROLE_KEY,
      JSON.stringify({ role: 'vendor', at: Date.now() - SIGN_UP_ROLE_TTL_MS - 1 }),
    );
    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    expect(radio(VENDOR_RADIO).checked).toBe(false);
    expect(radio(CUSTOMER_RADIO).checked).toBe(false);
  });

  it('ignores a stored value that is not one of the two roles', () => {
    window.localStorage.setItem(
      SIGN_UP_ROLE_KEY,
      JSON.stringify({ role: 'admin', at: Date.now() }),
    );
    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    expect(radio(VENDOR_RADIO).checked).toBe(false);
    expect(radio(CUSTOMER_RADIO).checked).toBe(false);
  });

  it('prefers the browser hint to the invite, and the invite to nothing', () => {
    rememberSignUpRole('customer');
    const invited = status({ suggestedRole: 'vendor' });
    const { unmount } = render(
      <AcceptTermsScreen status={invited} terms={TERMS} returnTo={null} />,
    );
    expect(radio(CUSTOMER_RADIO).checked).toBe(true);
    unmount();

    window.localStorage.clear();
    render(<AcceptTermsScreen status={invited} terms={TERMS} returnTo={null} />);
    expect(radio(VENDOR_RADIO).checked).toBe(true);
  });

  it('sends the role picked on the screen and keeps it across a reload', async () => {
    const user = userEvent.setup();
    const first = render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    await user.click(radio(VENDOR_RADIO));
    first.unmount();

    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);
    expect(radio(VENDOR_RADIO).checked).toBe(true);

    await user.click(box());
    await user.click(submit());

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(bodyOfPost().role).toBe('vendor');
  });

  it('leaves the hint in place when the save fails, and a retry succeeds', async () => {
    const user = userEvent.setup();
    post.mockRejectedValueOnce(new ApiClientError(500, 'INTERNAL_ERROR', 'boom'));
    rememberSignUpRole('vendor');
    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    await user.click(box());
    await user.click(submit());
    await waitFor(() => expect(screen.getByText(/Nothing has been recorded/)).toBeDefined());

    expect(readSignUpRole()).toBe('vendor');
    expect(radio(VENDOR_RADIO).checked).toBe(true);

    await user.click(submit());

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(replace).toHaveBeenCalledWith('/after-sign-in');
    expect(readSignUpRole()).toBeNull();
  });

  it('shows an existing account read-only, offers no choice and sends no role', async () => {
    const user = userEvent.setup();
    rememberSignUpRole('vendor');
    render(<AcceptTermsScreen status={stored('customer')} terms={TERMS} returnTo={null} />);

    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByTestId('stored-role').textContent).toContain('joining as a customer');

    await user.click(box());
    await user.click(submit());

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(bodyOfPost()).toEqual({ version: CURRENT_TERMS_VERSION, accepted: true });
  });

  it('shows the stored role before continuing when another tab stored a different one', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue(
      status({
        accepted: true,
        acceptedAt: new Date(),
        account: { exists: true, role: 'customer' },
      }),
    );
    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    await user.click(radio(VENDOR_RADIO));
    await user.click(box());
    await user.click(submit());

    await waitFor(() => expect(screen.getByText('This account is a customer')).toBeDefined());
    expect(replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(replace).toHaveBeenCalledWith('/after-sign-in');
  });

  it('continues straight away when the stored role is the one chosen', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue(
      status({
        accepted: true,
        acceptedAt: new Date(),
        account: { exists: true, role: 'vendor' },
      }),
    );
    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    await user.click(radio(VENDOR_RADIO));
    await user.click(box());
    await user.click(submit());

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/after-sign-in'));
  });

  it('stays put on a refused vendor, keeps the hint and the session, and offers customer or apply (VEN-406)', async () => {
    const user = userEvent.setup();
    post.mockRejectedValueOnce(
      new ApiClientError(403, 'vendor_not_invited', 'Vendor accounts are by invitation for now.'),
    );
    rememberSignUpRole('vendor');
    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    await user.click(box());
    await user.click(submit());

    await waitFor(() =>
      expect(screen.getByText('Vendor accounts are by invitation for now')).toBeDefined(),
    );
    expect(replace).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(readSignUpRole()).toBe('vendor');
    expect(
      screen.getByRole('link', { name: 'apply to become a vendor' }).getAttribute('href'),
    ).toBe('/vendors/apply');

    await user.click(radio(CUSTOMER_RADIO));
    await user.click(submit());

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect((post.mock.calls[1]?.[1] as { body: Record<string, unknown> }).body.role).toBe(
      'customer',
    );
  });
});

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

    await user.click(radio(CUSTOMER_RADIO));
    await user.click(box());
    await user.click(submit());

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));

    expect(post.mock.calls[0]?.[0]).toBe('/legal/terms/accept');
    expect(post.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: { version: CURRENT_TERMS_VERSION, accepted: true, role: 'customer' },
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

    await user.click(radio(CUSTOMER_RADIO));
    await user.click(box());
    await user.click(submit());

    await waitFor(() =>
      expect(screen.getByText(/The Terms were updated while this page was open/)).toBeDefined(),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  /** A ban landing while the page is open: a retry re-posts into the same 403. */
  it('sends a suspended account to /suspended instead of offering a retry', async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(new ApiClientError(403, 'FORBIDDEN', 'This account has been suspended'));
    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    await user.click(radio(CUSTOMER_RADIO));
    await user.click(box());
    await user.click(submit());

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/suspended'));
    expect(screen.queryByText(/try again/)).toBeNull();
  });

  /** A retired row with a live session: nothing this page posts can succeed. */
  it('ends a session the API no longer honours and returns to sign-in', async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(new ApiClientError(401, 'UNAUTHORIZED', 'Sign in again'));
    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    await user.click(radio(CUSTOMER_RADIO));
    await user.click(box());
    await user.click(submit());

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/sign-in'));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/try again/)).toBeNull();
  });

  it('still offers a retry for a server failure', async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(new ApiClientError(500, 'INTERNAL_ERROR', 'boom'));
    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    await user.click(radio(CUSTOMER_RADIO));
    await user.click(box());
    await user.click(submit());

    await waitFor(() =>
      expect(screen.getByText('Nothing has been recorded — try again.')).toBeDefined(),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  /** The card promises "you don't lose your place", so an in-text link must not navigate this tab. */
  it('opens the Privacy Policy link inside the Terms card in a new tab', () => {
    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    const links = screen.getAllByRole('link', { name: 'Privacy Policy' });

    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toBe('/privacy');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });
});
