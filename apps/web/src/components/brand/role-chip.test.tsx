import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoleChip } from './role-chip';

/*
 * The frame is the acceptance criterion, so every expected value below is read
 * out of it at test time. Duplicating the literals here would let the component
 * and the contract drift apart without a single test going red.
 *
 * Found by suffix rather than by name: `brand-literals.test.ts` forbids the
 * product name in this tree, and the bundle carries it.
 */
const designDirectory = join(process.cwd(), '../../design');
const framesFile = readdirSync(designDirectory).filter((entry) =>
  entry.endsWith('Screens.dc.html'),
);

if (framesFile.length !== 1) {
  throw new Error(`Expected exactly one screens frame file in design/, found ${framesFile.length}`);
}

const frames = readFileSync(join(designDirectory, framesFile[0] as string), 'utf8');

/**
 * The chip as the frames draw it. Matched on the sage pair rather than on the
 * word, so the regex cannot pass by finding some other chip that happens to
 * say the same thing.
 */
const CHIP =
  /<span style="([^"]*letter-spacing:\.06em[^"]*background:#EDF0E9[^"]*)">([^<]+)<\/span>/i;

describe('the vendor role chip matches the frame', () => {
  const match = frames.match(CHIP);

  it('the frame declares the chip this test measures against', () => {
    expect(match).not.toBeNull();
  });

  it('renders the frame’s own literal', () => {
    const literal = (match?.[2] ?? '').trim();

    // Guards the guard: an empty capture would make the assertion vacuous.
    expect(literal.length).toBeGreaterThan(0);

    render(<RoleChip label={literal} />);

    // `getByText` throws when the node is absent, so reading it back is the
    // assertion; comparing the text keeps the failure message useful.
    expect(screen.getByText(literal).textContent).toBe(literal);
  });

  it.each([
    ['font-size', /font-size:([\d.]+)px/, 'text-[11px]'],
    ['letter-spacing', /letter-spacing:(\.?[\d.]+)em/, 'tracking-[0.06em]'],
    ['border-radius', /border-radius:([\d.]+)px/, 'rounded-[5px]'],
  ])('carries the frame’s %s', (_name, pattern, utility) => {
    const style = match?.[1] ?? '';
    const declared = style.match(pattern);

    expect(declared).not.toBeNull();

    // The utility encodes the frame's number, so assert the number is the one
    // the frame states rather than trusting the class name to stay honest.
    const value = declared?.[1] ?? '';
    expect(utility).toContain(value);

    render(<RoleChip label="Vendor" />);
    expect(screen.getByText('Vendor').className).toContain(utility);
  });

  it('carries the frame’s font-weight', () => {
    // Tailwind's `font-semibold` *is* 600, so the frame's number is asserted
    // here rather than pattern-matched against a class name that hides it.
    expect(match?.[1] ?? '').toContain('font-weight:600');

    render(<RoleChip label="Vendor" />);
    expect(screen.getByText('Vendor').className).toContain('font-semibold');
  });

  it('uses the frame’s sage pair, by token rather than by hex', () => {
    const style = match?.[1] ?? '';

    expect(style).toContain('background:#EDF0E9');
    expect(style).toContain('color:#4B5940');

    render(<RoleChip label="Vendor" />);
    const className = screen.getByText('Vendor').className;

    // `--color-sage-50` is #edf0e9 and `--color-sage-600` is #4b5940 in
    // `theme.css`; the chip names the tokens so a palette change reaches it.
    expect(className).toContain('bg-sage-50');
    expect(className).toContain('text-sage-600');
  });

  it('is uppercase, as the frame sets it', () => {
    expect(match?.[1] ?? '').toContain('text-transform:uppercase');

    render(<RoleChip label="Vendor" />);
    expect(screen.getByText('Vendor').className).toContain('uppercase');
  });
});
