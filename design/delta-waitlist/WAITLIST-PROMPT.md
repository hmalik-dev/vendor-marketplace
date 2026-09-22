# Vendor waitlist journey — build notes

Frames **35 / 35b / 36 / 36b / 37 / 38** in `Orla - Screens.dc.html`. Frame 12 was edited (legal small print). No new tokens, no new components.

## Routes

| Step     | Route                     | Notes                                                                    |
| -------- | ------------------------- | ------------------------------------------------------------------------ |
| Sign up  | `/sign-up`                | role choice; `?role=vendor` preselects (the `/for-vendors` CTA)          |
| Code     | `/sign-up/verify`         | existing verification step, unchanged                                    |
| Details  | `/sign-up/vendor-details` | vendor only; unreachable until the email is verified                     |
| Waitlist | `/waitlist`               | terminal; a waitlisted vendor signing in lands here, not on `/dashboard` |

A waitlisted vendor has a login and **no app account yet**: the account is created when they accept the invite and the Terms. Until then every route that needs an account (`/dashboard`, every vendor route, `/bookings`, `/messages`) redirects to `/waitlist`; public pages stay viewable.

## 35 — sign-up

Two additions to frame 12, no other change:

1. **Invitation notice**, above the submit button, only when `role === 'vendor'`. Plain body copy (`13px/1.65`, `#4A443C`) above a `1px #E4DDD1` rule. Not a banner — see note in frame.
   > Vendors join {BRAND_NAME} by invitation for now. Sign up and we'll add you to the waitlist.
2. **Legal small print**, below the submit button, **all roles, all states** including no-role-chosen:

   > By signing up, you agree to the [Terms of Service] and [Privacy Policy].

   `11.5px`, `#6B6459`, centred; both links `#A34A28` underlined, `text-underline-offset:2px`, to `/terms` and `/privacy`.

States (35b): field errors inline red per frame 22; submitting darkens the button to `#9E4A29` with an inline spinner and greys the inputs; failed create is a red banner above the form — must say nothing was saved and they are not on the waitlist.

## 36 — business details

Verified email is **display, not input**: `#F1ECE4` fill, sage `Verified` pill, no caret. Fields: business name (required), category (select, required, same 11-item taxonomy as browse), city (required), state (select, required), link to your work (optional, helper "Instagram, a website"). One primary button, `Add me to the waitlist`. No secondary, no back link.

Validation: on blur for touched fields, on submit for untouched. The optional link errors only on shape, never on absence. Failed save must state plainly that they are **not** on the waitlist and that input is retained.

## 37 — waitlist

Terminal. No form, no button, no progress indicator. Sage 46px check, headline, one paragraph, `Back to {BRAND_NAME}` text link, which also signs the person out before going home (there is nothing to be signed in for). There is no separate sign-out control on 36 or 37. Email quoted in full, semibold ink. No error/loading/failed states — nothing submits; a failed account read on a later visit uses the shell's steel _couldn't load_ state from frame 26.

## 38 — emails

600px body. Both invites share the subject `You're invited to join {BRAND_NAME} as a vendor` and differ in one sentence: existing account → sign in with the password you already made (button `Sign in to {BRAND_NAME}`); no account → sign up with this address, address quoted (button `Sign up as a vendor`). Confirmation (`You're on the {BRAND_NAME} waitlist`) carries the four saved facts and offers reply as the correction channel; no button.

No dates, no counts, no queue position, no expiry language in any send. Each is short enough to be its own plain-text part verbatim.

## Voice flags (raised, not changed)

1. ~~**"We'll email you when you're invited"** reads as a promise that an invite _will_ come.~~ **Resolved — keep as written.** The intent is to invite everyone, so `when` is accurate, not optimistic. Do not soften to `if` in any copy revision.
2. **"by invitation for now"** (screens 35, 36) implies the restriction lifts. A near-term promise about the product, not the account — kept, but if vendor sign-up may stay closed, `for now` should go.
3. ~~**"your vendor account opens"** suggests the invite alone completes onboarding.~~ **Changed.** Now `you'll land in your new vendor account` on screen 37 and both invites — it describes where signing in takes you, not a finished onboarding. Both invites follow with `The first thing to do there is set your prices, put up your work and open the dates you want to be booked on`, so the profile work is named rather than implied.
4. **Duplication.** The invitation sentence appears on 35 and again in 36's subhead, back to back. Deliberate — the two steps must not contradict — but it is the same claim twice in a row.
5. **Confirmation email vs screen 37**: the email says "We've saved your details", the screen says "We've saved {email}". Both true, and the email lists the details, so the wording differs on purpose. Flagging in case the intent was one sentence in both.
