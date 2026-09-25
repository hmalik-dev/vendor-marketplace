import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminQueryString } from '@/lib/admin-params';
import { FilterBar, FilterSelect } from './filter-bar';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

/*
 * `pendingOverride` lets one test force `useTransition`'s reported `pending`
 * to stay `true` after the real transition has already settled — the shape of
 * VEN-591's bug, where Next's own settle signal is not trustworthy proof that
 * *this* push landed. `startTransition` itself is untouched; only the
 * `pending` value the component reads is substituted.
 */
let pendingOverride: boolean | null = null;
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useTransition: () => {
      const [realPending, start] = actual.useTransition();
      return [pendingOverride ?? realPending, start] as const;
    },
  };
});

/*
 * The Refine bar's submit and the query it sends (VEN-383).
 *
 * The defect this file was written against: on `/admin/reviews` the `Apply
 * filters` submit navigated to `/admin/reviews` with **no query at all**, so
 * the one control named for applying the filters was the only control that
 * discarded them. The cause is visible in a serialisation, which is why the
 * assertions below read `FormData` rather than a class list: the dropdowns
 * navigate on change and are not form controls, so a bar whose filters are not
 * *also* written as fields submits an empty form.
 *
 * They are asserted against `adminQueryString` — the same function the
 * dropdown's change handler builds its URL with — rather than against a
 * literal, because the requirement is that the two paths **agree**. A literal
 * would let them drift apart while both tests stayed green.
 *
 * The fields belong to the bar rather than to each `FilterSelect`, and the
 * `/admin/activity` case below is why: `actor` and `subject` are filters with
 * no control of their own, so a per-dropdown field would have left that surface
 * with exactly the defect this fixes.
 */

afterEach(() => {
  cleanup();
  push.mockClear();
});

/** The bar's `<form>`. `getByRole('form')` needs an accessible name it has none of. */
function formElement(container: HTMLElement): HTMLFormElement {
  const form = container.querySelector('form');

  if (!form) {
    throw new Error('the Refine bar rendered no form');
  }

  return form;
}

/** What a browser would send if the submit were activated right now. */
function serialise(container: HTMLElement): Record<string, string> {
  return Object.fromEntries(new FormData(formElement(container)).entries()) as Record<
    string,
    string
  >;
}

const DIRECTIONS = [
  { value: 'customer_to_vendor', label: 'About a vendor' },
  { value: 'vendor_to_customer', label: 'About a customer' },
] as const;

