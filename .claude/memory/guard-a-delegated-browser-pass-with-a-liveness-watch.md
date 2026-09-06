---
name: guard-a-delegated-browser-pass-with-a-liveness-watch
description: A dev server that dies mid-pass makes a browser or parity agent report nothing and look clean — arm a liveness watch before delegating
metadata:
  type: feedback
---

Before handing a flow to `browser-verifier`, `parity-checker` or
`unhappy-path-hunter`, arm a watch on the lane's web port that fires the moment
it stops answering:

```
until ! curl -s -o /dev/null --max-time 5 http://localhost:<webPort>/; do sleep 30; done
```

**Why:** a delegated pass against a dead server produces no findings, and no
findings is exactly what a clean pass produces. The agent cannot tell the two
apart from inside, and neither can its report. On 2026-09-05 lane t403's Next
dev server was killed twice mid-pass by a peer's unscoped `pkill -f "next dev"`
— that pattern matches every lane, not the one that runs it — and without the
watch the second outage would have been invisible until the parity verdict came
back reassuring and hollow.

**How to apply:** when the watch fires, restart the server and **message the
running agent** rather than waiting for its report: tell it the window, tell it
to void any measurement taken inside it, and ask it to re-read at least one
value it had already recorded and say whether the two readings agreed. Two
disagreeing reads of one value mean neither was a measurement — the rule in
[[playwright-parity-gate-every-fe-ticket]] and `web-design-parity.md`. Say
explicitly whether anything *you* changed during the window was visual, so the
agent can attribute a disagreement to an edit rather than to the outage; a good
agent will check file mtimes and catch you out if you get this wrong.

This is the victim's half of [[kill-dev-servers-by-lane-port]]: that memory
stops you taking other lanes down, this one stops a lane you own from reporting
a hollow pass when someone else does. [[dev-and-build-contend-over-next]] is a
third way the server disappears under you.
