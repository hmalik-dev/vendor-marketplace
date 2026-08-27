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

  it('paints the cta variant in terracotta rather than shadcn defaults', () => {
    render(
      <Button variant="cta" size="cta">
        Get started
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Get started' });
    expect(button.className).toContain('bg-primary-400');
    expect(button.className).toContain('hover:bg-primary-500');
    expect(button.className).toContain('active:bg-primary-600');
    // design/design-plan/01-foundations.md sets a 10px radius on buttons (--radius-lg).
    expect(button.className).toContain('rounded-md');
  });

  it('does not fade the cta on hover the way the default variant does', () => {
    render(
      <Button variant="cta" size="cta">
        Get started
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Get started' });
    expect(button.className).not.toContain('hover:bg-primary/80');
  });

  it('forwards disabled state', () => {
    render(<Button disabled>Book now</Button>);

    const button = screen.getByRole('button', { name: 'Book now' });
    expect(button).toHaveProperty('disabled', true);
  });
});
