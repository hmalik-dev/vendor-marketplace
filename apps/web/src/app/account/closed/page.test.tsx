import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import AccountClosedPage from './page';

describe('AccountClosedPage (VEN-680)', () => {
  afterEach(cleanup);

  it('says the account is closed, needs no session, and leads home', () => {
    render(<AccountClosedPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Your account is closed' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Back to the home page' }).getAttribute('href')).toBe(
      '/',
    );
  });
});
