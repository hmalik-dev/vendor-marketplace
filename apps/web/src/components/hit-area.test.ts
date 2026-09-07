import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Frame `08/09/11 shared`, Access axis.
 *
 * `04-laws.md`: "Icon-only controls carry `aria-label` and a 44×44 hit area."
 * The label half already passed everywhere — every control the sweep found
 * carried one. The size half did not: 28x28, 36x36, 36x36, 36x36.
 *
 * jsdom has no layout, so this cannot measure a rendered box. It guards the
 * thing that decided the box instead: the size utility. The browser check is
 * the real gate and stays manual until the Playwright harness lands (#14).
 */
const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

/** 44px on Tailwind's 4px scale. */
const HIT_AREA = 'size-11';

/**
 * The law's own number, read from the plan rather than restated here, so the
 * two cannot drift.
 */
const LAWS = readFileSync(join(process.cwd(), '../../design/design-plan/04-laws.md'), 'utf8');

describe('icon-only controls carry the law’s hit area', () => {
  it('the plan states the hit area this test enforces', () => {
    const stated = LAWS.match(/(\d+)×(\d+) hit area/);

    expect(stated).not.toBeNull();
    expect(Number(stated?.[1])).toBe(44);
    expect(Number(stated?.[2])).toBe(44);

    // Tailwind's scale is 4px per step, so 44px is step 11.
    expect(HIT_AREA).toBe(`size-${Number(stated?.[1]) / 4}`);
  });

  it('gives the button’s icon size the full hit area', () => {
    const button = read('src/components/ui/button.tsx');

    expect(button).toContain(`icon: '${HIT_AREA}'`);
  });

  /*
   * The 36px `icon-sm` variant is gone rather than resized. Every one of its
   * three callers was an icon-only control, so it could only ever produce a
   * violation — keeping the name would leave that trap in place.
   */
  it('offers no icon size that cannot satisfy the law', () => {
    const button = read('src/components/ui/button.tsx');
    const sizes = button.match(/^\s*'?icon[\w-]*'?:\s*'([^']+)'/gm) ?? [];

    expect(sizes).toHaveLength(1);
    expect(button).not.toMatch(/'icon-sm':\s*'size-\d+'/);
  });

  it('leaves no caller asking for the retired size', () => {
    const components = join(process.cwd(), 'src/components');
    const offenders: string[] = [];

    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);

        if (entry.isDirectory()) {
          walk(path);
        } else if (entry.name.endsWith('.tsx')) {
          // `input-group.tsx` has an unrelated variant of the same name; this
          // is about what callers pass to `Button`.
          // No dotAll flag: `[^>]*` already spans newlines, and `s` needs a
          // lib target this package does not set.
          if (/<Button[^>]*size="icon-sm"/.test(readFileSync(path, 'utf8'))) {
            offenders.push(path);
          }
        }
      }
    };

    walk(components);
    expect(offenders).toEqual([]);
  });

  it('gives the notifications bell the full hit area', () => {
    const bell = read('src/components/messaging/notification-bell.tsx');

    expect(bell).toContain(`flex ${HIT_AREA} items-center`);
    // The label half of the law, which was already passing.
    expect(bell).toContain('aria-label=');
  });

  /*
   * #441. The footer's brand link wraps `Logo`, which is `role="img"` with an
   * `aria-label` — so its accessible name comes from a label and not from text,
   * which is what makes the law's "icon-only" clause reach it. At the frame's
   * D=17 the lockup is 27px tall, well under the floor.
   *
   * Grown the way Clerk's trigger is: the target changes and the mark does not.
   *
   * Only the floor is asserted. How this markup pays for it — an inline flex, a
   * negative margin that keeps the tagline where the frame draws it — is the
   * call site's business, and pinning it here would fail any other correct way
   * of reaching 44px under a test named for the law.
   */
  it('gives the footer brand link the law’s hit area', () => {
    const footer = read('src/components/site-footer.tsx');
    // Attribute order is the file's, not the law's, so it is not matched on.
    const link = /<Link\b[^>]*href="\/"[^>]*>/.exec(footer);

    expect(link, 'the footer no longer opens its brand link the way this reads it').not.toBeNull();

    /*
     * Both halves. The wordmark makes this link ~83px wide today, so the width
     * floor changes nothing it renders — which is exactly why it was easy to
     * leave off, and why the guard would have stayed green through a switch to
     * `variant="mark"` that took the target to 27x44.
     */
    for (const axis of ['min-h-', 'min-w-']) {
      expect(link?.[0]).toContain(HIT_AREA.replace('size-', axis));
    }
  });

  /*
   * Clerk owns its trigger's markup, so the target is grown in CSS. The avatar
   * inside keeps its own size — the control still looks as the frames draw it.
   */
  it('grows Clerk’s user button to the hit area without resizing the avatar', () => {
    const globals = read('src/app/globals.css');
    const rule = globals.match(/\.cl-userButtonTrigger\s*\{([^}]*)\}/);

    expect(rule).not.toBeNull();
    expect(rule?.[1]).toContain('min-h-11');
    expect(rule?.[1]).toContain('min-w-11');

    /*
     * Only the target grows. `globals.css` does style `.cl-avatarBox`
     * elsewhere, so this cannot assert the selector's absence — it asserts
     * that no rule reaching the avatar sets a width or height, which is the
     * thing that would change the frame's visual rather than the hit area.
     */
    for (const [, body] of globals.matchAll(/\.cl-avatarBox[^{]*\{([^}]*)\}/g)) {
      expect(body).not.toMatch(/(?:^|[\s;])(?:min-)?[wh]-\d/);
      expect(body).not.toMatch(/(?:width|height)\s*:/);
      expect(body).not.toMatch(/\bsize-\d/);
    }
  });
});
