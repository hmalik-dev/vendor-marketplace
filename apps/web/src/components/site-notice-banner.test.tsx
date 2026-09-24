import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DISMISSED_NOTICE_KEY, SiteNoticeBanner } from './site-notice-banner';

const MESSAGE = 'Payouts are delayed today. Nothing is lost.';

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SiteNoticeBanner', () => {
  it('is a status region for an info notice', () => {
    render(<SiteNoticeBanner message={MESSAGE} tone="info" />);

    expect(screen.getByRole('status').textContent).toContain(MESSAGE);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('is an alert for a warning notice', () => {
    render(<SiteNoticeBanner message={MESSAGE} tone="warning" />);

    expect(screen.getByRole('alert').textContent).toContain(MESSAGE);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders markup as text, never as elements', () => {
    render(<SiteNoticeBanner message="<b>down</b>" tone="info" />);

    expect(screen.getByRole('status').textContent).toContain('<b>down</b>');
    expect(screen.getByRole('status').querySelector('b')).toBeNull();
  });

  it('hides for the rest of the session once dismissed with its button', () => {
    const first = render(<SiteNoticeBanner message={MESSAGE} tone="info" />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(window.sessionStorage.getItem(DISMISSED_NOTICE_KEY)).toBe(`info:${MESSAGE}`);

    first.unmount();
    render(<SiteNoticeBanner message={MESSAGE} tone="info" />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows again when the admin posts different words, or raises the tone', () => {
    window.sessionStorage.setItem(DISMISSED_NOTICE_KEY, 'info:An older notice');
    const first = render(<SiteNoticeBanner message={MESSAGE} tone="info" />);
    expect(screen.getByRole('status').textContent).toContain(MESSAGE);
    first.unmount();

    window.sessionStorage.setItem(DISMISSED_NOTICE_KEY, `info:${MESSAGE}`);
    render(<SiteNoticeBanner message={MESSAGE} tone="warning" />);
    expect(screen.getByRole('alert').textContent).toContain(MESSAGE);
  });

  it('draws nothing on the server, so a dismissed notice never flashes on reload', () => {
    expect(renderToString(<SiteNoticeBanner message={MESSAGE} tone="warning" />)).toBe('');
  });

  it('still dismisses for this page view when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<SiteNoticeBanner message={MESSAGE} tone="warning" />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
