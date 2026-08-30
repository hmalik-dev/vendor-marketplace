# 17 — Vendor profile editor (`/profile/edit`) — **MVP**

**Purpose:** the vendor's first real experience of the product and the surface
they return to most. It's a form, but it's also the pitch — setting up a
storefront, not filing a tax return.
**Shell:** `app-shell`. Section nav 200px + form pane + sticky submit bar.
**Scroll budget:** ≤ 1.5×.

## Section nav

Business · Location · Tags · Response time · Packages · Portfolio · Payouts.
A **gold dot** marks any section holding an unmet publish requirement, and the
legend sits at the bottom: "Gold dots block publishing." The same blocker appears
in three places — the field, the nav, and the submit bar — so the vendor can see
_what_ and _where_ without scrolling.

## Form pane — ordered by consequence

Title "Your storefront" with the framing line: "This is what a customer sees
before they decide to message you."

**1. Media row, first.** Profile photo (128px circle, dashed `stone-400` border)
and **cover photo** (216×144 drop zone, 3:2) side by side. No instructional copy
— the drop zone says "Drop a photo or browse · landscape · 1200×800 or larger"
and the preview rail does the rest of the teaching.

The cover field used to ask for `21:9, 1600×686 min` — a spec nobody shoots,
stated as arithmetic, aimed at people who are photographers rather than croppers.
It now asks for one landscape photo, and a vendor sees the result rather than
reading a promise about it.

## Preview rail — 308px, its own surface

The card preview does **not** live in the form. An earlier version put it in the
media row as a third column, where it read as a third input and asserted a
business name _above_ the field where that name is typed.

It is a **308px rail** on the right edge of the editor, `stone-100` with a
`stone-300` left border, holding: a mono `PREVIEW` label with "Updates as you
type", an **In search / Your profile** segmented toggle, the vendor's real card
at full size, and one line of explanation. No link out — `Preview` in the sticky
submit bar already goes there, and a second route to the same place from a panel
that _is_ the preview is noise. That makes it what it actually is — a mirror of the whole form rather
than a step in it — and the toggle shows both placements of the single photo.

**One cover, two placements** — see `12-vendor-profile.md`. There is no separate
profile banner field and there must never be one; a second image field is a
second thing to get wrong, and the whole point of the fixed 3:2 is that the card
and the profile header are the same file.

**2.** Business name + Profile link on one row; the slug preview renders live
under its field as `{BRAND_DOMAIN}/kessler-co`.

**3.** About your business — full width, min-height 62px, real placeholder copy.

**4.** Categories — full width, multi-select as **icon chips**: the lucide glyph
in a `clay-100` circle plus the name. Selected fills `clay-100` with a 1.5px
`clay-400` border. Category identity is visual everywhere else in the product;
this is where a vendor first meets it.

**5. Location before tags.** Where a vendor works decides whether they're ever
seen — a harder, more consequential answer than a taste tag. Address full width;
City + State one row; **Service radius in miles** as a slider (5–125, 5-mile
steps, value in the label) beside **Typical response time**.

Radius is stored as `service_radius_km` and converted at the display boundary.
Miles at every boundary — slider, label, profile, search.

**6.** Tags — languages, cultural, dietary as three peer multi-selects on one row.
Options in seed `displayOrder`, never alphabetical. Each keeps its "Don't see
yours?" suggestion flow, deduped on submit.

## Sticky submit bar

Left: blocker summary with a gold dot — "**2 things** left before you can publish
— response time and payouts". Right: save state ("Saved 30 seconds ago"),
Preview, and **Save changes**.

Explicit save, not autosave. The bar reflects unsaved changes so the vendor can
leave knowingly. Inline "Saved" fades after 2s.

## Acceptance

- [ ] Media pair on one row; the photo is first
- [ ] Publish blockers visible in field, nav and submit bar simultaneously
- [ ] The helper line explaining a blocker is never clipped — this pane must fit or scroll, never slice
- [ ] Radius displays miles and stores km
- [ ] Tag order matches seed `displayOrder` on every surface
- [ ] ≤ 1.5 viewports; submit bar always visible

## Post-MVP

- AI-assisted bio drafting from a few prompts
- Portfolio bulk upload with auto-crop
- Package duplication across categories
- Profile completeness scoring beyond the binary publish gate