describe('the Refine bar submit', () => {
  it('sends the query the dropdown change handler would have built', () => {
    const params = { type: 'vendor_to_customer' };

    const { container } = render(
      <FilterBar action="/admin/reviews" params={params}>
        <FilterSelect
          action="/admin/reviews"
          name="type"
          label="Direction"
          value="vendor_to_customer"
          options={DIRECTIONS}
        />
      </FilterBar>,
    );

    // The change handler's destination, for the choice already applied.
    expect(`?${new URLSearchParams(serialise(container)).toString()}`).toBe(
      adminQueryString(params),
    );
  });

  it('sends nothing for a filter that is not applied, rather than an empty value', () => {
    const { container } = render(
      <FilterBar action="/admin/reviews" params={{ type: undefined }}>
        <FilterSelect
          action="/admin/reviews"
          name="type"
          label="Direction"
          value=""
          options={DIRECTIONS}
        />
      </FilterBar>,
    );

    /*
     * `?type=` is not the same URL as no `type` at all: `adminQueryString`
     * drops empty values, so a bar that submitted one would send the admin
     * somewhere the dropdown never sends them.
     */
    expect(serialise(container)).toEqual({});
  });

  it('carries a filter that has no control of its own', () => {
    /*
     * `/admin/activity`. Its identity filters are uuids that arrive from a
     * clicked row and are drawn as dismiss chips — a list of every admin on
     * the platform is not a control — so they never pass through a
     * `FilterSelect`. They still have to survive the submit.
     */
    const params = {
      action: 'vendor.banned',
      actor: '0f3f3d4a-1c0a-4a1e-8f6a-2b1c9d4e5f60',
      subject: 'b4f0a1c2-3d4e-4f50-9a6b-7c8d9e0f1a2b',
    };

    const { container } = render(
      <FilterBar action="/admin/activity" params={params}>
        <FilterSelect
          action="/admin/activity"
          name="action"
          label="Action"
          value={params.action}
          options={[{ value: 'vendor.banned', label: 'Vendor suspended' }]}
        />
      </FilterBar>,
    );

    expect(serialise(container)).toEqual(params);
  });

  it('leaves the search term to the search field, so it is not sent twice', () => {
    const params = { q: 'rose', category: 'photography', city: 'Austin', status: 'review' };

    const { container } = render(
      <FilterBar
        action="/admin/vendors"
        params={params}
        searchPlaceholder="Search"
        searchValue="rose"
      >
        <FilterSelect
          action="/admin/vendors"
          name="category"
          label="Category"
          value="photography"
          options={[{ value: 'photography', label: 'Photography' }]}
        />
      </FilterBar>,
    );

    /*
     * One `q`, from the input the admin types into — a hidden field under
     * the same name would submit `?q=rose&q=rose`, and the whole point of the
     * search field is that it carries the *edited* value.
     */
    const submitted = new FormData(formElement(container));
    expect(submitted.getAll('q')).toEqual(['rose']);
    expect(serialise(container)).toEqual(params);
  });

  it('names the search field with a visible label, not only an aria-label', () => {
    render(<FilterBar action="/admin/vendors" params={{}} searchPlaceholder="Search name…" />);

    const field = screen.getByRole('searchbox', { name: 'Search' });
    const label = document.querySelector(`label[for="${field.id}"]`);

    // A `<label>` element tied to the field, carrying text a sighted user reads.
    expect(label?.textContent).toBe('Search');
    expect(field.hasAttribute('aria-label')).toBe(false);
    expect(label?.className).not.toContain('sr-only');
  });

  it('submits to the surface it filters, by GET, so a filter stays a pasteable URL', () => {
    const { container } = render(<FilterBar action="/admin/reviews" params={{}} />);
    const form = formElement(container);

    expect(form.getAttribute('action')).toBe('/admin/reviews');
    expect(form.getAttribute('method')).toBe('get');
    expect(serialise(container)).toEqual({});
  });
});

/*
 * VEN-395. `carried` was hand-listed at every call site and the seven surfaces
 * had drifted — `/admin/payments` carried nothing, `/admin/vendors` carried
 * `page`. A dropdown now carries its bar's `params`, so there is one list.
 */
describe('a Refine bar dropdown', () => {
  function choose(label: string, option: string): void {
    fireEvent.click(screen.getByRole('button', { name: label }));
    fireEvent.click(screen.getByRole('option', { name: option }));
  }

  it('keeps every other filter in the bar when one changes', () => {
    render(
      <FilterBar
        action="/admin/vendors"
        params={{ q: 'rose', category: 'photography', city: 'Austin', status: undefined }}
        searchPlaceholder="Search"
        searchValue="rose"
      >
        <FilterSelect
          action="/admin/vendors"
          name="status"
          label="Status"
          value=""
          options={[{ value: 'review', label: 'Review' }]}
        />
      </FilterBar>,
    );

    choose('Status', 'Review');

    expect(push).toHaveBeenCalledWith(
      `/admin/vendors${adminQueryString({ q: 'rose', category: 'photography', city: 'Austin', status: 'review' })}`,
    );
  });

  it('replaces its own filter and drops the page, so a narrower list lands on page 1', () => {
    render(
      <FilterBar
        action="/admin/bookings"
        params={{ status: 'confirmed', flag: 'refund-stuck', page: '3' }}
      >
        <FilterSelect
          action="/admin/bookings"
          name="status"
          label="Status"
          value="confirmed"
          options={[
            { value: 'confirmed', label: 'Confirmed' },
            { value: 'completed', label: 'Completed' },
          ]}
        />
      </FilterBar>,
    );

    choose('Confirmed', 'Completed');

    expect(push).toHaveBeenCalledWith('/admin/bookings?status=completed&flag=refund-stuck');
  });

  it('refuses to render outside a bar, where it would silently carry nothing', () => {
    // React logs the thrown render error; the assertion is on the throw itself.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() =>
      render(
        <FilterSelect
          action="/admin/reviews"
          name="type"
          label="Direction"
          value=""
          options={DIRECTIONS}
        />,
      ),
    ).toThrow('FilterSelect "type" must be rendered inside a FilterBar');
    spy.mockRestore();
  });
});

