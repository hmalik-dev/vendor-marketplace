import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * VEN-673. These modules read secrets, cookies or the API with a session, and
 * were kept out of the client bundle by convention only. `import 'server-only'`
 * makes the build refuse a `'use client'` file that reaches them.
 *
 * `api-client.ts` is shared with client code on purpose and is not listed.
 */
const SERVER_ONLY_MODULES = [
  'auth/server.ts',
  'visitor-address.ts',
  'admin-export.ts',
  'current-user.ts',
  'admin-data.ts',
  'customer-data.ts',
  'legal-data.ts',
  'messaging-data.ts',
  'vendor-data.ts',
];

/** The first import statement in a file, skipping comments and directives. */
function firstImport(source: string): string | undefined {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return withoutComments.match(/^\s*import\s[^;]*;/m)?.[0].trim();
}

describe('server-only modules are fenced from the client bundle', () => {
  it.each(SERVER_ONLY_MODULES)('%s imports server-only first', (module) => {
    const source = readFileSync(join(process.cwd(), 'src/lib', module), 'utf8');

    expect(firstImport(source)).toBe("import 'server-only';");
  });

  it('reads the first import past a leading comment and a following import', () => {
    expect(firstImport("/* note */\nimport 'server-only';\nimport { a } from 'b';")).toBe(
      "import 'server-only';",
    );
    expect(firstImport("import { a } from 'b';\nimport 'server-only';")).toBe(
      "import { a } from 'b';",
    );
  });
});
