import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WireAdminVendorDetail } from '@/lib/wire-schemas';

const api = vi.hoisted(() => vi.fn());

vi.mock('@/lib/use-api', () => ({ useApi: () => api }));
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
    backupWithholding: null,
  } as unknown as Vendor;
}

function buttonNames(vendor: Vendor): string[] {
  render(<VendorDetailActions vendor={vendor} />);

  return screen.getAllByRole('button').map((button) => button.textContent ?? '');
}

afterEach(() => {
  cleanup();
  api.mockReset();
});

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

/* VEN-723: backup withholding, stated in money before the press. */
describe('VendorDetailActions backup withholding (VEN-723)', () => {
  const RESULT = { vendorId: 'x', backupWithholding: null };

  it('states the consequence in money and holds the confirm until the reason and date are given', async () => {
    api.mockResolvedValue(RESULT);
    render(<VendorDetailActions vendor={vendorOf('live', true)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Switch on backup withholding' }));

    const dialog = screen.getByRole('alertdialog');

    expect(dialog.textContent).toContain(
      '24% of each of their payouts is kept for the IRS: on a $1,000 payout, $240 is withheld and $760 is sent.',
    );

    const confirm = screen.getByRole('button', { name: 'Switch on' }) as HTMLButtonElement;

    expect(confirm.disabled).toBe(true);

    fireEvent.click(screen.getByRole('radio', { name: 'IRS notice' }));
    expect(confirm.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Notice date'), { target: { value: '2027-01-20' } });
    expect(confirm.disabled).toBe(false);

    fireEvent.click(confirm);

    await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
    expect(api.mock.calls[0]).toEqual([
      '/admin/vendors/11111111-1111-4111-8111-111111111111/backup-withholding',
      expect.objectContaining({
        method: 'PUT',
        body: { withholding: true, reason: 'irs_notice', noticeDate: '2027-01-20' },
      }),
    ]);
  });

  it('offers both reasons', () => {
    render(<VendorDetailActions vendor={vendorOf('live', true)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch on backup withholding' }));

    expect(screen.getAllByRole('radio').map((radio) => radio.parentElement?.textContent)).toEqual([
      'No taxpayer ID on file',
      'IRS notice',
    ]);
  });

  it('clears only with the date a corrected TIN or certified W-9 was received', async () => {
    api.mockResolvedValue(RESULT);
    const vendor = {
      ...vendorOf('live', true),
      backupWithholding: { reason: 'irs_notice', noticeDate: '2027-01-20' },
    } as Vendor;
    render(<VendorDetailActions vendor={vendor} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear backup withholding' }));

    const confirm = screen.getByRole('button', { name: 'Clear withholding' }) as HTMLButtonElement;

    expect(confirm.disabled).toBe(true);
    expect(screen.getByRole('alertdialog').textContent).toContain(
      'What was already withheld is not returned.',
    );

    fireEvent.change(screen.getByLabelText('Date a corrected TIN or certified W-9 was received'), {
      target: { value: '2027-01-30' },
    });
    fireEvent.click(confirm);

    await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
    expect(api.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ body: { withholding: false, receivedDate: '2027-01-30' } }),
    );
  });

  it('offers a retired vendor no withholding control', () => {
    render(<VendorDetailActions vendor={vendorOf('retired', false)} />);

    expect(screen.queryByRole('button', { name: /backup withholding/i })).toBeNull();
  });
});
