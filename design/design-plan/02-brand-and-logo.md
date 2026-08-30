# 02 — Brand & Logo

## The mark

Two circles of equal diameter. The right one is offset by 45% of that diameter,
so they overlap by the remaining 55% and the whole mark spans 1.45 D.
Left circle: solid clay fill. Right circle: ink stroke at 8% of diameter, no fill.

It reads as **an introduction** — two parties meeting — which is the product in
one glyph. There is no letterform in it, which is deliberate: **the mark carries
any name.** Verified at 1, 2, 3 syllables (Wren, Orla, Pomona) with no change to
the construction.

```
diameter          D
offset            0.45 D  (left edge of the right circle sits at 0.45 D)
stroke            0.08 D
total mark width  1.45 D
wordmark gap      0.50 D from the right circle's right edge
wordmark size     1.60 D, Instrument Serif, ink
```

## Sizes

| Context                    | D         | Mark width | Wordmark |
| -------------------------- | --------- | ---------- | -------- |
| Desktop header             | 15px      | 22px       | 24px     |
| Mobile header              | 14px      | 20px       | 21px     |
| Auth panel                 | 19px      | 28px       | 29px     |
| Marketing footer           | 20px      | 29px       | 32px     |
| App icon (52px tile, r=12) | 24px      | 35px       | —        |
| Favicon 32 / 16            | 16 / 14px | 23 / 20px  | —        |

The favicon and the app icon ask for the mark alone (`variant="mark"`), where
the wordmark would be illegible. That is the caller's choice, not an automatic
size cutoff — the desktop header sets D=15 and still shows the wordmark, as
frame `01 Landing` renders it.

## Colourways

| Ground            | Fill circle | Stroke circle | Wordmark    |
| ----------------- | ----------- | ------------- | ----------- |
| Cream / white     | `clay-400`  | `stone-900`   | `stone-900` |
| Ink (`stone-900`) | `clay-400`  | `stone-50`    | `stone-50`  |
| Single colour     | `stone-900` | `stone-900`   | `stone-900` |

The single-colour version keeps the fill/stroke contrast, so it survives
embroidery, one-colour print and a stamp.

Clear space on all sides = 0.5 D. Never recolour the fill to sage or gold, never
add a third circle, never set the wordmark in anything but Instrument Serif.

## Component

```tsx
// apps/web/src/components/brand/logo.tsx
type LogoProps = { size?: number; variant?: 'full' | 'mark'; tone?: 'light' | 'dark' | 'mono' };
```

`size` is D in px; everything else derives from it. The wordmark text comes from
`BRAND_NAME` — see `00-README.md`. No component may render the brand name from a
literal.

**Seventeen frames hardcode the wordmark — recorded 2026-08-30 (#292 via #306).**
Twenty-four frames render `{{ brandName }}`; seventeen render the literal `Orla`.
The split is clean by frame family rather than random: every primary 1440 screen
(`01`–`13`) uses the token, while every state frame (`15`–`25`), every `27` frame
except the three vendor-profile ones, and `28 Dropdown open — hero` use the
literal. So this is one habit in the source design project, not seventeen slips.

**Nothing is edited here.** `Orla - Screens.dc.html` stays byte-identical to the
export so the next import diffs cleanly; the divergence is recorded against the
source design project. **The code law is unchanged and was never at risk** — the
app reads `BRAND_NAME` and no component renders the name from a literal. A parity
pass comparing a wordmark against one of those seventeen frames is comparing
against a hardcode, and should read the token.

## Voice of the name

Whatever it lands on, the register is **a person or a place you'd be introduced
to** — warm, short, sayable on the phone. Not "-ify", not "Hub", not a compound
of _event_ + _thing_. Candidates explored: Orla, Junia, Wren, Pomona, Marlowe,
Rowan, Halcyon, Vesper.
