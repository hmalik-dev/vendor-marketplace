import { BRAND_NAME, PAYOUT_RELEASE_HOURS, LEGAL_PATHS } from '@vendor-marketplace/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The two config figures, swappable per test. Getters rather than values, so a
 * test that changes one proves the page reads the symbol at render time rather
 * than a digit someone typed beside it (VEN-384 acceptance 4).
 */
const figures = vi.hoisted(() => ({
  rate: null as number | null,
  hours: null as number | null,
}));

vi.mock('@vendor-marketplace/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vendor-marketplace/shared')>();

  return {
    ...actual,
    get DEFAULT_PLATFORM_FEE_RATE() {
      return figures.rate ?? actual.DEFAULT_PLATFORM_FEE_RATE;
    },
    get PAYOUT_RELEASE_HOURS() {
      return figures.hours ?? actual.PAYOUT_RELEASE_HOURS;
    },
  };
});

const redirectVendorToDashboard = vi.fn<() => Promise<void>>();

vi.mock('@/lib/current-user', () => ({
  redirectVendorToDashboard: () => redirectVendorToDashboard(),
}));

const gate = vi.hoisted(() => ({ vendorInviteOnly: false }));

vi.mock('@/lib/vendor-data', () => ({
  getVendorSignUpGate: async () => ({ vendorInviteOnly: gate.vendorInviteOnly }),
}));

const { default: ForVendorsPage, dynamic } = await import('./page');

/** The real interval, read before any test swaps it. */
const RELEASE_HOURS = PAYOUT_RELEASE_HOURS;

async function renderPage(): Promise<void> {
  render(await ForVendorsPage());
}

