---
name: taskstop-cannot-stop-peer-sessions
description: TaskStop only reaches tasks this session spawned; a peer session is stopped by killing its process, identified by the bg-spare child's cwd
metadata:
  type: reference
---

`TaskStop` answers `No task found with ID: <name>` for every peer session in
`ListAgents` — it only reaches tasks **this** session spawned. A background peer
is stopped at the OS level.

Each background session is a `claude bg-pty-host` parent with a `claude bg-spare`
child. **The child's cwd is the project**, the parent's is always the daemon
spare dir — so `lsof -a -p <pid> -d cwd -Fn` on the *child* is what separates
vendor-marketplace lanes from another repo's sessions sharing the same daemon.
An unclaimed spare still has its `.claim.sock` in
`/tmp/cc-daemon-501/*/spare/`; a claimed one does not.

TERM the children, then reap any surviving parent. Name matching is useless here
(every process reads `claude ...`), so scope by cwd and refuse to kill anything
outside the target repo — see [[kill-dev-servers-by-lane-port]].

Killing a lane session leaves its worktree untouched: uncommitted work survives
on disk, and lane dev servers keep running as separate processes.
