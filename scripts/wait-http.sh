#!/usr/bin/env bash
# Block until every URL answers HTTP (any status < 500), or time out. One process.
#
#   wait-http.sh [--timeout <sec>] <url> [<url>...]
#
# Exit 0 when all answered; 1 on timeout (prints which did not answer).
# A 503 from the API's `/ready` counts as not answered, so waiting on it waits
# for the database and storage too. The repo copy of the personal helper, for
# CI's `e2e` job (VEN-411), which has no ~/.claude.
set -u
timeout=120
if [ "${1:-}" = "--timeout" ]; then timeout="$2"; shift 2; fi
[ $# -gt 0 ] || { echo "usage: wait-http.sh [--timeout sec] <url>..." >&2; exit 64; }
start=$(date +%s)
pending=("$@")
while [ ${#pending[@]} -gt 0 ]; do
  still=()
  for u in "${pending[@]}"; do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$u" 2>/dev/null)
    code=${code:-000}
    if [ "$code" -ge 100 ] 2>/dev/null && [ "$code" -lt 500 ]; then echo "up   $u ($code)"; else still+=("$u"); fi
  done
  pending=("${still[@]+"${still[@]}"}")
  [ ${#pending[@]} -eq 0 ] && exit 0
  if [ $(( $(date +%s) - start )) -ge "$timeout" ]; then echo "down ${pending[*]} after ${timeout}s" >&2; exit 1; fi
  sleep 2
done
