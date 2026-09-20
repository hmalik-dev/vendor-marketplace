---
name: review-checklist-srcset-x-descriptor-shrinks-unsized-images
description: Adding srcSet with 1x/2x descriptors to an <img> that has no definite CSS box changes its rendered size, and the 2x candidate shrinks it further when the source cannot be upscaled
metadata:
  type: feedback
---

An `<img>` given `srcSet="…w=A 1x, …w=B 2x"` no longer lays out at the source's
pixel size: the used intrinsic size is **the chosen candidate's real pixel width
divided by its density descriptor**. Two consequences, both invisible in jsdom:

- At DPR 1 the browser takes the `1x` candidate, so the image can render no
  wider than `A`. Where `A` is smaller than the box the old raw `src` filled,
  the image shrinks.
- At DPR 2 it takes the `2x` candidate — and the optimizer **never upscales**,
  so if the stored original is 1600px and `B` is 3840, the response is 1600px
  and the CSS intrinsic width is 1600/2 = **800**. The higher-density candidate
  renders _smaller_ than the low one.

**Why:** VEN-456 routed every `FallbackImage` through `/_next/image`. Nine of
ten call sites pin both axes in CSS (`size-full`, `size-14.5`, `aspect-[4/3]
w-full`) and are unaffected; `w-full` alone is also safe because density
division preserves the ratio. The tenth — the portfolio lightbox,
`max-h-full max-w-full object-contain` with no width — took its whole size from
the intrinsic dimensions and shrank from 1278x852 to 1080x720 (DPR 1) / 800x533
(DPR 2).

**How to apply:** when a diff adds `srcSet`/`sizes` to an existing `<img>`, walk
every call site and sort them into _both axes definite_ (safe), _one axis
definite_ (safe, ratio-preserving) and _neither_ (a resize). For the last group,
work the arithmetic through the **upload pipeline's max edge**
(`MAIN_IMAGE_MAX_EDGE`), not through an imagined original — the no-upscale rule
is what makes the 2x candidate the worst case. And note where the rewrite is
gated on an **https** base: with a plain-http local storage host nothing is
rewritten, so the local browser and parity passes are blind to all of it.
Related: [[review-checklist-derived-src-flips-after-commit]].
