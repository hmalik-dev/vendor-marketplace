import {
  BRAND_NAME,
  PAYOUT_RELEASE_HOURS,
  VENDOR_AGREEMENT_PATH,
} from '@vendor-marketplace/shared';
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

  it('puts the right article before the brand in the payouts note', async () => {
    await renderPage();

    const article = /^[aeiou]/i.test(BRAND_NAME) ? 'an' : 'a';
    expect(document.getElementById('payouts')?.textContent).toContain(
      `not ${article} ${BRAND_NAME} balance`,
    );
    expect(document.body.textContent).not.toMatch(/\ba [AEIOU]\w* balance/);
  });

  it('links the vendor agreement from the closing band', async () => {
    await renderPage();

    expect(
      screen.getByRole('link', { name: 'Read the vendor agreement' }).getAttribute('href'),
    ).toBe(VENDOR_AGREEMENT_PATH);
  });
});
