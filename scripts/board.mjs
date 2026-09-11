#!/usr/bin/env node
// The ticket board CLI. Every read and write of the Status Board goes through
// here so a session never greps or seds a 190 KB markdown file by hand.
//
//   node scripts/board.mjs depth
//   node scripts/board.mjs list [--ready] [--json]
//   node scripts/board.mjs get <id> [--json]
//   node scripts/board.mjs next [--json]
//   node scripts/board.mjs set <id> <Status> [--branch b] [--sha s] [--pr n] [--note text]
//   node scripts/board.mjs add "<title>" [--priority P2] [--milestone M6] [--phase P3]
//        [--capabilities "core auth"] [--blocked-by "#12 #13"] [--body <file>] [--note text]
//
// Eligibility (used by `list --ready` and `next`): status Backlog or In Progress,
// and no `Blocked By` id that is still an open row. Order: priority P0 > P3, then
// In Progress before Backlog, then lowest id. Status values are exactly
// `Backlog`, `In Progress`, `Done`, `Deferred — needs a human`, `Superseded`.
//
// Set BOARD_FILE / ARCHIVE_FILE / REGISTRY_FILE / LANES_DIR to point elsewhere (tests).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The board lives in the MAIN checkout. From inside a lane worktree the branch's
// own copy is stale, so resolve the common git dir the way the lane CLI does.
function mainCheckout() {
  try {
    const common = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim();
    return path.dirname(common);
  } catch {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  }
}
const ROOT = mainCheckout();
const BOARD =
  process.env.BOARD_FILE ?? path.join(ROOT, '.claude/plans/vendor-marketplace-tickets.md');
const ARCHIVE =
  process.env.ARCHIVE_FILE ??
  path.join(ROOT, '.claude/plans/vendor-marketplace-tickets-archive.md');
const REGISTRY = process.env.REGISTRY_FILE ?? path.join(ROOT, 'packages/shared/src/env/tickets.ts');
const LANES = process.env.LANES_DIR ?? path.join(ROOT, '.claude/lanes');

const COLUMNS = [
  'id',
  'title',
  'phase',
  'milestone',
  'priority',
  'status',
  'branch',
  'blockedBy',
  'capabilities',
  'notes',
];
const ROW_START = /^\| \*{0,2}(\d+[a-z]?)\*{0,2} \|/;
const STATUSES = ['Backlog', 'In Progress', 'Done', 'Deferred — needs a human', 'Superseded'];

const strip = (s) =>
  s
    .trim()
    .replace(/^\*\*(.*)\*\*$/s, '$1')
    .trim();
const priorityRank = (p) => {
  const m = strip(p).match(/P(\d)/);
  return m ? Number(m[1]) : 9;
};

