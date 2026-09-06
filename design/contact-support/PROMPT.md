# Contact support — design spec

Standalone extract of frame `29 Contact support` from _Orla — Screens_.
Open `29-contact-support.html` in a browser; no build step, no dependencies
beyond the Google Fonts link.

---

## Why a form and not a `mailto:`

1. **It ships without an address.** A `mailto:` cannot exist until #374 rules on a
   real monitored address — and the moment it ships, that address gets scraped. A
   form keeps the destination in env, so the surface ships now and the address
   changes without a deploy.
2. **It captures the error reference for them.** `error.tsx` shows Next's digest
   deliberately — the same hash appears in the server log. Frame 16 tells the
   visitor to paste that reference to support. A form carries it as a hidden
   field, which removes the step and removes the common case where they don't
   paste it and you get an unactionable report.
3. **It already knows who's asking.** Clerk identifies signed-in users — no email
   field, no typos.
4. **Transport exists.** `email.ts` posts to Resend. This is a route and a form,
   not new infrastructure.

## Hard scope line

This is **not a helpdesk**. No threads, in-app replies, ticket statuses,
attachments, or admin triage queue. It sends an email and says so. Anything that
stores and tracks conversations is its own product.

---

## The six states

| #   | State                   | Note                                                                                                                                        |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Signed out              | topic, message, email — the only state with an email field                                                                                  |
| 2   | Signed in               | no email field; say which account gets the reply                                                                                            |
| 3   | Prefilled from an error | reference shown as attached context, not an editable field they can clear                                                                   |
| 4   | Submitting              | one loading idiom for the screen                                                                                                            |
| 5   | Sent                    | must hand back a reference they can keep — "thanks" alone leaves them nothing to follow up with                                             |
| 6   | Failed to send          | the one usually skipped, and the one that matters most: a support form that can't send is a dead end. Name the cause, offer one way through |

## How each is drawn

**1 — Signed out** (520px frame). Topic, your email, message. The email field is
the only one that has to justify itself: "The only address we'll use, and only to
answer this." No error reference — a visitor arriving from the footer carries
none.

**2 — Signed in** (tile). Identity comes from the session, so there is no email
field and no typo to lose an answer to. The reply-to row is a _statement_, not an
input: changing where replies go means changing the account.

**3 — Prefilled from an error** (1440 frame, the flagship). The digest sits in a
stone block labelled "Attached automatically", with timestamp and route, above
the topic field. Mono type, no input chrome, no clear affordance. Copy explains
it points at the exact server-log entry "so we can look before we ask you
anything."

**4 — Submitting** (tile). One idiom for the whole screen, matching frames 24 and
26: full clay `#B4552F` button, `.spin` spinner, label to the present
participle, fields read-only. No tint (a lightened button loses contrast against
its own white label), no skeletons (the content is already on screen), no
full-page overlay (it would hide the message they just wrote).

**5 — Sent** (390 frame). Hands back `ORL-4K7Q-P2` in a bordered block with a
copy control and "Quote this if you follow up. It's in the confirmation email
too." Explicitly says there is nothing to check back on here, so nobody returns
looking for a status. **The reference is the message id, not the error digest** —
a send from the footer has no digest, so the digest cannot be what state 5
returns.

**6 — Failed to send** (full-width tile). Names the cause as _transport_ — "our
mail service rejected it… it isn't something you can fix by editing it" — so they
don't reword a message that was fine. Exactly one action: **Try again**, the only
action that can succeed, since there is no fallback address yet (#374) and a
second button would imply a choice that doesn't exist. The reference is issued
here too, before the send resolves, which is what lets a failed message still be
something they can ask about.

## Topic list

Something broke · A booking or payment · My vendor profile · Trust & safety ·
Something else

Five options. The first is preselected when a reference is attached. Topic is the
routing key in the email subject — it earns its place because a human reads it,
not because it feeds a queue.

---

## Tokens used

| Role                | Value                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| Ink                 | `#23201C`                                                                |
| Ink secondary       | `#4A443C`                                                                |
| Muted / placeholder | `#6B6459`                                                                |
| Page                | `#F8F5EF`                                                                |
| Surface             | `#FFFDF9`                                                                |
| Field / inset       | `#F1ECE4`                                                                |
| Border              | `#E4DDD1`                                                                |
| Clay (primary)      | `#B4552F`                                                                |
| Clay text           | `#8E3F20` / `#A34A28`                                                    |
| Clay wash           | `#F7E7E0`                                                                |
| Error wash / border | `#FCEDE8` / `#F3D6CC`                                                    |
| Sage wash / text    | `#EDF0E9` / `#4B5940`                                                    |
| Type                | Instrument Serif (headings), Instrument Sans (UI), JetBrains Mono (refs) |

## Open dependency

**#374** — the monitored support address. Nothing in this design blocks on it:
the destination is an env var, and state 6's single action is retry rather than a
fallback `mailto:`. Revisit state 6 only if the ruling adds a public address.
