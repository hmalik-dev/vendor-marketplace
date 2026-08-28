# Vendored display faces

`Instrument Serif` and `Instrument Sans`, the two faces
`design/design-plan/01-foundations.md` defines the type scale in. Both are
SIL Open Font License 1.1, which permits redistribution.

The app itself loads them through `next/font/google`, which handles subsetting
and `font-display`. These copies exist for `next/og`, which renders the share
card and the icons in an isolated Satori context that has no access to the
page's fonts and no font of its own beyond a generic sans.

They are committed rather than fetched at render time on purpose: the share
card is generated during the build and on demand in production, and a card
that silently falls back to the system serif when a network call fails would
fail the parity gate in the one place nobody looks — someone else's Slack.
