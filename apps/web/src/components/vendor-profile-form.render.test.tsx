import { COVER_CONSTRAINT_LINE, ERROR_CODES, type Category } from '@vendor-marketplace/shared';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import type { WireVendorProfile } from '@/lib/wire-schemas';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api-client';

const requestMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('@/lib/use-api', () => ({
  useApi: () => requestMock,
  useImageUpload: () => vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));

const { VendorProfileForm } = await import('./vendor-profile-form');

function category(id: string, name: string, slug: string, displayOrder: number): Category {
  return { id, name, slug, description: null, icon: null, displayOrder, isActive: true };
}

const CATEGORIES: readonly Category[] = [
  category('11111111-1111-4111-8111-111111111111', 'Photography', 'photography', 1),
  category('22222222-2222-4222-8222-222222222222', 'Catering', 'catering', 2),
];

type User = ReturnType<typeof userEvent.setup>;

afterEach(() => {
  cleanup();
  requestMock.mockReset();
  refreshMock.mockReset();
});

/** A vendor onboarding: no profile row yet, so the form is in create mode. */
function renderOnboarding(): void {
  render(<VendorProfileForm profile={null} categories={CATEGORIES} allTags={[]} />);
}

/**
 * A saved storefront, complete enough that nothing else paints a blocker dot —
 * so a dot in these tests can only have come from the thing under test.
 */
function savedProfile(overrides: Partial<WireVendorProfile> = {}): WireVendorProfile {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    userId: '44444444-4444-4444-8444-444444444444',
    businessName: 'Sunlit Studio',
    slug: 'sunlit-studio',
    bio: 'Ten years photographing weddings across central Texas.',
    tagline: 'Film for the portraits, digital for everything else',
    yearsInBusiness: 10,
    profileImageUrl: null,
    coverImageUrl: null,
    address: '1204 E Cesar Chavez St',
    city: 'Austin',
    state: 'Texas',
    latitude: null,
    longitude: null,
    serviceRadiusKm: 96,
    responseTimeHours: 24,
    stripeAccountId: 'acct_1',
    stripeOnboarded: true,
    isPublished: true,
    isDeleted: false,
    avgRating: 4.9,
    reviewCount: 17,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    categoryIds: [CATEGORIES[0]!.id],
    tags: [],
    publishBlockers: [],
    ...overrides,
  };
}

function renderSaved(overrides: Partial<WireVendorProfile> = {}): void {
  render(
    <VendorProfileForm profile={savedProfile(overrides)} categories={CATEGORIES} allTags={[]} />,
  );
}

/**
 * The rail row for a section that lives on its own route, which renders as a
 * link. `Payouts` is one of those — it points at `/vendor/payments`.
 */
function railLink(label: string): HTMLElement {
  const rail = screen.getByRole('navigation', { name: 'Storefront sections' });
  const item = within(rail)
    .getAllByRole('link')
    .find((node) => node.textContent?.startsWith(label));

  if (!item) {
    throw new Error(`No rail link labelled ${label}`);
  }

  return item;
}

async function chooseState(user: User): Promise<void> {
  // A dropdown trigger now, not a Radix `Select` combobox (#167).
  await user.click(screen.getByRole('button', { name: /^State/ }));
  await user.click(await screen.findByRole('option', { name: 'Texas' }));
}

/**
 * Everything the create schema demands, so a submit reaches the API. Native
 * constraint validation stops a submit before React ever sees it, which is why
 * the `required` inputs are filled even in the tests about the server's answer.
 */
async function completeTheProfile(user: User): Promise<void> {
  await user.type(screen.getByLabelText('Business name'), 'Sunlit Studio');
  await user.type(screen.getByLabelText('City'), 'Austin');
  await chooseState(user);
  await user.click(screen.getByRole('button', { name: 'Photography' }));
}

function createProfile(user: User): Promise<void> {
  return user.click(screen.getByRole('button', { name: 'Create profile' }));
}

