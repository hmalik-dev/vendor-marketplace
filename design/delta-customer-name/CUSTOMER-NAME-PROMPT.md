# Frame 40 — Customer name interstitial (VEN-642)

Reference: `Orla-Frame-40-Customer-Name.html` (frames 40 + 40b). Brand name is `brandName` ("Orla").

## Where it sits

Customer first sign-up: sign up → verify email → accept terms ("One last step") → **/sign-up/name** → dashboard.

- Mandatory hard gate. No skip, no "later" link. Vendors never see it.
- Middleware: a signed-in customer with no saved first/last name is redirected here from any route except /sign-up/name, /sign-out and the legal pages. Once saved, /sign-up/name redirects to the dashboard.
- Sign out is the only exit; signing back in returns here until the name is saved.
- Customer-side sibling of /sign-up/vendor-details (frame 36): same weight. **Not** /customer/profile, the four-tab editor.

## Layout (1440)

- Reuse the accept-terms-screen.tsx shell: full-frame `stone-50` (#F8F5EF), centred column, `max-w-[700px]`. No photo panel.
- Two faint decorative circles (bottom-left ink 3%, top-right clay 4.5%), same as frame 37.
- Logo mark + wordmark, centred, 34px below.
- No eyebrow label above the heading.
- Heading, Instrument Serif 38px / 1.14: **What's your name?**
- Sub, 14.5px / 1.65, stone-700, max 460px: **Vendors see it on every booking request you send, so use the name you'd give them in person.**
- Form, max-w 460px, centred, 30px below the sub:
  - First name | Last name: two columns, 12px gap, stacked below 480px.
  - **Continue**: full-width clay primary (#B4552F), 13px vertical padding, radius 10px.
  - **Sign out**: centred text link, 13px/600, #A34A28.

## Fields

- Both required. Trim whitespace. 1–50 chars each; allow any Unicode letters, spaces, hyphens, apostrophes.
- `autocomplete="given-name"` / `"family-name"`; autofocus first name.
- Prefill from the Clerk/SSO profile if available (still requires Continue).
- Save to both Clerk (`firstName`, `lastName`) and the app's customer record in one action.

## States (frame 40b)

- **Error** (on blur for a field you left, on submit for one you never touched): red border #B23A30 + 3px ring rgba(178,58,48,.18); message 11.5px under the field: "We need your first name." / "We need your last name too."
- **Saving**: inputs go to #F4F0E8 with muted text; button #9E4A29 with 14px spinner + "Saving"; everything disabled.
- **Failed save**: red banner above the fields: title "We couldn't save your name", body "What you typed is still here. Try again." Button reads "Try again". Values kept.

## Out of scope

Bio, city, budget tier, avatar, phone, booking history, reviews: all belong to /customer/profile (unframed).

## Acceptance

- [ ] New customers can't reach any dashboard or booking route without a saved first + last name
- [ ] No skip or dismiss control; Sign out is the only exit
- [ ] Visually continuous with accept-terms: same shell, column width and label/heading rhythm
- [ ] Exactly two inputs and one button
- [ ] Vendors are never routed here
- [ ] Failed save keeps what was typed
