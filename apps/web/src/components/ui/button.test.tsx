import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders an accessible button by default', () => {
    render(<Button>Send a message</Button>);

    const button = screen.getByRole('button', { name: 'Send a message' });
    expect(button.tagName).toBe('BUTTON');
  });

  it('defaults to the primary variant, so the screen has one obvious action', () => {
    render(<Button>Request booking</Button>);

    const button = screen.getByRole('button', { name: 'Request booking' });
    expect(button.dataset.variant).toBe('primary');
    expect(button.className).toContain('bg-clay-400');
  });

  it('paints primary with clay as a fill and white text, never clay as text', () => {
    render(<Button variant="primary">Save changes</Button>);

    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button.className).toContain('bg-clay-400');
    expect(button.className).toContain('text-stone-0');
    expect(button.className).toContain('hover:bg-clay-500');
    expect(button.className).toContain('active:bg-clay-600');
    // design/design-plan/01-foundations.md puts buttons on --radius-lg (10px).
    expect(button.className).toContain('rounded-lg');
  });

  it('gives secondary a stone border on a stone-0 fill', () => {
    render(<Button variant="secondary">Keep booking</Button>);

    const button = screen.getByRole('button', { name: 'Keep booking' });
    expect(button.className).toContain('bg-stone-0');
    expect(button.className).toContain('border-stone-300');
    expect(button.className).toContain('text-stone-900');
  });

  it('gives ghost clay-as-text with no fill and no border', () => {
    render(<Button variant="ghost">View all</Button>);

    const button = screen.getByRole('button', { name: 'View all' });
    expect(button.className).toContain('text-clay-500');
    expect(button.className).not.toContain('bg-clay-400');
    expect(button.className).not.toContain('border-stone-300');
  });

  it('gives ink a full-round ink fill, for the marketing header only', () => {
    render(<Button variant="ink">Join as a vendor</Button>);

    const button = screen.getByRole('button', { name: 'Join as a vendor' });
    expect(button.className).toContain('bg-stone-900');
    expect(button.className).toContain('text-stone-50');
    expect(button.className).toContain('rounded-full');
    // 18px, not the 20px the default size gives every other button.
    expect(button.className).toContain('px-4.5');
    expect(button.className).not.toContain('px-5');
  });

  it('paints destructive in error rather than in clay', () => {
    render(<Button variant="destructive">Yes, cancel booking</Button>);

    const button = screen.getByRole('button', { name: 'Yes, cancel booking' });
    expect(button.className).toContain('bg-error-500');
    expect(button.className).not.toContain('bg-clay-400');
  });

  it('focuses to the warm clay glow, never the browser default', () => {
    render(<Button>Send request</Button>);

    const button = screen.getByRole('button', { name: 'Send request' });
    expect(button.className).toContain('focus-visible:ring-clay-400/30');
    expect(button.className).toContain('focus-visible:ring-offset-2');
    expect(button.className).toContain('outline-none');
  });

  it('keeps the scale transforms behind motion-safe so reduced motion drops them', () => {
    render(<Button>Send request</Button>);

    const button = screen.getByRole('button', { name: 'Send request' });
    expect(button.className).toContain('motion-safe:hover:scale-[1.02]');
    expect(button.className).toContain('motion-safe:active:scale-[.98]');
    // The colour change carries the state, so it must not be gated on motion.
    expect(button.className).toContain('hover:bg-clay-500');
  });

  it('forwards disabled state', () => {
    render(<Button disabled>Book now</Button>);

    const button = screen.getByRole('button', { name: 'Book now' });
    expect(button).toHaveProperty('disabled', true);
  });
});