/*
 * VEN-388. Frame `13` draws each trigger `padding:8px 14px`. The right side
 * was 12px, a vestige of the removed caret; the caret itself must stay gone
 * (`dropdown-caret.test.ts`), so padding is the whole of the fix.
 */
describe('a filter trigger', () => {
  it('pads both sides at the frame’s 14px and draws no caret', () => {
    render(
      <FilterBar action="/admin/vendors" params={{}}>
        <FilterSelect
          action="/admin/vendors"
          name="city"
          label="City"
          value=""
          options={[{ value: 'Austin', label: 'Austin' }]}
        />
      </FilterBar>,
    );

    const trigger = screen.getByRole('button', { name: 'City' });
    const classes = trigger.className.split(/\s+/);
    expect(classes).toContain('px-3.5');
    expect(classes).toContain('py-2');
    expect(classes.filter((name) => /^p[lr]-/.test(name))).toEqual([]);
    expect(trigger.textContent).toBe('City');
  });
});

/*
 * VEN-576. CI saw a chosen dropdown option leave the browser's URL on its
 * pre-choice value for a whole 30s timeout — the `push` server-recorded the
 * navigation but the browser never committed it. `assign` stands in for a
 * real navigation, which jsdom refuses (`connect-payouts-form.test.tsx`'s
 * pattern).
 */
describe('a Refine bar dropdown falling back off a dropped push', () => {
  const assign = vi.fn();
  const originalLocation = window.location;

  function choose(label: string, option: string): void {
    fireEvent.click(screen.getByRole('button', { name: label }));
    fireEvent.click(screen.getByRole('option', { name: option }));
  }

  beforeEach(() => {
    assign.mockClear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/admin/vendors', search: '?page=2', assign },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('hard-navigates once the transition settles and the URL never moved', () => {
    render(
      <FilterBar action="/admin/vendors" params={{ page: '2' }}>
        <FilterSelect
          action="/admin/vendors"
          name="city"
          label="City"
          value=""
          options={[{ value: 'Austin', label: 'Austin' }]}
        />
      </FilterBar>,
    );

    choose('City', 'Austin');

    expect(assign).toHaveBeenCalledWith('/admin/vendors?city=Austin');
  });

  it('does not hard-navigate when the push actually lands', () => {
    push.mockImplementationOnce((url: string) => {
      const [pathname, search] = url.split('?');
      window.location.pathname = pathname;
      window.location.search = search ? `?${search}` : '';
    });

    render(
      <FilterBar action="/admin/vendors" params={{ page: '2' }}>
        <FilterSelect
          action="/admin/vendors"
          name="city"
          label="City"
          value=""
          options={[{ value: 'Austin', label: 'Austin' }]}
        />
      </FilterBar>,
    );

    choose('City', 'Austin');

    expect(assign).not.toHaveBeenCalled();
  });

  /*
   * The fix this pins: comparing only against the pushed-to URL would
   * hard-navigate back over a sibling dropdown's later choice whenever two
   * transitions settle in the same commit. Comparing against the URL the push
   * started from — and only falling back when nothing moved it at all —
   * leaves a URL that changed for any other reason alone.
   */
  it('does not hard-navigate over a URL that already moved for another reason', () => {
    push.mockImplementationOnce(() => {
      window.location.pathname = '/admin/vendors';
      window.location.search = '?status=review';
    });

    render(
      <FilterBar action="/admin/vendors" params={{ page: '2' }}>
        <FilterSelect
          action="/admin/vendors"
          name="city"
          label="City"
          value=""
          options={[{ value: 'Austin', label: 'Austin' }]}
        />
      </FilterBar>,
    );

    choose('City', 'Austin');

    expect(assign).not.toHaveBeenCalled();
  });
});

