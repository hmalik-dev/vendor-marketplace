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

**1. Media pair, first row.** Profile photo (128px circle, dashed `stone-400`
border) and cover image (128px tall, `aspect-21/9` drop zone) **side by side**,
photo first. They describe one thing — the vendor's visual identity. A full-width
cover above a lone circle wastes a third of the screen and reads as an orphan row.

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
