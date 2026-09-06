---
name: worktree-guard-refuses-inline-heredoc-bodies
description: In a lane, `gh pr create` with a heredoc body and multi-step shell pipelines are refused as unverifiable — write the body to a file outside the repo and pass --body-file
metadata:
  type: feedback
---

A worktree-isolated session's Bash calls are checked to prove they target that
worktree, and anything the checker cannot parse is **refused rather than run**.
Two shapes hit this on lane t419 (2026-09-06), both on the first try:

- `gh pr create … --body-file - <<'BODY' … BODY` — refused with "runs gh with
  the text … inside a construct too complex to verify, so what it runs cannot be
  shown not to be git".
- `python3 - <<'PY' … PY` followed by `&& sed -n …` — refused as "too complex to
  verify that it stays inside the worktree".

The fix in both cases is the same and takes one extra call: **put the long text
in a file outside the repo** — the job's tmp directory — and pass it by path.

```bash
# body written with the Write tool to $CLAUDE_JOB_DIR/tmp/pr-body.md, then:
gh pr create --base main --head <branch> --title "…" --body-file /abs/path/pr-body.md
```

Same for a script: `Write` it to the job tmp dir, then `python3 /abs/path.py` or
`node /abs/path.mjs` as a plain single command.

**Why:** the refusal is not a permission prompt and no amount of rephrasing the
same shape gets past it — it is a parser giving up, so the answer is a simpler
command, never a retry. Writing the body to a file also survives the failure:
the PR description does not have to be retyped, which matters when it is long
enough to be worth writing carefully.

**How to apply.** In a lane, reach for `--body-file` with a real path from the
start rather than a heredoc, and keep `git add` and `git commit` as separate
calls for the same reason — see [[pathspec-when-a-peer-has-work-staged]] and
[[git-push-q-flag-trips-force-push-hook]]. Scratch files belong outside the
repo, which also keeps the tree clean for the staging hook; see
[[mcp-playwright-cannot-load-storage-state]] for the same trick applied to a
Playwright script.