describe('/for-vendors', () => {
  beforeEach(() => {
    redirectVendorToDashboard.mockResolvedValue(undefined);
  });

  afterEach(() => {
    figures.rate = null;
    figures.hours = null;
    gate.vendorInviteOnly = false;
    redirectVendorToDashboard.mockReset();
    cleanup();
  });

  it('is never prerendered, because a vendor is redirected away from it', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('runs the vendor guard, and renders nothing when it redirects', async () => {
    redirectVendorToDashboard.mockRejectedValue(new Error('NEXT_REDIRECT:/vendor/dashboard'));

    await expect(ForVendorsPage()).rejects.toThrow('NEXT_REDIRECT:/vendor/dashboard');
    expect(redirectVendorToDashboard).toHaveBeenCalledTimes(1);
  });

  it('asks for sign-up exactly twice, both times with the vendor card pre-selected', async () => {
    await renderPage();

    const ctas = screen.getAllByRole('link', { name: 'Start taking bookings' });

    expect(ctas).toHaveLength(2);
    for (const cta of ctas) {
      expect(cta.getAttribute('href')).toBe('/sign-up?role=vendor');
    }
  });

  it('points both calls to action at sign-up, reading "Join the waitlist" while the vendor gate is on (VEN-512)', async () => {
    gate.vendorInviteOnly = true;
    await renderPage();

    const ctas = screen.getAllByRole('link', { name: 'Join the waitlist' });

    expect(ctas.map((cta) => cta.getAttribute('href'))).toEqual([
      '/sign-up?role=vendor',
      '/sign-up?role=vendor',
    ]);
    expect(screen.queryByRole('link', { name: 'Start taking bookings' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Apply to join' })).toBeNull();
  });

  it('states the commission exactly once, as the subtraction in the worked example', async () => {
    await renderPage();

    const page = document.body.textContent ?? '';
    expect(page.match(/\d+(?:\.\d+)?\s*%/g)).toEqual(['12%']);

    const example = document.querySelector<HTMLElement>('[data-slot="worked-example"]');
    expect(example).not.toBeNull();
    expect(within(example as HTMLElement).getByText('12%')).toBeDefined();
    // $2,600 at 12% is $312; the vendor keeps the remainder.
    expect(example?.textContent).toContain('You charge$2,600');
    expect(example?.textContent).toContain('− $312');
    expect(example?.textContent).toContain('You keep$2,288');
  });

  it('follows the shared constants when they change', async () => {
    figures.rate = 0.2;
    figures.hours = 48;
    expect(RELEASE_HOURS).not.toBe(48);

    await renderPage();

    const example = document.querySelector('[data-slot="worked-example"]');
    expect(example?.textContent).toContain('20%');
    expect(example?.textContent).toContain('− $520');
    expect(example?.textContent).toContain('You keep$2,080');
    expect(screen.getByRole('heading', { name: /Released 48 hours after/ })).toBeDefined();
    expect(document.body.textContent).not.toContain('12%');
    expect(document.body.textContent).not.toContain(`${RELEASE_HOURS} hours`);
  });

  it('marks both config figures with a gold chip', async () => {
    await renderPage();

    const chips = [...document.querySelectorAll('[data-slot="config-chip"]')];

    expect(chips.map((chip) => chip.textContent)).toEqual(['12%', `${RELEASE_HOURS} hours`]);
    for (const chip of chips) {
      expect(chip.className.split(/\s+/)).toEqual(
        expect.arrayContaining(['bg-gold-50', 'text-gold-600']),
      );
    }
  });

  it('draws You keep in sage and no red token anywhere', async () => {
    await renderPage();

    const keep = document.querySelector('[data-slot="you-keep"]');
    expect(keep?.className.split(/\s+/)).toContain('text-sage-600');

    // Class-level: jsdom resolves no theme, so the computed colour is the browser pass's.
    const classes = [...document.querySelectorAll('[class]')].flatMap((element) =>
      element.className.split(/\s+/),
    );
    expect(classes.length).toBeGreaterThan(50);
    expect(document.querySelector('[aria-invalid]')).toBeNull();
    expect(
      classes
        // The button primitive's invalid-state border only resolves on `aria-invalid`, which no control here carries.
        .filter((name) => !name.startsWith('aria-invalid:'))
        .filter((name) => /(?:^|:)(?:text|bg|border|ring)-(?:error|red|destructive)/.test(name)),
    ).toEqual([]);
  });

  it('gives the payouts section its anchor without ever printing it', async () => {
    await renderPage();

    const section = document.getElementById('payouts');
    expect(section?.tagName).toBe('SECTION');
    expect(within(section as HTMLElement).getByRole('heading', { level: 2 }).textContent).toBe(
      'Collected at booking, released after the event.',
    );
    expect(screen.getByRole('link', { name: 'See how payouts work ↓' }).getAttribute('href')).toBe(
      '#payouts',
    );
    expect(document.body.textContent).not.toContain('#payouts');
  });

  it('draws four payout steps, numbered, with the release step last', async () => {
    await renderPage();

    const steps = [...document.querySelectorAll('[data-slot="payout-step"]')];

    expect(steps.map((step) => step.querySelector('p')?.textContent)).toEqual([
      '01',
      '02',
      '03',
      '04',
    ]);
    expect(steps[3]?.className.split(/\s+/)).toContain('bg-gold-25');
    expect(
      steps.slice(0, 3).every((step) => step.className.split(/\s+/).includes('bg-stone-50')),
    ).toBe(true);
  });

  it('says what is true about the money: step 2 and step 3 strings, and none of the retired claims', async () => {
    await renderPage();

    const steps = [...document.querySelectorAll('[data-slot="payout-step"]')];
    const text = (index: number): string[] =>
      [...(steps[index]?.querySelectorAll('h3, p') ?? [])]
        .slice(1) // the numeral
        .map((node) => node.textContent ?? '');

    expect(text(1)).toEqual(['The customer pays in full', 'At the moment they book.']);
    expect(text(2)).toEqual(['Held until the event', 'Your dashboard shows what you are owed.']);

    const page = document.body.textContent ?? '';
    for (const retired of [
      'not on the day',
      'sitting there',
      'in your account',
      `${BRAND_NAME} balance`,
      `an ${BRAND_NAME}`,
    ]) {
      expect(page, retired).not.toContain(retired);
    }
    expect(page).toContain('Nothing is invoiced and nothing is chased.');
    // The vendor agreement says a customer cancellation follows the checkout schedule, and a failed payout alerts the admin, not the vendor.
    expect(page).not.toContain('our fee is refunded');
    expect(page).not.toContain('Cancellations refund our fee');
    expect(page).not.toContain('which detail Stripe rejected');
    expect(page).not.toContain('as soon as it clears');
    // A free date stores nothing and a live request holds nothing, so neither promise is true.
    expect(page).not.toContain('a day you did not open');
    expect(page).not.toContain('unanswered requests expire');
    expect(page).toContain('That date closes to every other customer.');
  });

  it('links the vendor agreement from the closing band', async () => {
    await renderPage();

    expect(
      screen.getByRole('link', { name: 'Read the vendor agreement' }).getAttribute('href'),
    ).toBe(LEGAL_PATHS['vendor-agreement']);
  });

  it('reads short: no quote-chasing tail and no justifying clause on the fee (VEN-732)', async () => {
    await renderPage();

    const page = document.body.textContent ?? '';
    expect(page).toContain(
      'Customers book those days at those prices. No quotes by phone, no invoices to chase.',
    );
    expect(page).toContain(`exactly your price. ${BRAND_NAME} adds nothing on top.`);
    expect(page).not.toContain('afterwards');
    expect(page).not.toContain('the expensive way to book yourself');
  });
});
