#!/usr/bin/env bash
#
# Overnight parallel ticket runner.
#
# Each batch is a FRESH `claude -p` process running `/orchestrate <n>`. That one
# choice gives every property asked for:
#
#   * Cleared context. The supervisor starts with an empty context window each
#     batch and exits when the batch lands, so nothing accumulates all night.
#     Running `/orchestrate` once interactively would keep one session alive
#     across every ticket until it filled.
#   * Parallelism with real isolation. `/orchestrate` dispatches each lane as its
#     own background session (`claude --bg --worktree <id> "/ticket <id>"`), so a
#     lane gets a fresh context too, plus its own git worktree and — through
#     `pnpm lane:up` — its own web port, API port, Postgres database and browser.
#   * Safe selection. `/orchestrate` sends Explore to get each candidate's real
#     file set and drops tickets that would edit the same files as a batch-mate.
#     Two lanes in one file is the failure mode lanes exist to avoid, and no
#     amount of shell scripting reproduces that check.
#
# Between batches it runs `/land-lanes`, which reconciles the PRs each lane
# enqueued, tears down merged lanes, and leaves failed ones resumable. Tickets
# blocked on a just-merged ticket become eligible for the next batch.
#
# Usage:
#   caffeinate -dimsu ./scripts/overnight.sh
#   LANES=5 caffeinate -dimsu ./scripts/overnight.sh
#   DRY_RUN=1 ./scripts/overnight.sh     # report the queue and exit
#
# caffeinate flags: -d display, -i idle sleep, -m disk, -s while on AC, -u
# asserts user activity. Keeps the Mac fully awake for the whole run.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

LANES="${LANES:-3}"          # /orchestrate's own ceiling is 5
MAX_BATCHES="${MAX_BATCHES:-30}"
MODEL="${MODEL:-opus}"
DRY_RUN="${DRY_RUN:-0}"
LANE_TIMEOUT_MIN="${LANE_TIMEOUT_MIN:-75}"
TRACKER=".claude/plans/vendor-marketplace-tickets.md"
LOGDIR=".claude/logs/overnight-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOGDIR"

log() { printf '%s %s\n' "$(date '+%H:%M:%S')" "$*" | tee -a "$LOGDIR/run.log"; }

