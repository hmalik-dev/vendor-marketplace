import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CAPABILITIES, isCapability } from './capabilities.js';
import { HIGHEST_REGISTERED_TICKET, TICKET_CAPABILITIES } from './tickets.js';

/**
 * The guard #63 asked for.
 *
 * `TICKET_CAPABILITIES` mirrors the Capabilities column of the Status Board, and
 * for 192 rows nothing tied the two together — the registry stopped at #37 while
 * the board reached #229, so `pnpm preflight --ticket <n>` could not be run for
 * any ticket filed in between. A written reminder is what failed the first time,
 * so the tie is a test: file a ticket on the board and this goes red until the
 * registry row exists and agrees.
 */

const TRACKER = fileURLToPath(
  new URL('../../../../.claude/plans/vendor-marketplace-tickets.md', import.meta.url),
);

/**
 * Closed rows moved out of the tracker on 2026-08-30, when it had reached 13,500
 * lines and 311 of its 334 rows were finished work. They are still board rows and
 * still have to agree with the registry — `pnpm preflight --ticket <old n>` is run
 * from older branches and commit messages every week — so this test reads both
 * files and does not care which one a row lives in.
 */
const ARCHIVE = fileURLToPath(
  new URL('../../../../.claude/plans/vendor-marketplace-tickets-archive.md', import.meta.url),
);

/** `core` and `e2e` are implicit on every ticket: the board writes them, the registry omits them. */
const IMPLICIT: readonly string[] = ['core', 'e2e'];

function explicit(tokens: Iterable<string>): string[] {
  return [...new Set(tokens)].filter((token) => !IMPLICIT.includes(token)).sort();
}

interface BoardRow {
  readonly ticket: number;
  /** Capability tokens as written on the board, `core` and `e2e` included. */
  readonly declared: readonly string[];
}

/**
 * Parses the Status Board table out of the tracker **and** the closed archive.
 * Rows added after #64 wrap every cell in `**`, and lettered splits (`6a`, `22b`)
 * share their parent's number, exactly as the registry's own docstring describes.
 */
function readBoard(path: string): readonly BoardRow[] {
  const rows: BoardRow[] = [];

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const cells = line.split('|');
    if (cells.length < 11) continue;

    const id = (cells[1] ?? '').replaceAll('*', '').trim();
    if (!/^\d+[a-z]?$/.test(id)) continue;

    // Two rows (#14, #19) write the literal `all` instead of listing every
    // token, which is why this reads the cell rather than only its backticks.
    const cell = (cells[9] ?? '').replaceAll('*', '').trim();
    const declared: readonly string[] =
      cell === 'all'
        ? [...CAPABILITIES]
        : [...cell.matchAll(/`([a-z0-9]+)`/g)].flatMap((match) => match[1] ?? []);

    rows.push({ ticket: Number.parseInt(id, 10), declared });
  }

  return rows;
}

describe('the ticket registry against the status board', () => {
  const openRows = readBoard(TRACKER);
  const archivedRows = readBoard(ARCHIVE);
  const board = [...openRows, ...archivedRows];

  it('finds the status board where the project convention says it is', () => {
    expect(board.length).toBeGreaterThan(200);
  });

  it('reads the open tracker and the closed archive, not just whichever is larger', () => {
    // The archive holds the overwhelming majority of rows, so a tracker repointed at
    // a file with no board in it would still leave `board.length` over 200 and this
    // suite green while every *open* ticket silently left the gate. Assert both
    // files contribute, with the same parser the rest of this suite uses.
    expect(
      openRows.length,
      'the tracker contributed no board rows — has it moved?',
    ).toBeGreaterThan(0);
    expect(
      archivedRows.length,
      'the archive contributed no board rows — has it moved?',
    ).toBeGreaterThan(0);
  });

  it('declares a row for every ticket on the board', () => {
    const missing = board
      .map((row) => row.ticket)
      .filter((ticket) => !Object.hasOwn(TICKET_CAPABILITIES, ticket));

    expect(
      [...new Set(missing)].sort((a, b) => a - b),
      'file the missing rows in tickets.ts — preflight cannot gate these tickets',
    ).toEqual([]);
  });

  it('keeps the registry from falling behind the highest ticket on the board', () => {
    const highestOnBoard = board.reduce((highest, row) => Math.max(highest, row.ticket), 0);

    expect(HIGHEST_REGISTERED_TICKET).toBeGreaterThanOrEqual(highestOnBoard);
  });

  it('uses only real capability names in the board Capabilities column', () => {
    // The board said `payments` for #67 and #68 where the registry calls it
    // `stripe`. A name that is not a capability silently declares nothing.
    const unknown = board.flatMap((row) =>
      row.declared
        .filter((token) => !isCapability(token))
        .map((token) => `#${row.ticket}: ${token}`),
    );

    expect([...new Set(unknown)]).toEqual([]);
  });

  it('declares in the registry exactly what the board declares', () => {
    // `core` and `e2e` are implicit on every ticket, so the board writes them and
    // the registry omits them. Lettered splits fold onto the parent number, and a
    // split never changes which services the work needs, so the union must agree.
    const wanted = new Map<number, Set<string>>();

    for (const row of board) {
      const entry = wanted.get(row.ticket) ?? new Set<string>();
      for (const token of explicit(row.declared)) entry.add(token);
      wanted.set(row.ticket, entry);
    }

    const disagreements: string[] = [];

    for (const [ticket, expected] of wanted) {
      const declared = TICKET_CAPABILITIES[ticket];
      if (!declared) continue; // already reported by the missing-rows test

      const registry = explicit(declared).join(' ');
      const boardSide = explicit(expected).join(' ');

      if (registry !== boardSide) {
        disagreements.push(`#${ticket}: board [${boardSide}] vs registry [${registry}]`);
      }
    }

    expect(disagreements.sort()).toEqual([]);
  });
});