export function parseBoard(text) {
  const lines = text.split('\n');
  const rows = [];
  let inTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^## Status Board/.test(line)) {
      inTable = true;
      continue;
    }
    if (inTable && /^## /.test(line)) inTable = false;
    if (!inTable) continue;
    const m = line.match(ROW_START);
    if (!m) continue;
    let end = i;
    while (
      end + 1 < lines.length &&
      lines[end + 1].trim() !== '' &&
      !ROW_START.test(lines[end + 1]) &&
      !/^#/.test(lines[end + 1])
    )
      end++;
    const raw = lines.slice(i, end + 1).join('\n');
    const cells = raw.split('|').slice(1, -1); // drop the empty ends
    const row = { id: m[1], startLine: i, endLine: end, raw };
    COLUMNS.forEach((c, idx) => {
      if (c !== 'id') row[c] = cells[idx] === undefined ? '' : cells[idx];
    });
    row.statusText = strip(row.status);
    row.priorityRank = priorityRank(row.priority);
    row.blockers = [...strip(row.blockedBy).matchAll(/#(\d+[a-z]?)/g)].map((x) => x[1]);
    rows.push(row);
    i = end;
  }
  return { lines, rows };
}

function detailRange(lines, id) {
  const start = lines.findIndex((l) => new RegExp(`^### #${id}\\b`).test(l));
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && !/^##(#)? /.test(lines[end])) end++;
  return { start, end };
}

// A lane manifest marks a ticket as in flight even before its board row moves.
function activeLanes() {
  if (!existsSync(LANES)) return new Set();
  const ids = new Set();
  for (const f of readdirSync(LANES)) {
    if (!f.endsWith('.json')) continue;
    try {
      const m = JSON.parse(readFileSync(path.join(LANES, f), 'utf8'));
      if (m.state !== 'failed') ids.add(String(m.ticket ?? f.replace(/\.json$/, '')));
    } catch {
      ids.add(f.replace(/\.json$/, ''));
    }
  }
  return ids;
}

function load() {
  const board = parseBoard(readFileSync(BOARD, 'utf8'));
  const openIds = new Set(board.rows.map((r) => r.id));
  const lanes = activeLanes();
  for (const r of board.rows) {
    r.blockedByOpen = r.blockers.filter((b) => openIds.has(b));
    r.inLane = lanes.has(r.id);
    r.eligible =
      (r.statusText === 'Backlog' || r.statusText === 'In Progress') &&
      r.blockedByOpen.length === 0 &&
      !r.inLane;
  }
  return board;
}

function order(rows) {
  return [...rows].sort(
    (a, b) =>
      a.priorityRank - b.priorityRank ||
      (a.statusText === 'In Progress' ? -1 : 0) - (b.statusText === 'In Progress' ? -1 : 0) ||
      parseInt(a.id, 10) - parseInt(b.id, 10) ||
      a.id.localeCompare(b.id),
  );
}

function summary(r) {
  return {
    id: r.id,
    title: strip(r.title),
    priority: strip(r.priority),
    status: r.statusText,
    branch: strip(r.branch),
    blockedBy: r.blockers,
    blockedByOpen: r.blockedByOpen,
    capabilities: [...r.capabilities.matchAll(/`([a-z0-9]+)`/g)].map((x) => x[1]),
    inLane: r.inLane,
    eligible: r.eligible,
  };
}

function save(lines) {
  const tmp = BOARD + '.tmp';
  writeFileSync(tmp, lines.join('\n'));
  renameSync(tmp, BOARD);
}

function flag(args, name, fallback = null) {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  return args[i + 1] ?? fallback;
}

export function main(argv) {
  const [cmd, ...args] = argv;
  const json = args.includes('--json');
  const out = (obj, text) =>
    process.stdout.write((json ? JSON.stringify(obj, null, 2) : text) + '\n');

  if (cmd === 'depth') {
    const { rows } = load();
    const counts = {
      open: rows.length,
      ready: rows.filter((r) => r.eligible).length,
      inProgress: rows.filter((r) => r.statusText === 'In Progress').length,
      inLane: rows.filter((r) => r.inLane).length,
      blocked: rows.filter(
        (r) => r.blockedByOpen.length && r.statusText !== 'Deferred — needs a human',
      ).length,
      needsHuman: rows.filter((r) => r.statusText.startsWith('Deferred')).length,
    };
    return out(
      counts,
      `open ${counts.open} · ready ${counts.ready} · in progress ${counts.inProgress} · in a lane ${counts.inLane} · blocked ${counts.blocked} · needs a human ${counts.needsHuman}`,
    );
  }
  if (cmd === 'list') {
    let rows = order(load().rows);
    if (args.includes('--ready')) rows = rows.filter((r) => r.eligible);
    const items = rows.map(summary);
    return out(
      items,
      items
        .map(
          (r) =>
            `${r.id.padStart(4)}  ${r.priority.padEnd(12)} ${r.status.padEnd(26)} ${r.title}${r.blockedByOpen.length ? `  [blocked by #${r.blockedByOpen.join(' #')}]` : ''}${r.inLane ? '  [in a lane]' : ''}`,
        )
        .join('\n'),
    );
  }
  if (cmd === 'get') {
    const id = args[0];
    const { lines, rows } = load();
    const r = rows.find((x) => x.id === id);
    if (!r) {
      console.error(`no open row #${id} (closed rows live in ${path.basename(ARCHIVE)})`);
      process.exit(2);
    }
    const d = detailRange(lines, id);
    const detail = d ? lines.slice(d.start, d.end).join('\n') : '';
    return out(
      {
        ...summary(r),
        phase: strip(r.phase),
        milestone: strip(r.milestone),
        notes: strip(r.notes),
        detail,
      },
      `#${r.id} ${strip(r.title)}\npriority ${strip(r.priority)} · status ${r.statusText} · branch ${strip(r.branch)} · blocked by ${r.blockers.length ? '#' + r.blockers.join(' #') : 'none'} · capabilities ${r.capabilities.trim()}\n\nNotes: ${strip(r.notes)}\n\n${detail || '(no detail section)'}`,
    );
  }
  if (cmd === 'next') {
    const r = order(load().rows).find((x) => x.eligible);
    if (!r) {
      out({ status: 'QUEUE_EMPTY' }, 'QUEUE_EMPTY');
      process.exit(3);
    }
    return out(summary(r), `${r.id} ${strip(r.title)} (${strip(r.priority)}, ${r.statusText})`);
  }
  if (cmd === 'set') {
    const [id, status] = args;
    if (!STATUSES.includes(status)) {
      console.error(`status must be one of: ${STATUSES.join(' | ')}`);
      process.exit(64);
    }
    const { lines, rows } = load();
    const r = rows.find((x) => x.id === id);
    if (!r) {
      console.error(`no open row #${id}`);
      process.exit(2);
    }
    const cells = r.raw.split('|');
    cells[6] = ` **${status}** `;
    const branch = flag(args, '--branch');
    if (branch) cells[7] = ` \`${branch}\` `;
    const sha = flag(args, '--sha');
    const pr = flag(args, '--pr');
    const note = flag(args, '--note');
    const extra = [sha && `Landed \`${sha.slice(0, 8)}\``, pr && `(PR #${pr})`, note]
      .filter(Boolean)
      .join(' ');
    if (extra) cells[10] = `${cells[10].replace(/\s+$/, '')} ${extra} `;
    lines.splice(r.startLine, r.endLine - r.startLine + 1, ...cells.join('|').split('\n'));
    const d = detailRange(lines, id);
    if (d)
      for (let i = d.start; i < d.end; i++)
        lines[i] = lines[i].replace(/^(\*\*Status:\*\*\s*).*$/, `$1${status}`);
    save(lines);
    return out(
      { id, status, branch, sha, pr },
      `#${id} → ${status}${branch ? ` on ${branch}` : ''}${extra ? ` — ${extra}` : ''}`,
    );
  }
  if (cmd === 'add') {
    const title = args[0];
    if (!title || title.startsWith('--')) {
      console.error('add needs a title');
      process.exit(64);
    }
    const { lines, rows } = load();
    const archiveIds = existsSync(ARCHIVE)
      ? [...readFileSync(ARCHIVE, 'utf8').matchAll(/^\| \*{0,2}(\d+)\*{0,2} \|/gm)].map((m) =>
          Number(m[1]),
        )
      : [];
    const id = String(Math.max(0, ...rows.map((r) => parseInt(r.id, 10)), ...archiveIds) + 1);
    const caps = flag(args, '--capabilities', 'core')
      .split(/[\s,]+/)
      .filter(Boolean);
    const blockedBy = flag(args, '--blocked-by', 'None');
    const today = new Date().toISOString().slice(0, 10);
    const note = flag(args, '--note', `Filed ${today}.`);
    const row = `| **${id}** | **${title}** | ${flag(args, '--phase', 'P3')} | ${flag(args, '--milestone', 'M6')} | **${flag(args, '--priority', 'P2 Medium')}** | **Backlog** | — | **${blockedBy}** | ${caps.map((c) => `\`${c}\``).join(' ')} | **${note}** |`;
    const last = rows[rows.length - 1];
    lines.splice(last.endLine + 1, 0, row);
    const bodyFile = flag(args, '--body');
    const body = bodyFile
      ? readFileSync(bodyFile, 'utf8').trim()
      : '## Outcome\n\n(fill in)\n\n## Acceptance criteria\n\n- (fill in)';
    let insertAt = lines.length;
    const details = lines.findIndex((l) => /^## Ticket Details/.test(l));
    if (details >= 0) {
      insertAt = details + 1;
      while (insertAt < lines.length && !/^## /.test(lines[insertAt])) insertAt++;
    }
    lines.splice(insertAt, 0, '', `### #${id}: ${title}`, '', `**Status:** Backlog`, '', body, '');
    save(lines);
    if (existsSync(REGISTRY)) {
      const reg = readFileSync(REGISTRY, 'utf8').split('\n');
      let lastEntry = -1;
      reg.forEach((l, i) => {
        if (/^\s+\d+:\s*\[/.test(l)) lastEntry = i;
      });
      if (lastEntry >= 0) {
        const explicit = caps.filter((c) => c !== 'core' && c !== 'e2e');
        reg.splice(
          lastEntry + 1,
          0,
          `  ${id}: [${explicit.map((c) => `'${c}'`).join(', ')}], // ${title.replace(/\s+/g, ' ').slice(0, 80)}`,
        );
        writeFileSync(REGISTRY, reg.join('\n'));
      }
    }
    return out({ id, title }, `#${id} filed: ${title}`);
  }
  console.error(
    readFileSync(fileURLToPath(import.meta.url), 'utf8')
      .split('\n')
      .slice(1, 20)
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'),
  );
  process.exit(64);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2));
