import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { expectedMigrationCount } from './migrations.js';
import { MIGRATIONS_FOLDER } from './testing/test-db.js';

describe('expectedMigrationCount', () => {
  it('equals the number of migration files the folder ships', () => {
    const files = readdirSync(MIGRATIONS_FOLDER).filter((name) => name.endsWith('.sql'));

    expect(expectedMigrationCount()).toBe(files.length);
  });

  /*
   * The API reads the journal at boot, and the image gets it only through the
   * package's `files` list, so dropping `drizzle` from it would crash-loop every
   * deploy with the whole suite green.
   */
  it('ships the migrations folder in the published package', () => {
    const manifest = JSON.parse(
      readFileSync(path.join(MIGRATIONS_FOLDER, '..', 'package.json'), 'utf8'),
    ) as { files: string[] };

    expect(manifest.files).toContain('drizzle');
  });
});
