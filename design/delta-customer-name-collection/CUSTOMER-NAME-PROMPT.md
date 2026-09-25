# Frames 40–41 — Customer welcome + name (VEN-642)

Reference: `Orla-Frame-40-Customer-Name.html` (frames 40, 41, 41b). Brand name is `brandName` ("Orla").

## Flow
Customer: sign up → verify email → **40 /sign-up/accept-terms** → **41 /sign-up/name** → dashboard. Vendors never see 41.

## Shared shell (both screens)
- Reuse accept-terms-screen.tsx: full-frame #F8F5EF, centred column `max-w-[700px]`, no photo panel.
- Two faint decorative circles (bottom-left ink 3%, top-right clay 4.5%).
- Logo mark + wordmark centred, 34px above heading. No eyebrow label.
- Heading: Instrument Serif 38px / 1.14, #23201C. Sub: 14.5px / 1.65, #4A443C, max 460px.
- Controls column max-w 460px, 30px below sub. Primary: full-width #B4552F, 13px vertical padding, radius 10px, 13.5px/600.

## Frame 40 — Welcome
- Heading: **Welcome to {brandName}**
- Sub: **You're joining as a customer.**
- Button: **Continue**
- Under button, 12.5px #6B6459 centred: "By continuing you agree to the **Terms** and **Privacy Policy**." (links #A34A28, underlined, new tab)
- No checkbox; pressing Continue records consent (timestamp + terms version), then routes to /sign-up/name.

## Frame 41 — What should we call you?
- Heading: **What should we call you?**
- Sub: **Vendors see this name once you request a booking.**
- First name | Last name: two columns, 12px gap, stacked below 480px.
- **Continue** (primary), then **Sign out** (centred text link, 13px/600, #A34A28).
- Hard gate: no skip. A signed-in customer without a saved name is redirected here from any route except /sign-up/name, /sign-out and legal pages. Once saved, this route redirects to the dashboard.
- Fields: both required, trimmed, 1–50 chars, Unicode letters/spaces/hyphens/apostrophes. `autocomplete="given-name"` / `"family-name"`; autofocus first. Prefill from SSO if present. Save to Clerk (`firstName`, `lastName`) and the customer record.

## Frame 41b — states
- **Error:** red border #B23A30 + 3px ring rgba(178,58,48,.18); message 11.5px under field: "We need your first name." / "We need your last name too."
- **Saving:** inputs #F4F0E8 muted; button #9E4A29 with spinner + "Saving"; all disabled.
- **Failed save:** red banner "We couldn't save your name" / "What you typed is still here. Try again." Button "Try again". Values kept.

## Out of scope
Bio, city, budget tier, avatar, phone: /customer/profile (unframed).

## Acceptance
- [ ] Verified customers land on 40, then 41, then dashboard
- [ ] 40 has one button; consent recorded on press
- [ ] 41 has exactly two inputs, Continue and Sign out; no skip
- [ ] No dashboard or booking route reachable without a saved name
- [ ] Both screens share the same shell
