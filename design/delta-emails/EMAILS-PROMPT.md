# Frame 38 — Vendor transactional emails (4 sends)

Reference: `Orla-Frame-38-Emails.html` (open in a browser). Build these as transactional email templates. Brand name is a variable (`brandName`, currently "Orla"); sender is `hello@orla.com`.

## Shared template

- 600px body. Outer ground `#E9E6DF`, card `#F8F5EF`, radius 10px, padding 40px 44px.
- Header: two-circle mark (clay `#B4552F` filled circle + ink `#23201C` 1.3px outline, offset 7px) + wordmark in Instrument Serif 24px.
- Headline: Instrument Serif 31px / 1.18, `#23201C`.
- Body: Instrument Sans 14.5px / 1.75, `#4A443C`.
- Button (max one per email): `#B4552F` bg, `#FFFDF9` text, 14px/600, padding 13px 26px, radius 10px.
- Info box: `#FFFDF9` bg, 1px `#E4DDD1` border, radius 12px.
- Footer: 1px `#E4DDD1` top rule, 12px / 1.65, `#6B6459`.
- Email-safe fallbacks: Georgia for the serif, Arial/Helvetica for sans, Courier for mono. Use table layout + inline styles in production.
- Each send has a plain-text part with the same sentences; the button becomes a bare URL.

## 1. Verification code (sent on sign-up)

- Subject: `Your {brandName} verification code: {code}`
- Headline: "Verify your email"
- "Hello {email},"
- "Thank you for signing up with {brandName}! Please verify your email address by entering the following code:"
- Code box: 6 digits, JetBrains Mono 34px/500, letter-spacing .32em, centered in info box.
- "Go back to the sign-up tab and type it in. There's no link to click."
- Footer: "You're getting this because this address was used to sign up for {brandName}. If that wasn't you, ignore this email and nothing happens."
- No button. No expiry stated (add only if the backend enforces one).

## 2. Invite — waitlisted vendor, account exists

- Subject: `You're invited to join {brandName} as a vendor`
- Headline: "Your invitation is here"
- "You're invited to join {brandName} as a vendor. Sign in with the email address and password you already made, and you'll land in your new vendor account."
- "The first thing to do there is set your prices, put up your work and open the dates you want to be booked on."
- Button: "Sign in to {brandName}" → /sign-in
- Footer: "You're getting this because you asked to join {brandName} as a vendor. If that wasn't you, ignore this email and nothing happens."

## 3. Invite — no account yet

- Same subject and headline as #2.
- "You're invited to join {brandName} as a vendor. Sign up with this email address — **{email}** — and you'll land in your new vendor account."
- Same second paragraph as #2.
- Button: "Sign up as a vendor" → /sign-up (vendor role preselected)
- Footer: "You're getting this because your business was put forward to join {brandName}. If you'd rather not, ignore this email and nothing happens."

## 4. Waitlist confirmation (after /sign-up/vendor-details)

- Subject: `You're on the {brandName} waitlist`
- Headline: "You're on the waitlist"
- "We've saved your details. We'll email you when you're invited, and you'll sign in with this same address. There's nothing else you need to do."
- Details box rows (label 104px, `#6B6459`): Business (600 weight), Category, Where, Email.
- "If any of that is wrong, reply to this email and we'll fix it."
- Footer: "You're getting this because you signed up to join {brandName} as a vendor."
- No button — the reply is the action.

## Rules

- No dates, counts, queue positions or urgency in any send.
- Invites #2 and #3 stay near-identical; only the sign-in vs sign-up sentence and button differ.
- Emails do not show the test-mode strip.
