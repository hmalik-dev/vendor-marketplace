import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FormSectionNav, type FormSection } from './form-section-nav';

const SECTIONS: FormSection[] = [
  { id: 'business', label: 'Business information', blocks: true },
  { id: 'location', label: 'Location & service area', blocks: false },
  { id: 'tags', label: 'Tags', blocks: false },
];

beforeEach(() => {
  // jsdom has no IntersectionObserver, and the nav observes its sections on mount.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
});

describe('FormSectionNav', () => {
  it('links to each section by id', () => {
    render(<FormSectionNav sections={SECTIONS} />);

    expect(screen.getByRole('link', { name: /Business information/ }).getAttribute('href')).toBe(
      '#business',
    );
    expect(screen.getByRole('link', { name: /Tags/ }).getAttribute('href')).toBe('#tags');
  });

  it('marks only the blocking section with a dot', () => {
    render(<FormSectionNav sections={SECTIONS} />);

    const dots = screen.getAllByLabelText('Still to do');
    expect(dots).toHaveLength(1);
    expect(screen.getByRole('link', { name: /Business information/ }).textContent).toContain(
      'Business information',
    );
  });

  /*
   * The rail carries the legend the dots are read against, not a second count —
   * the submit bar already says how many things are left, and two numbers that
   * can disagree is worse than one.
   */
  it('explains what the gold dots mean while any are showing', () => {
    render(<FormSectionNav sections={SECTIONS} />);

    expect(screen.getByText('Gold dots mark what’s unfinished')).toBeDefined();
  });

  it('marks every blocking section and no others', () => {
    render(<FormSectionNav sections={SECTIONS} />);

    const blocking = SECTIONS.filter((section) => section.blocks);
    expect(screen.getAllByLabelText('Still to do')).toHaveLength(blocking.length);
  });

  it('says so when nothing is blocking', () => {
    render(
      <FormSectionNav sections={SECTIONS.map((section) => ({ ...section, blocks: false }))} />,
    );

    expect(screen.getByText('Everything needed to publish is filled in.')).toBeDefined();
    expect(screen.queryByLabelText('Still to do')).toBeNull();
  });

  it('disconnects its observer on unmount', () => {
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect = disconnect;
      },
    );

    // The observer only attaches when the sections exist in the document.
    for (const section of SECTIONS) {
      const element = document.createElement('section');
      element.id = section.id;
      document.body.append(element);
    }

    const { unmount } = render(<FormSectionNav sections={SECTIONS} />);
    unmount();

    expect(disconnect).toHaveBeenCalled();
  });
});
