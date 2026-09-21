import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * VEN-558: the class-level facts the four framed input screens were found
 * drifting on (frames 12, 04, 09). jsdom has no layout engine, so these pin the
 * source; the rendered result is verified by the 1440x900 browser parity pass.
 */
const read = (path: string): string => readFileSync(join(process.cwd(), 'src', path), 'utf8');

describe('sign-up and sign-in (frame 12)', () => {
  const signUp = read('components/auth/sign-up-form.tsx');
  const signIn = read('components/auth/sign-in-form.tsx');

  it('draws the submit at the frame’s 13px vertical padding', () => {
    expect(signUp).toMatch(/<Button\s+type="submit"\s+className="py-3\.25"/);
    expect(signIn).toMatch(/<Button\s+type="submit"\s+className="py-3\.25"/);
  });

  it('sets the alternate-route line at 13px, not the 14px `text-cta`', () => {
    for (const source of [signUp, signIn]) {
      expect(source).toContain('mt-5 text-center text-action text-stone-700');
      expect(source).not.toContain('mt-5 text-center text-cta');
    }
  });

  it('says the frame’s words for when payment is released', () => {
    const panel = read('components/auth/auth-screen.tsx');
    expect(panel.match(/Payment held until the event is complete/g)).toHaveLength(2);
    expect(panel).not.toContain('until after the event');
  });
});

describe('booking request (frame 04)', () => {
  const screen = read('components/booking/booking-request-screen.tsx');

  it('insets the content 40px at 1440, so the container is no narrower than the viewport', () => {
    expect(screen).toContain('w-full max-w-[1440px] gap-8.5');
    expect(screen).not.toContain('max-w-[1360px]');
  });

  it('sets the subtitle at 14px', () => {
    expect(screen).toContain('mb-5 text-cta leading-prose text-stone-700');
  });

  it('gives the occasion trigger its own focus treatment, so the global halo steps aside', () => {
    expect(screen).toMatch(/data-focus-own\s+aria-haspopup="listbox"/);
  });
});

describe('vendor profile editor (frame 09)', () => {
  it('rounds the drop zone at 14px', () => {
    expect(read('components/image-upload.tsx')).toContain("cn(aspectClassName, 'rounded-[14px]')");
  });

  it('draws the selected category chip with a 1.5px border', () => {
    expect(read('components/category-picker.tsx')).toContain(
      "'border-[1.5px] border-clay-400 bg-clay-100 font-semibold text-clay-600'",
    );
  });

  it('pads the About textarea 10px by 13px', () => {
    expect(read('components/vendor-profile-form.tsx')).toContain(
      'className="mt-1.5 min-h-[140px] bg-stone-0 px-3.25 py-2.5"',
    );
  });

  it('paints the preview rail #F1ECE4 and sets its toggle at 12px', () => {
    const preview = read('components/vendor/storefront-preview.tsx');
    expect(preview).toContain('bg-stone-150 p-5.5 lg:border-l');
    expect(preview).toContain('py-1.5 text-center text-meta');
  });
});
