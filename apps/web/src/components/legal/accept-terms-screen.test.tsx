import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import {
  BRAND_NAME,
  CURRENT_TERMS_VERSION,
  legalDocumentSha256,
  type TermsAcceptanceStatus,
} from '@vendor-marketplace/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api-client';
import { legalDocument } from '@/lib/legal-content';
import { AcceptTermsScreen } from './accept-terms-screen';

const post = vi.fn();
const replace = vi.fn();
/* A full-load replace reports into `replace` too, so every navigation assertion reads one mock. */
const hardReplace = vi.fn((url: string) => replace(url));
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
    explicitTickRequired: false,
    account: { exists: false, role: null },
    signUpRole: null,
    suggestedRole: null,
    vendorWaitlist: { exists: false, complete: false },
    ...overrides,
  };
}

/** An account that accepted an earlier version: the one screen with a tick. */
function tickStatus(): TermsAcceptanceStatus {
  return status({ explicitTickRequired: true, account: { exists: true, role: 'customer' } });
}

function box(): HTMLInputElement {
  return screen.getByRole('checkbox') as HTMLInputElement;
}

function submit(): HTMLButtonElement {
  return screen.getByRole('button', {
    name: /^(Accept and continue|Continue)$/,
  }) as HTMLButtonElement;
}

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue(status({ accepted: true, acceptedAt: new Date() }));
  replace.mockReset();
  hardReplace.mockClear();
  signOut.mockReset();
  signOut.mockResolvedValue(undefined);
  assign.mockReset();
  vi.stubGlobal('location', { ...window.location, assign, replace: hardReplace });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function bodyOfPost(): Record<string, unknown> {
  return (post.mock.calls[0]?.[1] as { body: Record<string, unknown> }).body;
}

function stored(role: 'customer' | 'vendor' | 'admin'): TermsAcceptanceStatus {
  return status({ account: { exists: true, role } });
}

/** A first sign-in whose role the server recorded at sign-up (VEN-662). */
function recorded(role: 'customer' | 'vendor'): TermsAcceptanceStatus {
  return status({ signUpRole: role });
}

/* The welcome screen names the account and accepts: no closing, no "can't change", no recording talk (VEN-700). */
const FORBIDDEN_COPY = /close|can't be changed|record the moment|register again/i;