# ---------------------------------------------------------------------------
# Queue depth, read from the Status Board.
#
# Cells from #65 up wrap every value in `**`, so markup is stripped before
# matching. A bare `^[0-9]+$` silently drops 154 rows and makes the board look
# like it stops at #64. Lettered ids (6a, 22a) fold onto the parent number.
#
# Eligible = status is exactly `Backlog`, and every ticket named in Blocked By is
# Done. `Deferred — needs a human` and `Blocked — needs a human` are excluded by
# the status test. A Blocked By naming no ticket at all is a human gate written
# in prose ("Resend API key", "Stripe dashboard") and is NOT eligible — keying on
# Blocked By alone would dispatch a lane at a credential nobody has.
# ---------------------------------------------------------------------------
eligible_tickets() {
  local rows
  rows="$(mktemp)"
  awk '/^## Status Board/,/^## Build Order/' "$TRACKER" 2>/dev/null \
    | grep -E '^\|' \
    | awk -F'|' '
        {
          id=$2; st=$7; bb=$9
          gsub(/[*`[:space:]]/, "", id)
          gsub(/[*`]/, "", st); gsub(/^[[:space:]]+|[[:space:]]+$/, "", st)
          gsub(/[*`]/, "", bb); gsub(/^[[:space:]]+|[[:space:]]+$/, "", bb)
          if (id ~ /^[0-9]+[a-z]?$/) print id "\t" st "\t" bb
        }' >"$rows"

  # Two passes over the same rows: collect Done first, then test Backlog rows
  # against it. The file is real rather than a pipe because stdin cannot be
  # read twice — `awk ... - -` silently yields nothing on the second pass.
  awk -F'\t' '
      NR==FNR { if ($2=="Done") { p=$1; sub(/[a-z]$/,"",p); done[p]=1 } next }
      $2=="Backlog" {
        if ($3=="None" || $3=="" || $3=="-" || $3 ~ /^—$/) { print $1; next }
        named=0; ok=1; n=split($3, deps, ",")
        for (i=1;i<=n;i++) { d=deps[i]; gsub(/[^0-9]/,"",d); if (d!="") { named++; if (!(d in done)) ok=0 } }
        if (named>0 && ok) print $1
      }' "$rows" "$rows"

  rm -f "$rows"
}

# Tickets marked Done on the board. This is the progress metric.
done_count() {
  awk '/^## Status Board/,/^## Build Order/' "$TRACKER" 2>/dev/null \
    | grep -E '^\|' \
    | awk -F'|' '{ id=$2; st=$7
        gsub(/[*`[:space:]]/, "", id)
        gsub(/[*`]/, "", st); gsub(/^[[:space:]]+|[[:space:]]+$/, "", st)
        if (id ~ /^[0-9]+[a-z]?$/ && st == "Done") n++
      } END { print n+0 }'
}

# Background lane sessions still running under this checkout.
# Only lanes with a LIVE pid count. A finished or crashed lane can linger in the
# registry with `pid: null`; counting those makes every wait below time out, which
# on 2026-08-29 burned 4 x 90 minutes waiting on a session that had already died.
running_lanes() {
  claude agents --json 2>/dev/null \
    | python3 -c 'import sys, json, os
try: d = json.load(sys.stdin)
except Exception: d = []
n = 0
for a in d:
    if a.get("kind") == "interactive":
        continue
    pid = a.get("pid")
    if not pid:
        continue
    try:
        os.kill(int(pid), 0)
    except (OSError, ValueError):
        continue
    n += 1
print(n)' 2>/dev/null || echo 0
}

# PIDs of live lanes, for the timeout path.
lane_pids() {
  claude agents --json 2>/dev/null \
    | python3 -c 'import sys, json, os
try: d = json.load(sys.stdin)
except Exception: d = []
for a in d:
    if a.get("kind") == "interactive": continue
    pid = a.get("pid")
    if not pid: continue
    try: os.kill(int(pid), 0)
    except (OSError, ValueError): continue
    print(pid)' 2>/dev/null
}

# /orchestrate dispatches lanes as detached background sessions and may return
# before they finish. Never start a second batch on top of a live one.
open_prs() { gh pr list --state open --json number --jq 'length' 2>/dev/null || echo 0; }

# $1 = how many lanes were dispatched this batch.
wait_for_lanes() {
  local waited=0 expect="${1:-$LANES}"
  while [ "$(running_lanes)" -gt 0 ]; do
    # A lane delivers by opening a PR and exiting at PENDING_MERGE — but the
    # session itself can stay alive long after. On 2026-08-29 four lanes shipped
    # their tickets by 03:48 and were still running at 12:00, so waiting on
    # process exit burned 4.5 hours on work that was already done. Once every
    # dispatched lane has a PR open, the batch has delivered: land it.
    if [ "$(open_prs)" -ge "$expect" ]; then
      log "  all $expect lane(s) have opened PRs — landing without waiting for exit"
      for p in $(lane_pids); do kill "$p" 2>/dev/null; done
      sleep 5
      for p in $(lane_pids); do kill -9 "$p" 2>/dev/null; done
      return 0
    fi
    if [ "$waited" -ge "$((LANE_TIMEOUT_MIN * 60))" ]; then
      # Never fall through to /land-lanes with lanes still live. Landing tears
      # down worktrees and lane databases, and on 2026-08-29 it did exactly that
      # underneath four running lanes, destroying their working directories
      # mid-ticket. A lane past the deadline is stuck; stop it, then land.
      log "  WARNING: lanes still running after ${LANE_TIMEOUT_MIN}m — stopping them before landing"
      for p in $(lane_pids); do
        kill "$p" 2>/dev/null && log "    stopped lane pid $p"
      done
      sleep 10
      for p in $(lane_pids); do
        kill -9 "$p" 2>/dev/null && log "    force-stopped lane pid $p"
      done
      return 0
    fi
    sleep 60
    waited=$((waited + 60))
    [ $((waited % 600)) -eq 0 ] && log "  ...$(running_lanes) lane(s) still running (${waited}s)"
  done
}

start_count=$(eligible_tickets | wc -l | tr -d ' ')
start_done=$(done_count)
log "Overnight run -> $LOGDIR"
log "Lanes: $LANES | Model: $MODEL | Max batches: $MAX_BATCHES"
log "Eligible tickets now: $start_count"

if [ "$DRY_RUN" = "1" ]; then
  log "DRY_RUN — first $LANES candidates: $(eligible_tickets | head -"$LANES" | tr '\n' ' ')"
  exit 0
fi

if [ "$start_count" -eq 0 ]; then
  log "QUEUE_EMPTY at start — nothing to do."
  exit 0
fi

batch=0
stalled=0

while [ "$batch" -lt "$MAX_BATCHES" ]; do
  before=$(eligible_tickets | wc -l | tr -d ' ')
  if [ "$before" -eq 0 ]; then
    log "QUEUE_EMPTY — no eligible tickets remain."
    break
  fi

  batch=$((batch + 1))
  done_before=$(done_count)
  log "=== batch $batch — $before eligible, dispatching up to $LANES lanes ==="

  # Fresh supervisor. Exits when the batch is dispatched and supervised.
  #
  # The ordering steer that used to live here pointed at the tracker's
  # "## Overnight queue" section, which was deleted on 2026-08-29 with the
  # backlog consolidation. It existed because ~90 single-measurement parity
  # findings sat behind three unblockers; those have landed (#74, #165, #198,
  # #235) and the findings are batched by frame, so priority-then-oldest is
  # safe again. What remains is the ordering that lives inside the tickets.
  claude -p "/orchestrate $LANES

Read each ticket before starting it; several carry their own internal order. The change order goes first within its frame: #287 in #298, #288 in #299, #166 in #301, #169 in #304. The parity tickets (#296, #297, #298, #300, #301, #302) open by re-measuring with parity-checker and closing what already matches, before any code change. #73 builds the shared focus-ring, hit-area and overlay primitives that #296-#301 and #304 consume, and #306 carries the design rulings that #301 and #304 are blocked on, so both go early. Skip any ticket whose Blocked By names a person, a credential or a dashboard rather than a ticket number." \
    --model "$MODEL" \
    --permission-mode bypassPermissions \
    >"$LOGDIR/orchestrate-$batch.log" 2>&1
  log "  orchestrate exit $?"

  wait_for_lanes "$LANES"

  # Lanes exit at PENDING_MERGE without merging; this reconciles them.
  claude -p "/land-lanes" \
    --model "$MODEL" \
    --permission-mode bypassPermissions \
    >"$LOGDIR/land-$batch.log" 2>&1
  log "  land-lanes exit $?"

  git fetch origin --quiet 2>/dev/null
  git checkout main --quiet 2>/dev/null
  git pull --ff-only --quiet 2>/dev/null

  after=$(eligible_tickets | wc -l | tr -d ' ')
  done_after=$(done_count)
  landed=$((done_after - done_before))
  log "  eligible: $before -> $after | Done: $done_before -> $done_after (+$landed)"

  # Progress is tickets DONE, never the eligible count. Eligibility legitimately
  # GROWS when work lands: on 2026-08-29 finishing #74 and #165 released ~60
  # parity tickets behind them and lanes filed 6 more, so 4 completed tickets
  # showed up as "cleared: -62" and read like a failure. Count what landed.
  if [ "$landed" -le 0 ]; then
    stalled=$((stalled + 1))
    if [ "$stalled" -ge 2 ]; then
      log "STOP: two consecutive batches landed no tickets. Remaining work needs a human."
      break
    fi
  else
    stalled=0
  fi
  echo
done

end_count=$(eligible_tickets | wc -l | tr -d ' ')
log "=== summary ==="
log "  batches run:        $batch"
log "  tickets landed:     $(($(done_count) - start_done))"
log "  eligible at start:  $start_count"
log "  eligible at end:    $end_count  (grows when landed work unblocks more)"
log "  logs:               $LOGDIR"
