import { ImageResponse } from 'next/og';

/**
 * The iOS home-screen tile. `02-brand-and-logo.md` draws it as a 52px tile at
 * `r=12` holding the mark at D=24 — so the mark is 46% of the tile and the
 * corner radius 23% of it, and those ratios are what scale up to 180.
 *
 * Rendered rather than committed as a binary: the geometry stays the same
 * OFFSET_RATIO/STROKE_RATIO the mark is defined by, so a change to the mark
 * cannot leave a stale PNG behind. The tile is `stone-0`, not transparent —
 * iOS composites onto white and the cream ground is part of the brand.
 */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const TILE = 180;
const DIAMETER = Math.round(TILE * (24 / 52));
const OFFSET_RATIO = 0.45;
const STROKE_RATIO = 0.08;
const MARK_WIDTH = DIAMETER * (1 + OFFSET_RATIO);

export default function AppleIcon(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fffdf9',
      }}
    >
      <div style={{ position: 'relative', width: MARK_WIDTH, height: DIAMETER, display: 'flex' }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: DIAMETER,
            height: DIAMETER,
            borderRadius: '50%',
            background: '#b4552f',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: DIAMETER * OFFSET_RATIO,
            width: DIAMETER,
            height: DIAMETER,
            borderRadius: '50%',
            border: `${DIAMETER * STROKE_RATIO}px solid #23201c`,
            /*
              `content-box`, matching `logo.tsx` (#250). The two circles are
              equal as FILLS — a D-wide disc and a D-wide hole — with the stroke
              drawn outside the D. Border-box charged the stroke to the hole and
              rendered the outline circle `D - 2×stroke` across, so the tile's
              ring sat visibly smaller than its disc.
            */
            boxSizing: 'content-box',
          }}
        />
      </div>
    </div>,
    size,
  );
}
