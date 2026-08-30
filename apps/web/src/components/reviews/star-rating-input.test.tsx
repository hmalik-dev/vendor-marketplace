import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { StarRatingInput } from './star-rating-input';

/** Wires the controlled component up with real state, the way a form would. */
function Controlled(): React.ReactElement {
  const [value, setValue] = useState<number | null>(null);
  return <StarRatingInput name="rating" value={value} onChange={setValue} label="Your rating" />;
}

describe('StarRatingInput', () => {
  afterEach(() => {
    cleanup();
  });

  it('is a radio group, not a row of buttons', () => {
    render(<Controlled />);

    // A fieldset/legend group, exposed as `group` with the legend as its name.
    expect(screen.getByRole('group', { name: 'Your rating' })).toBeTruthy();

    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios).toHaveLength(5);
    // Every star shares one `name`, which is what makes them one radio group
    // rather than five independent controls.
    for (const radio of radios) {
      expect(radio.type).toBe('radio');
      expect(radio.name).toBe('rating');
    }

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('gives each star an accessible name naming its rating, not the glyph', () => {
    render(<Controlled />);

    expect(screen.getByRole('radio', { name: 'one star' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'two stars' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'five stars' })).toBeTruthy();
  });

  it('selects a rating on click and reflects it as the checked radio', async () => {
    const user = userEvent.setup();
    render(<Controlled />);

    await user.click(screen.getByRole('radio', { name: 'four stars' }));

    expect((screen.getByRole('radio', { name: 'four stars' }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect((screen.getByRole('radio', { name: 'one star' }) as HTMLInputElement).checked).toBe(
      false,
    );
  });

  it('is keyboard operable: Tab enters the group once, arrow keys move the selection', async () => {
    const user = userEvent.setup();
    render(<Controlled />);

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'one star' }));

    await user.keyboard('{ArrowRight}');
    const twoStars = screen.getByRole('radio', { name: 'two stars' }) as HTMLInputElement;
    expect(document.activeElement).toBe(twoStars);
    expect(twoStars.checked).toBe(true);
  });

  it('disables every star when disabled', () => {
    render(
      <StarRatingInput
        name="rating"
        value={null}
        onChange={() => {}}
        label="Your rating"
        disabled
      />,
    );

    for (const radio of screen.getAllByRole('radio') as HTMLInputElement[]) {
      expect(radio.disabled).toBe(true);
    }
  });
});
