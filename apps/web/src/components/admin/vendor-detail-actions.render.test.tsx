import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WireAdminVendorDetail } from '@/lib/wire-schemas';

vi.mock('@/lib/use-api', () => ({ useApi: () => vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const { VendorDetailActions } = await import('./vendor-detail-actions');

type Vendor = WireAdminVendorDetail['vendor'];

/** Only the fields the actions read; the rest is the wire shape's business. */
function vendorOf(status: Vendor['status'], isPublished: boolean): Vendor {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    businessName: 'Fernbank Studio',
    status,
    isPublished,
    payoutHold: false,
  } as unknown as Vendor;
}

function buttonNames(vendor: Vendor): string[] {
  render(<VendorDetailActions vendor={vendor} />);

  return screen.getAllByRole('button').map((button) => button.textContent ?? '');
}

afterEach(cleanup);

describe('VendorDetailActions storefront controls (VEN-423)', () => {
  it('offers the moderation hold on a storefront its vendor already unpublished', () => {
    const names = buttonNames(vendorOf('paused', false));

    expect(names).toContain('Publish profile');
    expect(names).toContain('Unpublish profile');
  });

  it('offers only Unpublish on a live storefront', () => {
    const names = buttonNames(vendorOf('live', true));

    expect(names).toContain('Unpublish profile');
    expect(names).not.toContain('Publish profile');
  });

  it('offers only Publish on a held storefront, whose hold already stands', () => {
    const names = buttonNames(vendorOf('held', false));

    expect(names).toContain('Publish profile');
    expect(names).not.toContain('Unpublish profile');
  });

  it('claims no Stripe balance reversal in the suspension line', () => {
    render(<VendorDetailActions vendor={vendorOf('live', true)} />);

    expect(document.body.textContent).toContain('refunded in full from the platform balance');
    expect(document.body.textContent).not.toMatch(/reverses out of|Stripe balance/);
  });
});
