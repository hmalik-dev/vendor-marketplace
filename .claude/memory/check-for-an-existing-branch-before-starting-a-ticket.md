---
name: check-for-an-existing-branch-before-starting-a-ticket
description: A ticket's Branch column may already name pushed work — read it and `git ls-remote` before building anything
metadata:
  type: feedback
---

Before starting a ticket, read its **Branch column** and run `git ls-remote --heads origin | grep <ticket>`. A previous session may have pushed partial work under `worktree-<n>` and released the ticket back to Backlog with the head start intact.

**Why:** on 2026-08-30 #167 was rebuilt from scratch on `claim-167` while `worktree-167` already held a tested dropdown shell (`55ab8aa`). The board row named that branch *and described what was on it*; it was not read. The rebuild was complete and shipped, so the branch was deleted as superseded — but the shell was written twice.

**How to apply:** the row's own Notes are the inventory. A row saying "Started on `<branch>` — the shell is built and tested, the migrations are not" is telling you where to resume, not just what happened. Treat a named branch as work to continue, and rebuild only after looking at it and deciding it is worth discarding. See [[ticket-worktree-merge-immediately]] and [[record-findings-in-backlog]].
