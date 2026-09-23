---
name: midtask-descope-message-still-needs-raw-observation
description: A coordinator message mid-run that descopes a criterion (e.g. "skip judging item 2, it's being redesigned") still wants the observed value reported, just not a pass/fail verdict
metadata:
  type: feedback
---

A mid-task system message from the calling agent can narrow what you judge
without cancelling the whole pass: "skip judging X, report the raw observation
only" is a real, followable instruction, not a signal to stop or to omit X from
the report entirely.

**Why:** on VEN's double-signup-code lane pass, the coordinator descoped the
avatar-letter behaviour (site-header.tsx / current-user.ts) mid-run because it
was about to be redesigned, but still wanted the avatar text recorded at each
step for the record. The correct shape was: keep collecting the same evidence
(avatar text pre- and post-accept-terms, screenshots) and label it "observed,
not verified against a criterion" in the final report, rather than dropping it
or treating the whole item as BLOCKED.

The same message can also carry an environment warning ("source files will be
edited while you run; do not rebuild after the server is started") — treat that
literally: finish the run against the build already running, don't re-build or
restart the server mid-pass even if you'd normally rebuild after a source edit.

**How to apply:** when a mid-run message narrows scope, keep the observation
loop for the descoped item exactly as planned, change only the verdict line
(no PASSED/FAILED, just the raw value with a note on why it isn't graded), and
respect any accompanying "don't touch the running process" instruction for the
rest of the pass.
