import { cn } from '@/lib/utils';

/**
 * The element loader, in its own module rather than beside the skeletons.
 *
 * The two are different idioms and `40-states.md` forbids showing both on one
 * screen, which `loading-idiom.test.ts` enforces by reading imports. While the
 * spinner lived in `skeleton.tsx`, importing it counted as importing a
 * skeleton — so a component that used only the spinner tripped the very rule
 * it was obeying. Separate files make the import an honest signal.
 */

/**
 * The element spinner. Used inside a control while its own action runs, never
 * alongside a skeleton.
 *
 * The frame's `.spin` is a **complete faint ring with one solid leading
 * quarter** — `2px solid rgba(180,85,47,.28)` with a `clay-400` top — rather
 * than a solid ring with a gap in it. At 16px the two read very differently:
 * the gap version reads as a broken circle, and the faint ring is what makes
 * the leading edge legible as motion.
 */
export function Spinner({ className }: { className?: string }): React.ReactElement {
  return (
    <span
      role="status"
      aria-label="Working"
      className={cn(
        'inline-block size-4 shrink-0 rounded-full border-2 border-clay-400/28 border-t-clay-400',
        // .8s, not Tailwind's 1s default — the frame's own timing.
        'motion-safe:animate-spin motion-safe:[animation-duration:.8s]',
        className,
      )}
    />
  );
}
