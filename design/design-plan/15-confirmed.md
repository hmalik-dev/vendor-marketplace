# 15 — Booking confirmed — **MVP**

**Purpose:** the one celebration moment in the product — then straight back to
something useful.

Full-bleed `linear-gradient(150deg, #7A9468, #5E7A4E 55%, #49613D)` with two
low-opacity white circles for depth. This is the only gradient on any
non-marketing surface, and the only place sage becomes a full field.

## Sequence

1. 70px translucent circle with a white check — spring in, damping 20 / stiffness 300.
2. **"June 14 is yours."** Serif 48px, white. Names the date, not the transaction — "Booking confirmed" is a receipt; the date is what they bought.
3. One line: what was paid, and when the vendor will next be in touch.
4. Detail card on `stone-0`: vendor thumbnail + name + event line · Paid (Serif) · Booking id in JetBrains Mono.
5. **Message [vendor]** (white fill, sage text) + **View booking** (white outline).
6. A divider, then **"Still need someone for [date]?"** with four category chips — **names only, no counts** — linking into search pre-filtered to this event's date and city. The old "Couples who booked Maya also booked" framing needs pairing data that doesn't exist yet; post-MVP.

One sparkle burst, not continuous. Respects `prefers-reduced-motion` — the check
appears without spring, the burst is skipped.

## Acceptance

- [ ] Entire moment fits one viewport with no scroll
- [ ] Booking id present and copyable
- [ ] Next-step chips are real categories with no counts, filtered to the same date and city
- [ ] Reachable again from the booking detail — it is a state, not a one-shot page

## Post-MVP

- "Couples who booked X also booked" — needs real pairing data
- Counts on the category chips
- Add-to-calendar and a shareable event summary
