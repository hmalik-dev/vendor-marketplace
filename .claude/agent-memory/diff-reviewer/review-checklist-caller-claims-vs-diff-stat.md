---
name: review-checklist-caller-claims-vs-diff-stat
description: Check every file the caller says the diff touches against git diff --stat; a claimed fix may have been lost in a scope ripout
metadata:
  type: feedback
---

Check every file the caller's brief lists against `git diff --stat`. Also check each "also fixed X" line in decision records or PR prose against the actual hunks.

**Why:** VEN-603 (2026-09-22). The brief and D43 in the decisions log both described an `onOpenChange` memoization fix plus a regression test in `dropdown-combobox.tsx`. Neither file was in the diff. The fix was lost when the keyboard-suppression work was ripped out, so the record described a fix that did not exist.

**How to apply:** after the first diff call, compare the stat list to the brief's file list. Treat a missing file as a finding, and name every prose claim that depends on it.

Related: a self-focused `<button>` segment does not match `has-[:focus-visible]` variants (SEGMENT_FOCUS). When a combobox input changes to a button, check that the focus ring and the fill both moved to `focus-visible:`.
