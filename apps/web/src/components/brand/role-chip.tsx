/**
 * The role chip that sits beside the wordmark on every vendor screen — frames
 * `08`, `09`, `10` and `11` all draw it, which is what makes it part of the
 * shared chrome rather than one screen's decoration.
 *
 * It tells a vendor which side of the marketplace they are looking at. The
 * same person can hold a customer account, and the two dashboards share a
 * header; without this the only difference is the nav labels.
 *
 * Every value here is read off the frame: 11px/600 uppercase at .06em on
 * `sage-50`, `sage-600` text, 4px/8px padding, 5px radius. The type scale has
 * no 11px step — `--text-label` is 10.5px and `--text-helper` 11.5px (#198) —
 * so the size is written literally rather than forced into a neighbouring
 * token.
 *
 * `leading-[normal]` is load-bearing. The frame declares no line-height, so
 * its 11px text takes the browser's normal leading — about 14px — and the chip
 * measures 22px tall inside its 4px padding. The app's inherited 1.5 makes
 * that 16.5px and the chip 24.5px; `leading-none` overshoots the other way at
 * 19px. Only `normal` reproduces the frame.
 */
export function RoleChip({ label }: { label: string }): React.ReactElement {
  return (
    <span className="ml-1 rounded-[5px] bg-sage-50 px-2 py-1 text-[11px] leading-[normal] font-semibold tracking-[0.06em] text-sage-600 uppercase">
      {label}
    </span>
  );
}
