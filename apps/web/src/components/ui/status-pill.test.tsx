import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StatusPill, STATUS_TONES, type StatusTone } from './status-pill';

describe('StatusPill', () => {
  afterEach(() => {
    cleanup();
  });

  it('covers the seven-status vocabulary and nothing more', () => {
    expect(Object.keys(STATUS_TONES)).toEqual([
      'pending',
      'quoted',
      'needsYou',
      'confirmed',
      'completed',
      'inert',
      'failed',
    ]);
  });

  it.each([
    ['pending', 'bg-gold-50', 'text-gold-600'],
    ['quoted', 'bg-steel-50', 'text-steel-600'],
    ['needsYou', 'bg-clay-100', 'text-clay-600'],
    ['confirmed', 'bg-sage-50', 'text-sage-600'],
    ['completed', 'bg-sage-100', 'text-sage-600'],
    ['inert', 'bg-stone-200', 'text-stone-600'],
    ['failed', 'bg-error-50', 'text-error-500'],
  ] as ReadonlyArray<[StatusTone, string, string]>)(
    'paints %s on %s with %s',
    (tone, background, text) => {
      render(<StatusPill tone={tone}>Status</StatusPill>);

      const pill = screen.getByText('Status');
      expect(pill.className).toContain(background);
      expect(pill.className).toContain(text);
      cleanup();
    },
  );

  it('always carries its text, so status is never colour alone', () => {
    render(<StatusPill tone="confirmed">Confirmed</StatusPill>);

    expect(screen.getByText('Confirmed').textContent).toBe('Confirmed');
  });

  it('spends clay only on the status that is waiting on this user', () => {
    const clayTones = Object.entries(STATUS_TONES).filter(([, classes]) =>
      classes.includes('clay'),
    );

    expect(clayTones.map(([tone]) => tone)).toEqual(['needsYou']);
  });
});
