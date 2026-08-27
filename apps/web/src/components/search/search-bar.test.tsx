import type { Category } from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchBar, type SearchBarValues } from './search-bar';

const CATEGORIES: Category[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Photography',
    slug: 'photography',
    description: 'Portraits, candids, photo booths, and full-day coverage.',
    icon: 'camera',
    displayOrder: 1,
    isActive: true,
  },
];

const EMPTY: SearchBarValues = { category: '', city: '', date: '' };

function renderBar(value: SearchBarValues = EMPTY) {
  return render(<SearchBar categories={CATEGORIES} value={value} onSubmit={vi.fn()} size="hero" />);
}

describe('SearchBar', () => {
  afterEach(() => {
    cleanup();
  });

  it('labels its three segments exactly as the frames do', () => {
    renderBar();

    expect(screen.getByRole('button', { name: 'Vendor type' })).toBeDefined();
    expect(screen.getByText('City')).toBeDefined();
    expect(screen.getByText('Event date')).toBeDefined();
  });

  it('prompts "Add a date" while the date is empty, never the browser default', () => {
    renderBar();

    // A date input has no placeholder, so the prompt is laid over the native
    // editor — see design/design-plan/10-landing.md.
    expect(screen.getByText('Add a date')).toBeDefined();
  });

  it('drops the prompt once a date has been chosen', () => {
    renderBar({ ...EMPTY, date: '2026-06-14' });

    expect(screen.queryByText('Add a date')).toBeNull();
  });

  it('offers no free-text query field — the first segment is a picker', () => {
    renderBar();

    // City is the only text box on the bar; vendor type is a select.
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });
});
