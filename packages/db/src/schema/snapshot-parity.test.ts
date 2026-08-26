import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AVAILABILITY_STATUSES,
  BOOKING_REQUEST_STATUSES,
  BOOKING_STATUSES,
  BUDGET_TIERS,
  PRICE_TYPES,
  REVIEW_TYPES,
  TAG_CATEGORIES,
  TAG_SUGGESTION_STATUSES,
  USER_ROLES,
} from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';

const DRIZZLE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../drizzle/meta',
);

interface Snapshot {
  readonly enums: Record<string, { readonly name: string; readonly values: string[] }>;
}

function latestSnapshot(): { file: string; snapshot: Snapshot } {
  const files = readdirSync(DRIZZLE_DIR)
    .filter((name) => name.endsWith('_snapshot.json'))
    .sort();
  const file = files.at(-1);

  if (!file) {
    throw new Error('No drizzle snapshot found.');
  }

  return {
    file,
    snapshot: JSON.parse(readFileSync(path.join(DRIZZLE_DIR, file), 'utf8')) as Snapshot,
  };
}

/**
 * A hand-authored migration — an enum `RENAME VALUE`, a data backfill — does not
 * update the drizzle snapshot beside it. When the two disagree, the next
 * `pnpm db:generate` "corrects" the difference by dropping and recreating the
 * type, which is both destructive and slow enough to time out the PGlite suites.
 *
 * That happened once, in 0003: the snapshot kept `religious_dietary` after the
 * migration renamed it to `dietary`. These assertions are what catches it next
 * time, at the point the snapshot is committed rather than months later.
 */
describe('drizzle snapshot parity', () => {
  const { file, snapshot } = latestSnapshot();

  const cases: readonly { readonly enumName: string; readonly values: readonly string[] }[] = [
    { enumName: 'tag_category', values: TAG_CATEGORIES },
    { enumName: 'user_role', values: USER_ROLES },
    { enumName: 'booking_status', values: BOOKING_STATUSES },
    { enumName: 'booking_request_status', values: BOOKING_REQUEST_STATUSES },
    { enumName: 'availability_status', values: AVAILABILITY_STATUSES },
    { enumName: 'review_type', values: REVIEW_TYPES },
    { enumName: 'budget_tier', values: BUDGET_TIERS },
    { enumName: 'price_type', values: PRICE_TYPES },
    { enumName: 'tag_suggestion_status', values: TAG_SUGGESTION_STATUSES },
  ];

  it.each(cases)(
    'records $enumName exactly as the shared constant declares',
    ({ enumName, values }) => {
      const recorded = snapshot.enums[`public.${enumName}`];

      expect(recorded, `${enumName} missing from ${file}`).toBeDefined();
      expect(recorded?.values, `${enumName} drifted in ${file}`).toEqual([...values]);
    },
  );

  it('covers every enum the snapshot carries, so a new one cannot slip through', () => {
    const recorded = Object.keys(snapshot.enums)
      .map((key) => key.replace(/^public\./, ''))
      .sort();
    const asserted = cases.map((entry) => entry.enumName).sort();

    expect(recorded).toEqual(asserted);
  });
});
