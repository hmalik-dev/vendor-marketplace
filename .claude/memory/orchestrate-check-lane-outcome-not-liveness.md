---
name: orchestrate-check-lane-outcome-not-liveness
description: "When supervising lanes, read the ticket's Linear state and comments and report blockers; never report a lane as fine because `claude agents` says working"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6be10981-584c-4523-aa1e-5e7193e3b9ff
  modified: 2026-09-19T03:18:55.210Z
---

A lane showing `working`/`busy` in `claude agents` says nothing about progress. The VEN-444 lane had already moved the ticket back to Backlog with `blocked` and posted its findings, blocked on a permission denial, while I reported it as running.

**Why:** the user saw the ticket not In Progress and had to ask; a stalled lane is an issue to raise, not a status to relay. `claude logs <id>` is also useless for this (it returned a generic reply).

**Root cause of the missed finish:** a `claude --bg` lane sends the desk no task notification, so "wait for the notification" never fires. Subscribe with `SendMessage {to: <id>, notify_when_idle: true}` right after dispatch (now in the orchestrate skill).

**How to apply:** after dispatch and on every user check-in, `get_issue` + `list_comments` on the lane's ticket and read the lane's outcome. Lead with any blocker and the decision it needs from the user. Related: [[lead-dont-narrate]], [[guard-a-delegated-browser-pass-with-a-liveness-watch]].