/*
 * VEN-591. `/admin/activity`'s Action filter still raced after VEN-576: a bar
 * that also mounts a plain `Link` beside its dropdowns (`/admin/activity`'s
 * "Clear subject filter") can have that `Link`'s prefetch settle Next's own
 * transition tracking without this push's URL ever landing, so `pending` goes
 * `false` and the VEN-576 effect declares victory over a navigation that never
 * happened. `pendingOverride` reproduces exactly that: `pending` reads `true`
 * throughout, so the effect never runs, and only the bounded timer — which
 * does not depend on Next reporting anything — can heal it.
 */
describe('a Refine bar dropdown healing off the timer, not the transition settle', () => {
  const assign = vi.fn();
  const originalLocation = window.location;

  function choose(label: string, option: string): void {
    fireEvent.click(screen.getByRole('button', { name: label }));
    fireEvent.click(screen.getByRole('option', { name: option }));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    assign.mockClear();
    pendingOverride = true;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/admin/activity', search: '?actor=a1&subject=s1&page=2', assign },
    });
  });

  afterEach(() => {
    pendingOverride = null;
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    vi.useRealTimers();
  });

  it('hard-navigates once the heal timer elapses, even though pending never settles', () => {
    render(
      <FilterBar action="/admin/activity" params={{ actor: 'a1', subject: 's1', page: '2' }}>
        <FilterSelect
          action="/admin/activity"
          name="action"
          label="Action"
          value=""
          options={[{ value: 'vendor.banned', label: 'Vendor suspended' }]}
        />
      </FilterBar>,
    );

    choose('Action', 'Vendor suspended');

    // Nothing yet: the effect cannot fire while `pending` is stuck `true`.
    expect(assign).not.toHaveBeenCalled();

    // Pinned budget (would stay green through a regression to an eager timer
    // if this were missing): one tick short of the deadline is still nothing.
    vi.advanceTimersByTime(2999);
    expect(assign).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(assign).toHaveBeenCalledWith('/admin/activity?actor=a1&subject=s1&action=vendor.banned');
  });

  /*
   * Two writes, back to back, on two different dropdowns in the same bar
   * (AC2), and *both* dropped — the shape a diff-reviewer pass on this ticket
   * found the first version of this fix got wrong: a per-`FilterSelect` timer
   * checked only its own `from`/`to`, so `Actor`'s timer had no way to know
   * `Action` had since become the admin's real, later intent, and would
   * hard-navigate back to `Actor`'s stale target once its own deadline
   * elapsed — reintroducing the exact clobber VEN-576's `from` comparison
   * exists to prevent, just with a multi-second window instead of a
   * same-commit one.
   *
   * The fix is one shared `latest`/`timer` per bar (`FilterNav`): starting
   * `Action`'s push immediately supersedes `Actor`'s attempt and cancels its
   * timer outright, so `Actor`'s deadline (t=3000) never fires at all — only
   * `Action`'s own deadline (started at t=1000, so t=4000) can, and only for
   * `Action`'s own URL.
   */
  it('lets a later write supersede an earlier one, even when both pushes are dropped', () => {
    render(
      <FilterBar action="/admin/activity" params={{ actor: 'a1', subject: 's1', page: '2' }}>
        <FilterSelect
          action="/admin/activity"
          name="actor"
          label="Actor"
          value="a1"
          options={[{ value: 'a2', label: 'Admin two' }]}
        />
        <FilterSelect
          action="/admin/activity"
          name="action"
          label="Action"
          value=""
          options={[{ value: 'vendor.banned', label: 'Vendor suspended' }]}
        />
      </FilterBar>,
    );

    choose('Actor', 'Admin two');
    vi.advanceTimersByTime(1000);
    choose('Action', 'Vendor suspended');

    // Past `Actor`'s own would-be deadline (t=3000): its timer was cancelled
    // the moment `Action` pushed, so nothing has fired yet — and specifically
    // not a hard-navigation to `Actor`'s stale `?actor=a2` target.
    vi.advanceTimersByTime(2000);
    expect(assign).not.toHaveBeenCalled();

    // `Action`'s own deadline (started at t=1000, so t=4000 absolute).
    vi.advanceTimersByTime(1000);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/admin/activity?actor=a1&subject=s1&action=vendor.banned');
  });
});

