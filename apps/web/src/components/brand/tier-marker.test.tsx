import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TierMarker, tierMarkerLabel } from './tier-marker';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('tierMarkerLabel', () => {
  it('names staging', () => {
    expect(tierMarkerLabel('staging')).toBe('Staging');
  });

  it.each(['production', 'local', '', undefined])('draws nothing for %s', (tier) => {
    expect(tierMarkerLabel(tier)).toBeNull();
  });
});

describe('TierMarker', () => {
  it('draws "Staging" on a staging build', () => {
    vi.stubEnv('NEXT_PUBLIC_DEPLOY_ENV', 'staging');

    render(<TierMarker />);

    expect(screen.getByTestId('tier-marker').textContent).toBe('Staging');
  });

  it('draws nothing on a production build', () => {
    vi.stubEnv('NEXT_PUBLIC_DEPLOY_ENV', 'production');

    const { container } = render(<TierMarker />);

    expect(container.innerHTML).toBe('');
  });

  it('inverts on the dark console header so it stays legible', () => {
    vi.stubEnv('NEXT_PUBLIC_DEPLOY_ENV', 'staging');

    render(<TierMarker tone="dark" />);

    const classes = screen.getByTestId('tier-marker').className.split(/\s+/);
    expect(classes).toContain('bg-stone-0');
    expect(classes).toContain('text-stone-900');
    expect(classes).not.toContain('bg-stone-900');
  });
});
