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
          if (/<Button[^>]*size="icon-sm"/s.test(readFileSync(path, 'utf8'))) {
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
   * Clerk owns its trigger's markup, so the target is grown in CSS. The avatar
   * inside keeps its own size — the control still looks as the frames draw it.
   */
  it('grows Clerk’s user button to the hit area without resizing the avatar', () => {
    const globals = read('src/app/globals.css');
    const rule = globals.match(/\.cl-userButtonTrigger\s*\{([^}]*)\}/);

    expect(rule).not.toBeNull();
    expect(rule?.[1]).toContain('min-h-11');
    expect(rule?.[1]).toContain('min-w-11');
    // Sizing the avatar here would change the frame's visual, not the target.
    expect(globals).not.toMatch(/\.cl-avatarBox\s*\{/);
  });
});
