import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminQueryString } from '@/lib/admin-params';
import { FilterBar, FilterSelect } from './filter-bar';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

/*
 * The Refine bar's submit and the query it sends (#455).
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

afterEach(cleanup);

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
          carried={params}
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
          carried={{ type: undefined }}
          name="type"
          label="Direction"
          value=""
          options={DIRECTIONS}
        />
      </FilterBar>,
    );

    /*
     * `?type=` is not the same URL as no `type` at all: `adminQueryString`
     * drops empty values, so a bar that submitted one would send the operator
     * somewhere the dropdown never sends them.
     */
    expect(serialise(container)).toEqual({});
  });

  it('carries a filter that has no control of its own', () => {
    /*
     * `/admin/activity`. Its identity filters are uuids that arrive from a
     * clicked row and are drawn as dismiss chips — a list of every operator on
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
          carried={{ actor: params.actor, subject: params.subject }}
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
          carried={params}
          name="category"
          label="Category"
          value="photography"
          options={[{ value: 'photography', label: 'Photography' }]}
        />
      </FilterBar>,
    );

    /*
     * One `q`, from the input the operator types into — a hidden field under
     * the same name would submit `?q=rose&q=rose`, and the whole point of the
     * search field is that it carries the *edited* value.
     */
    const submitted = new FormData(formElement(container));
    expect(submitted.getAll('q')).toEqual(['rose']);
    expect(serialise(container)).toEqual(params);
  });

  it('submits to the surface it filters, by GET, so a filter stays a pasteable URL', () => {
    // `{}` is what a bar with nothing applied passes. `params` is required, so
    // a surface cannot arrive at this state by forgetting the prop.
    const { container } = render(<FilterBar action="/admin/reviews" params={{}} />);
    const form = formElement(container);

    expect(form.getAttribute('action')).toBe('/admin/reviews');
    expect(form.getAttribute('method')).toBe('get');
    expect(serialise(container)).toEqual({});
  });
});
