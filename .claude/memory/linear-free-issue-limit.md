---
name: linear-free-issue-limit
description: "The Linear workspace is on the free plan's issue cap; archive old Done/Canceled issues through the GraphQL API (LINEAR_API_KEY in .env.e2e.local) to make room — the MCP cannot archive"
metadata:
  node_type: memory
  type: project
  originSessionId: ca6f4644-9c80-432b-85ab-1742d6f5b979
  modified: 2026-09-22T23:45:49.187Z
---

The Linear workspace runs into the free plan's cap on active issues. At the cap, `save_issue` without an `id` fails with "You've exceeded the free issue limit for this workspace". Patches and comments still work. Archived issues do not count toward the cap.

The Linear MCP has no archive or delete action for issues. The user added `LINEAR_API_KEY` to the repo's `.env.e2e.local`, not `.env.local`. To archive, load that file with `node --env-file=.env.e2e.local <script>` and call GraphQL `issueArchive`. Never put the key in the script: the PreToolUse hook blocks even `line.slice('LINEAR_API_KEY=')`. On 2026-09-22 the user asked for the 50 oldest issues to be archived. VEN-377 and VEN-379 through VEN-427 were archived, all Done or Canceled; VEN-378 was skipped because it is still open.

**Why:** the pre-launch audit's filing pass was blocked partway until space was made.

**How to apply:** when creating an issue fails with the limit error, ask before archiving. Archive only Done, Canceled or Duplicate issues, oldest first, and check each issue's state inside the script before archiving it. Related: [[record-findings-in-backlog]], [[vendor-marketplace-linear-tracker]].
