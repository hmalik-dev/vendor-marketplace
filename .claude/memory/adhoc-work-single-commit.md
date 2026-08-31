---
name: adhoc-work-single-commit
description: "For ad-hoc (non-ticket) work, commit the whole tree together; do not isolate unrelated changes into separate commits"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 751062f9-8d32-4214-8c11-c7fd604861be
  modified: 2026-08-27T19:51:31.267Z
---

When the user asks for ad-hoc work (no ticket), do **not** stop to isolate
unrelated changes into their own commits. Stage the tree and commit it together,
even when it includes edits from a concurrent session.

**Why:** this repo is often worked by more than one session at once, so unrelated
modified files show up mid-task routinely. A `PreToolUse` hook blocks `git commit`
while anything is unstaged or untracked, so leaving another session's edits alone
means the commit cannot proceed at all. The user's judgment is that a mixed commit
beats a blocked one for ad-hoc work.

**How to apply:** `git add -A`, run the secret scan, commit. Describe everything
included in the message rather than pretending it is one change. Still *look* at
what you are sweeping in — read unfamiliar diffs before committing, because that
is how the design-contract change in `639ea2e` and its landing parity break were
caught. This does not extend to ticketed work, which follows
[[vendor-marketplace-local-ticket-tracker]] and its atomic-commit convention.

**One narrow exception**, added 2026-08-30: this covers files a peer left
*modified*. It does **not** cover files a peer has **staged** and is about to
commit — sweeping those in takes their commit rather than tidying the tree. See
[[pathspec-when-a-peer-has-work-staged]].