describe('the active-filter chips (VEN-743)', () => {
  const STATUSES = [
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
  ] as const;

  function threeFilters(): ReturnType<typeof render> {
    return render(
      <FilterBar
        action="/admin/bookings"
        params={{ status: 'confirmed', flag: 'refund-stuck', q: 'kessler' }}
        searchPlaceholder="Search…"
        searchValue="kessler"
      >
        <>
          <FilterSelect
            action="/admin/bookings"
            name="status"
            label="Status"
            value="confirmed"
            options={STATUSES}
          />
          <FilterSelect
            action="/admin/bookings"
            name="flag"
            label="Needs attention"
            value="refund-stuck"
            options={[{ value: 'refund-stuck', label: 'Refund did not go through' }]}
          />
        </>
      </FilterBar>,
    );
  }

  function hrefOf(name: string): string | null {
    return screen.getByRole('link', { name }).getAttribute('href');
  }

  it('draws one chip per filter whose × removes only that filter', () => {
    threeFilters();

    const chips = within(screen.getByRole('list', { name: 'Active filters' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent);

    expect(chips).toEqual([
      'Search: kessler×',
      'Status: Confirmed×',
      'Needs attention: Refund did not go through×',
      'Clear all',
    ]);
    expect(hrefOf('Remove Search filter: kessler')).toBe(
      '/admin/bookings?status=confirmed&flag=refund-stuck',
    );
    expect(hrefOf('Remove Status filter: Confirmed')).toBe(
      '/admin/bookings?flag=refund-stuck&q=kessler',
    );
    expect(hrefOf('Remove Needs attention filter: Refund did not go through')).toBe(
      '/admin/bookings?status=confirmed&q=kessler',
    );
    expect(hrefOf('Clear all')).toBe('/admin/bookings');
  });

  it('finds a select whose element type is not FilterSelect, as it arrives across the RSC boundary', () => {
    /*
     * A client component handed through a Server Component's children arrives
     * as a lazy reference, so `child.type === FilterSelect` is false in the
     * running app. This stand-in has a different type and the same props.
     */
    const Lazy = (props: React.ComponentProps<typeof FilterSelect>): React.ReactElement => (
      <FilterSelect {...props} />
    );

    render(
      <FilterBar action="/admin/bookings" params={{ status: 'confirmed' }}>
        <Lazy
          action="/admin/bookings"
          name="status"
          label="Status"
          value="confirmed"
          options={STATUSES}
        />
      </FilterBar>,
    );

    expect(hrefOf('Remove Status filter: Confirmed')).toBe('/admin/bookings');
  });

  it('offers Clear all only from two filters, and draws nothing with none', () => {
    const { unmount } = render(
      <FilterBar
        action="/admin/payments"
        params={{ q: 'pi_3' }}
        searchPlaceholder="Search…"
        searchValue="pi_3"
      >
        {null}
      </FilterBar>,
    );

    expect(screen.getByRole('link', { name: 'Remove Search filter: pi_3' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Clear all' })).toBeNull();
    unmount();

    render(
      <FilterBar action="/admin/payments" params={{}} searchPlaceholder="Search…" searchValue="">
        {null}
      </FilterBar>,
    );

    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull();
  });

  it('draws no chip for a select with no Any choice, or for a filter with no select', () => {
    render(
      <FilterBar
        action="/admin/cases"
        params={{ status: 'open', actor: '0f3f3d4a-1c0a-4a1e-8f6a-2b1c9d4e5f60' }}
      >
        <FilterSelect
          action="/admin/cases"
          name="status"
          label="Status"
          allowAny={false}
          value="open"
          options={[{ value: 'open', label: 'Open' }]}
        />
      </FilterBar>,
    );

    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull();
  });
});