describe('VendorProfileForm — a save the API refuses', () => {
  /*
   * #222. The 400 was swallowed: no toast, no inline error, no `[role=alert]`,
   * no `aria-invalid`, no focus move. The button read as dead — the pass that
   * found it clicked Save four times — and onboarding could only be completed
   * by calling the API directly.
   */
  it('renders the refusal on the control the API names', async () => {
    const user = userEvent.setup();
    requestMock.mockRejectedValue(
      new ApiClientError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'One or more selected categories are unavailable. Reload the page and choose from the current list.',
        { field: 'categoryIds' },
      ),
    );
    renderOnboarding();

    await completeTheProfile(user);
    await createProfile(user);

    const message = await screen.findByText(
      'One or more selected categories are unavailable. Reload the page and choose from the current list.',
    );

    /*
     * Associated, not merely present. The picker is a group of buttons rather
     * than a form control, so the tie is `aria-describedby` on a named group —
     * `aria-invalid` is not global and would be inert on a generic element.
     */
    const picker = screen.getByRole('group', { name: 'Categories' });
    expect(message.id).toBe('categories-error');
    expect(picker.getAttribute('aria-describedby')).toBe('categories-error');
  });

  it('announces a refusal that belongs to no field, rather than dropping it', async () => {
    const user = userEvent.setup();
    requestMock.mockRejectedValue(
      new ApiClientError(409, ERROR_CODES.CONFLICT, 'That business name is already taken.'),
    );
    renderOnboarding();

    await completeTheProfile(user);
    await createProfile(user);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('That business name is already taken.');
  });

  /** A request that never arrived is not the vendor's profile being wrong. */
  it('distinguishes a failed request from a refused one', async () => {
    const user = userEvent.setup();
    requestMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderOnboarding();

    await completeTheProfile(user);
    await createProfile(user);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(
      'Your profile did not reach us. Check your connection and save again.',
    );
  });

  it('clears the refusal once the vendor changes the control it named', async () => {
    const user = userEvent.setup();
    requestMock.mockRejectedValue(
      new ApiClientError(400, ERROR_CODES.VALIDATION_ERROR, 'Those categories are unavailable.', {
        field: 'categoryIds',
      }),
    );
    renderOnboarding();

    await completeTheProfile(user);
    await createProfile(user);
    await screen.findByText('Those categories are unavailable.');

    await user.click(screen.getByRole('button', { name: 'Catering' }));

    await waitFor(() => {
      expect(screen.queryByText('Those categories are unavailable.')).toBeNull();
    });
    expect(
      screen.getByRole('group', { name: 'Categories' }).getAttribute('aria-describedby'),
    ).toBeNull();
  });
});

