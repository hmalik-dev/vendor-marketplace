import { BRAND_NAME, BRAND_TAGLINE } from '@vendor-marketplace/shared';
import { ImageResponse } from 'next/og';
import { shareCardFonts } from './_fonts/load';

/**
 * The share card. A marketplace whose referral path is "someone sends you a
 * link" cannot render a blank rectangle in Slack, iMessage and every preview
 * that follows.
 *
 * Rendered from the same mark geometry as `icon` and `apple-icon` rather than
 * committed as a binary, so a change to `02-brand-and-logo.md` cannot leave a
 * stale PNG behind. No photography: the stock imagery on the landing page is
 * licensed for the site, and a card is a different surface.
 */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = `${BRAND_NAME} — ${BRAND_TAGLINE}`;

/** The mark, at the ratios `02-brand-and-logo.md` defines it by. */
const DIAMETER = 96;
const OFFSET_RATIO = 0.45;
const STROKE_RATIO = 0.08;

export default async function OpengraphImage(): Promise<ImageResponse> {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        // The cream ground, never pure white — `01-foundations.md`.
        background: '#fffdf9',
        padding: '0 96px',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: DIAMETER * (1 + OFFSET_RATIO),
          height: DIAMETER,
          display: 'flex',
        }}
      >
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
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/*
          The product's one flourish, as the hero draws it: a plain first line
          in ink over a clay second line carrying the promise. `next/og` has no
          Instrument Serif unless it is fetched and embedded, which a build
          should not depend on a network for — so the card uses the system
          own approved words. Instrument Serif is passed in as bytes below —
          Satori renders in its own context with no access to the page's fonts,
          and the system serif would fail the parity gate's font axis in the
          one place nobody checks: somebody else's Slack.
        */}
      <div
        style={{
          marginTop: 56,
          fontSize: 76,
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          color: '#23201c',
          fontFamily: 'Instrument Serif',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <span>Book your vendors</span>
        <span style={{ color: '#b4552f', fontStyle: 'italic' }}>without the back-and-forth.</span>
      </div>

      <div
        style={{
          marginTop: 40,
          fontSize: 30,
          color: '#4a443c',
          fontFamily: 'Instrument Sans',
          display: 'flex',
        }}
      >
        {BRAND_NAME} · {BRAND_TAGLINE}
      </div>
    </div>,
    { ...size, fonts: await shareCardFonts() },
  );
}
