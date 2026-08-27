# 18 — Messaging (`/messages`) — **MVP**

**Purpose:** keep the negotiation attached to the booking. The context rail is
what makes this a booking tool rather than a chat app.
**Shell:** `app-shell`, three panes, none of which scroll the page.

## Composition at 1440

```
┌ conversations 300px ┬──── thread (flex) ────┬ booking context 320px ┐
│ Messages  Unread(2) │ header: name, event   │ This request          │
│ • Priya N.  active  │ ─────────────────────  │ Sun, June 14          │
│   Tom R.    unread  │ messages, day dividers│ 2:00 PM · 120 guests  │
│   Ana L.            │                       │ Full day     $1,450   │
│   Jordan W.         │ ─────────────────────  │ +2 hours       $400   │
│                     │ composer + actions    │ Revised      $1,850   │
│                     │                       │ [Send revised quote]  │
│                     │                       │ [Accept as-is]        │
│                     │                       │ Decline politely      │
│                     │                       │ ── About Priya ──     │
└─────────────────────┴───────────────────────┴───────────────────────┘
```

## Conversation list

Each item: avatar · name · truncated preview · timestamp · and a **booking context
line** in 10.5px uppercase ("Re: Jun 14 wedding"). That line is what makes a list
of names navigable when a vendor has thirty threads.

Unread: bold name, `clay-400` dot. Active: `clay-100` background with
`inset 3px 0 0 clay-400`.

## Thread

Header: avatar, name, the booking one-liner, and the status pill — so the state
is visible while reading. Day dividers centred in 11.5px `stone-600`.

Bubbles: own messages `clay-100` with `rounded-[14px_14px_4px_14px]`; other party
`stone-0` with the mirror radius. Max width 62%. Timestamp below, outside the
bubble, 11px `stone-600`. Marketplace, not iMessage — the tail is a subtle corner,
not a pointer.

Composer: auto-resizing textarea in `stone-150`, then Attach · **Insert package**
· Send. "Insert package" drops a formatted package card into the thread — the
single highest-leverage thing on this screen for a vendor closing a deal.

## Context rail

The linked request: date in Serif 24px, the event facts, the price lines
including any adjustment being negotiated, and the revised total. Then the
actions available **in this status** — Send revised quote (primary), Accept as-is
with the original amount named, Decline politely (ghost).

Below: **About [customer]** — member since, bookings, completion rate, rating from
other vendors, and one quoted review. A vendor deciding whether to hold a Saturday
wants to know who they're holding it for.

## Acceptance

- [ ] Three panes at ≥1280; context collapses to a toggle at 1024–1279
- [ ] A quote can be sent without leaving the thread
- [ ] Every conversation shows its booking context line
- [ ] Auto-scroll to newest; a "New messages ↓" chip appears if scrolled up
- [ ] Real-time via SSE; the composer never blocks on delivery

## Post-MVP

- Canned replies / templates
- Read receipts
- In-thread file attachments beyond images
- Vendor-to-vendor referrals