describe('the role recorded at sign-up (VEN-507, VEN-662)', () => {
  it.each(['customer', 'vendor'] as const)(
    'states a recorded %s from the server render, with no picker and nothing read from storage',
    (role) => {
      const getItem = vi.spyOn(Storage.prototype, 'getItem');
      const html = renderToString(
        <AcceptTermsScreen status={recorded(role)} terms={TERMS} returnTo={null} />,
      );

      /* The sign-up form promised this can't be changed later; a picker here would contradict it. */
      expect(html).not.toContain('type="radio"');
      expect(html).not.toContain('<fieldset');
      expect(html).toContain('data-testid="stored-role"');
      const text = html.replaceAll('<!-- -->', '').replaceAll('&#x27;', "'");
      expect(text).toContain(`You're joining as a ${role}.`);
      expect(text).not.toMatch(FORBIDDEN_COPY);
      expect(getItem).not.toHaveBeenCalled();
    },
  );

  it('sends the version and no role, and continues', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue(
      status({ accepted: true, acceptedAt: new Date(), account: { exists: true, role: 'vendor' } }),
    );
    render(<AcceptTermsScreen status={recorded('vendor')} terms={TERMS} returnTo={null} />);

    expect(screen.getByTestId('stored-role').textContent).toBe("You're joining as a vendor.");
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(`Welcome to ${BRAND_NAME}`);
    expect(post).not.toHaveBeenCalled();

    await user.click(submit());

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/after-sign-in'));
    // A full load: the header was drawn before the row existed, and a client
    // navigation would keep it (VEN-678).
    expect(hardReplace).toHaveBeenCalledWith('/after-sign-in');
    expect(bodyOfPost()).toEqual({ version: CURRENT_TERMS_VERSION });
  });

  it('shows an existing account read-only, offers no choice and sends no role', async () => {
    const user = userEvent.setup();
    render(<AcceptTermsScreen status={stored('customer')} terms={TERMS} returnTo={null} />);

    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByTestId('stored-role').textContent).toContain('joining as a customer');

    await user.click(submit());

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(bodyOfPost()).toEqual({ version: CURRENT_TERMS_VERSION });
  });

  /* Should not happen — a sign-up whose role cannot be stored is refused — but a record expires after 7 days. */
  it('with no recorded role, says to contact support, offers no picker and sends nothing — never a default', async () => {
    const user = userEvent.setup();
    render(
      <AcceptTermsScreen
        status={status({ suggestedRole: 'vendor' })}
        terms={TERMS}
        returnTo={null}
      />,
    );

    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByTestId('stored-role')).toBeNull();
    expect(screen.getByText("We couldn't find how you're joining")).toBeDefined();
    expect(screen.getByText(/Your sign-up choice wasn't saved\./).textContent).toBe(
      "Your sign-up choice wasn't saved. Contact support and we'll finish setting you up.",
    );
    expect(screen.getByRole('link', { name: 'Contact support' }).getAttribute('href')).toBe(
      '/support',
    );
    expect(submit().disabled).toBe(true);

    await user.click(submit());
    fireEvent.submit(submit().closest('form') as HTMLFormElement);

    expect(post).not.toHaveBeenCalled();
  });

  it.each([
    { stated: 'vendor', stored: 'customer' },
    { stated: 'customer', stored: 'vendor' },
  ] as const)(
    'shows the stored $stored role before continuing when $stated was stated',
    async ({ stated, stored: landed }) => {
      const user = userEvent.setup();
      post.mockResolvedValue(
        status({
          accepted: true,
          acceptedAt: new Date(),
          account: { exists: true, role: landed },
        }),
      );
      render(<AcceptTermsScreen status={recorded(stated)} terms={TERMS} returnTo={null} />);

      await user.click(submit());

      await waitFor(() =>
        expect(screen.getByTestId('landed-role').textContent).toBe(
          `You're joining as a ${landed}.`,
        ),
      );
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
        `Welcome to ${BRAND_NAME}`,
      );
      expect(document.body.textContent).not.toMatch(FORBIDDEN_COPY);
      expect(replace).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(replace).toHaveBeenCalledWith('/after-sign-in');
    },
  );

  it('names an admin account as an admin', () => {
    render(<AcceptTermsScreen status={stored('admin')} terms={TERMS} returnTo={null} />);

    expect(screen.getByTestId('stored-role').textContent).toBe("You're joining as an admin.");
  });

  it('keeps the stated role and offers a retry when the save fails', async () => {
    const user = userEvent.setup();
    post.mockRejectedValueOnce(new ApiClientError(500, 'INTERNAL_ERROR', 'boom'));
    post.mockResolvedValueOnce(
      status({ accepted: true, acceptedAt: new Date(), account: { exists: true, role: 'vendor' } }),
    );
    render(<AcceptTermsScreen status={recorded('vendor')} terms={TERMS} returnTo={null} />);

    await user.click(submit());
    await waitFor(() => expect(screen.getByText(/Nothing was saved/)).toBeDefined());
    expect(screen.getByTestId('stored-role').textContent).toContain('joining as a vendor');

    await user.click(submit());

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(replace).toHaveBeenCalledWith('/after-sign-in');
  });

  it('sends a refused vendor on to the details screen, keeping the session (VEN-512)', async () => {
    const user = userEvent.setup();
    post.mockRejectedValueOnce(
      new ApiClientError(403, 'vendor_not_invited', 'Vendor accounts are by invitation for now.'),
    );
    render(<AcceptTermsScreen status={recorded('vendor')} terms={TERMS} returnTo={null} />);

    await user.click(submit());

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/sign-up/vendor-details'));
    expect(bodyOfPost()).toEqual({ version: CURRENT_TERMS_VERSION });
    expect(signOut).not.toHaveBeenCalled();
  });

  it('never skips this screen on the recorded role alone (VEN-512)', () => {
    render(<AcceptTermsScreen status={recorded('vendor')} terms={TERMS} returnTo={null} />);

    expect(screen.getByTestId('stored-role').textContent).toContain('joining as a vendor');
    expect(replace).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('has no checkbox and shows the notice with working Terms and Privacy links under the submit', () => {
    render(<AcceptTermsScreen status={recorded('customer')} terms={TERMS} returnTo={null} />);

    expect(screen.queryByRole('checkbox')).toBeNull();
    const notice = document.querySelector('[data-continue-notice]') as HTMLElement;
    expect(notice.textContent).toBe('By continuing you agree to the Terms and Privacy Policy.');
    expect(within(notice).getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms');
    expect(within(notice).getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe(
      '/privacy',
    );
    /* Directly under the submit: the notice follows the button in document order. */
    expect(
      submit().compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  /* Frame 40 (VEN-744): one centred column, the logo, one sentence, one button, the consent line under it. */
  it.each([
    { role: 'customer', sentence: "You're joining as a customer." },
    { role: 'vendor', sentence: "You're joining as a vendor." },
  ] as const)('draws the $role welcome as frame 40 does', ({ role, sentence }) => {
    render(<AcceptTermsScreen status={recorded(role)} terms={TERMS} returnTo={null} />);

    const shell = screen.getByTestId('first-run-shell');
    expect(within(shell).getByTestId('logo')).toBeDefined();
    expect(within(shell).getByRole('heading', { level: 1 }).textContent).toBe(
      `Welcome to ${BRAND_NAME}`,
    );
    expect(within(shell).getByTestId('stored-role').textContent).toBe(sentence);
    expect(
      within(shell)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Continue']);
    expect(within(shell).queryByRole('checkbox')).toBeNull();

    const notice = shell.querySelector('[data-continue-notice]') as HTMLElement;
    for (const name of ['Terms', 'Privacy Policy']) {
      expect(within(notice).getByRole('link', { name }).getAttribute('target')).toBe('_blank');
    }
    expect(notice.className).toContain('text-center');
    /* Full-width primary: the frame's button spans the 460px controls column. */
    expect(submit().className).toContain('w-full');
  });

  it('draws the landed-as welcome and the no-role failure in the same shell', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue(
      status({ accepted: true, acceptedAt: new Date(), account: { exists: true, role: 'vendor' } }),
    );
    const { unmount } = render(
      <AcceptTermsScreen status={recorded('customer')} terms={TERMS} returnTo={null} />,
    );

    await user.click(submit());

    await waitFor(() => expect(screen.getByTestId('landed-role')).toBeDefined());
    expect(screen.getByTestId('first-run-shell').contains(screen.getByTestId('landed-role'))).toBe(
      true,
    );
    unmount();

    render(<AcceptTermsScreen status={status()} terms={TERMS} returnTo={null} />);

    expect(
      screen
        .getByTestId('first-run-shell')
        .contains(screen.getByText("We couldn't find how you're joining")),
    ).toBe(true);
  });

  it('leaves the new-version screen outside the shell', () => {
    render(<AcceptTermsScreen status={tickStatus()} terms={TERMS} returnTo={null} />);

    expect(screen.queryByTestId('first-run-shell')).toBeNull();
  });

  it('sends one request for a double-click on the submit', async () => {
    let release: (value: TermsAcceptanceStatus) => void = () => undefined;
    post.mockReset();
    post.mockReturnValue(new Promise<TermsAcceptanceStatus>((resolve) => (release = resolve)));
    render(<AcceptTermsScreen status={recorded('customer')} terms={TERMS} returnTo={null} />);

    /*
     * Two submits inside one act, so React has not re-rendered `saving` between
     * them: only the ref decides that the second is ignored.
     */
    const form = submit().closest('form') as HTMLFormElement;
    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    release(status({ accepted: true, account: { exists: true, role: 'customer' } }));

    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledTimes(1);
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
    render(<AcceptTermsScreen status={tickStatus()} terms={TERMS} returnTo={null} />);

    expect(box().checked).toBe(false);
    expect(submit().disabled).toBe(true);
  });

  /** The document is named and linked beside the box, not merely alluded to. */
  it('names and links the document beside the box', () => {
    render(<AcceptTermsScreen status={tickStatus()} terms={TERMS} returnTo={null} />);

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
    render(<AcceptTermsScreen status={tickStatus()} terms={TERMS} returnTo={null} />);

    await user.click(box());
    await user.click(screen.getByRole('button', { name: /Read all \d+ sections/ }));

    expect(screen.getByRole('button', { name: 'Collapse the Terms' })).toBeDefined();
    expect(box().checked).toBe(true);
  });

  it('sends the tick and the version, and forwards through /after-sign-in', async () => {
    const user = userEvent.setup();
    render(<AcceptTermsScreen status={tickStatus()} terms={TERMS} returnTo="/bookings/abc" />);

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
    render(<AcceptTermsScreen status={tickStatus()} terms={TERMS} returnTo={null} />);

    await user.click(submit());

    expect(post).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  /** A revision landing while the page was open must not be accepted silently. */
  it('says the Terms moved when the version is refused, and stays put', async () => {
    const { ApiClientError } = await import('@/lib/api-client');
    post.mockRejectedValue(new ApiClientError(409, 'CONFLICT', 'not current'));

    const user = userEvent.setup();
    render(<AcceptTermsScreen status={tickStatus()} terms={TERMS} returnTo={null} />);

    await user.click(box());
    await user.click(submit());

    await waitFor(() =>
      expect(screen.getByText(/The Terms changed while this page was open/)).toBeDefined(),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  /** A ban landing while the page is open: a retry re-posts into the same 403. */
  it('sends a suspended account to /suspended instead of offering a retry', async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(new ApiClientError(403, 'FORBIDDEN', 'This account has been suspended'));
    render(<AcceptTermsScreen status={tickStatus()} terms={TERMS} returnTo={null} />);

    await user.click(box());
    await user.click(submit());

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/suspended'));
    expect(screen.queryByText(/try again/)).toBeNull();
  });

  /** A retired row with a live session: nothing this page posts can succeed. */
  it('ends a session the API no longer honours and returns to sign-in', async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(new ApiClientError(401, 'UNAUTHORIZED', 'Sign in again'));
    render(<AcceptTermsScreen status={tickStatus()} terms={TERMS} returnTo={null} />);

    await user.click(box());
    await user.click(submit());

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/sign-in'));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/try again/)).toBeNull();
  });

  it('still offers a retry for a server failure', async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(new ApiClientError(500, 'INTERNAL_ERROR', 'boom'));
    render(<AcceptTermsScreen status={tickStatus()} terms={TERMS} returnTo={null} />);

    await user.click(box());
    await user.click(submit());

    await waitFor(() => expect(screen.getByText('Nothing was saved. Try again.')).toBeDefined());
    expect(replace).not.toHaveBeenCalled();
  });

  /** The card opens on this page, so an in-text link must not navigate this tab. */
  it('opens the Privacy Policy link inside the Terms card in a new tab', () => {
    render(<AcceptTermsScreen status={tickStatus()} terms={TERMS} returnTo={null} />);

    const links = screen.getAllByRole('link', { name: 'Privacy Policy' });

    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toBe('/privacy');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });

  it('keeps its own explanatory copy word for word (VEN-700)', () => {
    render(<AcceptTermsScreen status={tickStatus()} terms={TERMS} returnTo={null} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('The Terms have changed');
    expect(
      screen.getByText(`Please accept the current Terms to keep using ${BRAND_NAME}.`),
    ).toBeDefined();
    expect(screen.getByText('We save the version and time you accept.')).toBeDefined();

    const text = document.body.textContent ?? '';

    for (const gone of [
      'so both sides can say what was agreed',
      'so the record means something later',
      'the moment, and this browser',
    ]) {
      expect(text).not.toContain(gone);
    }
  });

  it('shows no role choice and no notice on the new-version screen', () => {
    render(<AcceptTermsScreen status={tickStatus()} terms={TERMS} returnTo={null} />);

    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByTestId('stored-role')).toBeNull();
    expect(document.querySelector('[data-continue-notice]')).toBeNull();
    expect(screen.getByRole('checkbox')).toBeDefined();
  });
});
