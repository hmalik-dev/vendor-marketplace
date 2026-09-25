---
name: user-text-in-notification-bodies
description: VEN-765's request_declined body was the first to interpolate user-authored free text into a notification that is also emailed under the brand; before it every body was server-composed
metadata:
  type: project
---

Notification bodies were server-composed sentences until VEN-765. Even
`new_message` deliberately says "X sent you a message. Open the thread to
reply." rather than quoting the message. VEN-765 puts the customer's decline
reason (freeText, <=500) in quotes inside the vendor's `request_declined` body,
which `notification-email.ts` mails. `renderHtml` runs `escapeHtml` on title,
body, label and url, and the subject is the fixed title, so there is no HTML or
header injection. What remains is content spoofing: attacker text (a URL, "your
payout is on hold") in an email from the platform's own sender, and mail
clients autolink bare URLs. Precondition is a quoted request, so the target is
a vendor who already quoted. Raised as Low.

**Why:** a brand-signed email carrying user text is a phishing surface that an
in-app thread is not.

**How to apply:** when a diff interpolates user text into `insertNotification`
/ `notifyUser` bodies, check the escape in `renderHtml` still holds and raise
the spoofing point once. If the user rules it a product decision, record that
here and stop raising it. Related: [[public-mail-endpoint-echoes-to-any-address]],
[[admin-vendor-detail-is-a-gated-aggregate]] (admin sees notification bodies).