describe('VendorProfileForm — a save the form itself refuses', () => {
  /*
   * The other half of the same defect: a schema failure was one toast naming
   * one issue, with nothing on the fields it named. Native validation covers
   * the empty `required` inputs, so these are the rules only the schema knows.
   */
  it('marks each rejected field and counts them at the head of the form', async () => {
    const user = userEvent.setup();
    renderOnboarding();

    await user.type(screen.getByLabelText('Business name'), 'A');
    await user.type(screen.getByLabelText('City'), 'Austin');
    await chooseState(user);
    await createProfile(user);

    expect(requestMock).not.toHaveBeenCalled();

    const summary = await screen.findByRole('alert');
    expect(summary.textContent).toContain('Two fields need fixing before this can go out');
    expect(screen.getByLabelText('Business name').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Enter your business name')).toBeTruthy();
    expect(screen.getByText('Select at least one category')).toBeTruthy();
  });

  /** The summary links to the control, so a long form does not have to be hunted. */
  it('links each counted field to its control', async () => {
    const user = userEvent.setup();
    renderOnboarding();

    await user.type(screen.getByLabelText('Business name'), 'Sunlit Studio');
    await user.type(screen.getByLabelText('City'), 'Austin');
    await chooseState(user);
    await createProfile(user);

    const link = await screen.findByRole('link', { name: 'Categories' });
    expect(link.getAttribute('href')).toBe('#categories');
    expect(document.getElementById('categories')).not.toBeNull();
  });

  it('says nothing in red before a submit is attempted', () => {
    renderOnboarding();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('Business name').getAttribute('aria-invalid')).toBeNull();
  });

  it('sends the profile once every blocking field is answered', async () => {
    const user = userEvent.setup();
    // The editor saves the profile and the tags through two endpoints in one
    // submit, and they answer with different shapes.
    requestMock.mockImplementation((path: string) =>
      path === '/vendor/tags'
        ? Promise.resolve([])
        : Promise.resolve({
            id: 'v1',
            slug: 'sunlit-studio',
            isPublished: false,
            publishBlockers: [],
            tags: [],
          }),
    );
    renderOnboarding();

    await completeTheProfile(user);
    await createProfile(user);

    await waitFor(() => {
      expect(requestMock).toHaveBeenCalledWith(
        '/vendor/profile',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

/*
 * #360, carrying #258: the submit bar never said when the storefront was last
 * saved, so a vendor returning to the screen could not tell a saved draft from
 * an unsaved one.
 *
 * The clock is faked rather than read: `shortTimeAgo` is relative, so a real
 * clock would make this assert a different string on every run.
 */
describe('the submit bar says when the storefront was last saved (#360)', () => {
  const NOW = new Date('2026-08-30T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports how long ago the last save was', () => {
    renderSaved({ updatedAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000) });

    expect(screen.getByText('Saved 2h ago')).toBeTruthy();
  });

  it('floors at a minute rather than counting seconds', () => {
    renderSaved({ updatedAt: new Date(NOW.getTime() - 9 * 1000) });

    expect(screen.getByText('Saved 1m ago')).toBeTruthy();
  });

  /*
   * A profile that has never been saved has nothing to report, and the word
   * "never" beside a Create button would be noise rather than information.
   */
  it('says nothing on a profile that has never been saved', () => {
    renderOnboarding();

    expect(screen.queryByText(/^Saved /)).toBeNull();
  });
});

/*
 * #360, carrying #288 and #137: the cover drop zone.
 *
 * #137 was stuck because the contract contradicted itself — a `21:9,
 * 1600×686` ask nobody shoots. #288 retired it and frame `09` now draws a
 * 216×144 3:2 zone. There is deliberately **no separate profile-banner
 * field**: one file, two placements, per #287.
 */
describe('the cover drop zone (#360)', () => {
  it('offers a cover photo zone beside the profile photo', () => {
    renderSaved();

    expect(screen.getByRole('group', { name: 'Cover photo' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Profile photo' })).toBeTruthy();
  });

  /*
   * One file, two placements. A second banner field would be the thing #287
   * ruled out, and it is easier to catch here than in a browser pass.
   */
  it('offers no separate profile-banner field', () => {
    renderSaved();

    expect(screen.queryByRole('group', { name: /banner/i })).toBeNull();
  });

  /*
   * An absolute URL, because that is what the form is actually handed:
   * `wireVendorProfileSchema` resolves the stored object key through
   * `resolveImageUrl` at the client boundary. A bare key here would resolve to
   * null whenever `NEXT_PUBLIC_S3_PUBLIC_URL` is unset and the test would be
   * asserting against a shape the component never receives.
   *
   * Queried by tag, not by role: the preview carries `alt=""` on purpose — it
   * is the vendor's own photo shown back to them, not content — so it is
   * exposed as `presentation` and has no `img` role to find it by.
   */
  it('prefills the zone from the saved cover', () => {
    const cover = 'https://cdn.example.test/vendor-cover/abc.jpg';
    renderSaved({ coverImageUrl: cover });

    const preview = screen
      .getByRole('group', { name: 'Cover photo' })
      .querySelector<HTMLImageElement>('img');

    expect(preview?.getAttribute('src')).toBe(cover);
  });

  it('states the cover constraint before the picker opens', () => {
    renderSaved();

    expect(
      within(screen.getByRole('group', { name: 'Cover photo' })).getByText(COVER_CONSTRAINT_LINE),
    ).toBeTruthy();
  });
});

/*
 * #360: the rail's `Payouts` entry, and the one thing about it that could
 * silently rot — a dot showing invented status rather than the vendor's real
 * Connect state. Asserted in BOTH directions, because a dot hard-coded on and
 * a dot correctly driven look identical from the failing side alone.
 */
describe('the Payouts rail entry (#360)', () => {
  it('links to the payouts surface #9 shipped', () => {
    renderSaved();

    expect(railLink('Payouts').getAttribute('href')).toBe('/vendor/payments');
  });

  it('marks Payouts as blocking while Stripe onboarding is incomplete', () => {
    renderSaved({ stripeOnboarded: false });

    expect(
      within(railLink('Payouts')).getByRole('img', {
        name: 'Needs attention before publishing',
      }),
    ).toBeTruthy();
  });

  it('clears the dot once Stripe onboarding completes', () => {
    renderSaved({ stripeOnboarded: true });

    expect(
      within(railLink('Payouts')).queryByRole('img', {
        name: 'Needs attention before publishing',
      }),
    ).toBeNull();
  });

  /*
   * Gold is "waiting on someone" in `40-states.md`; red is "it failed".
   * Payouts not set up yet is the former, so the dot must never go red — and
   * the class is the assertion because jsdom resolves no Tailwind colours.
   */
  it('paints that dot gold rather than red', () => {
    renderSaved({ stripeOnboarded: false });

    const dot = within(railLink('Payouts')).getByRole('img', {
      name: 'Needs attention before publishing',
    });

    expect(dot.className).toContain('bg-gold-400');
    expect(dot.className).not.toMatch(/bg-(error|red)-/);
  });

  /*
   * Publishing does not require Stripe — a storefront can be live and simply
   * unable to accept a booking — so an incomplete payout setup must not be
   * reported as a publish blocker anywhere else on the screen.
   *
   * The positive half is asserted first on purpose: a `queryBy…` that returns
   * null because the string never renders under any condition is not a check.
   * This establishes that a real blocker does produce the line, so the absence
   * below is evidence rather than a vacuous pass.
   */
  it('shows the publish-blocker line when a real blocker stands', () => {
    renderSaved({ stripeOnboarded: true, publishBlockers: ['packages'] });

    expect(screen.getByText(/before you can publish/i)).toBeTruthy();
  });

  it('does not count payouts as a publish blocker', () => {
    renderSaved({ stripeOnboarded: false, publishBlockers: [] });

    expect(screen.queryByText(/before you can publish/i)).toBeNull();
  });
});
