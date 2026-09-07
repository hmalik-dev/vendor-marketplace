import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withoutComments } from '@/testing/source-scan';

/**
 * **A function exported from a `'use client'` module may be rendered or passed,
 * never called from the server.**
 *
 * React draws the boundary at the module: everything a `'use client'` file
 * exports becomes a client reference, and invoking one during a server render
 * throws *"Attempted to call X() from the server but X is on the client"* —
 * which takes the whole route to the error boundary. A pure helper sitting
 * beside the component it belongs to is the easy way in, because it looks like
 * shared code and reads like shared code.
 *
 * It cost `/` its entire signed-in composition: `hasStatusStrip` lived in
 * `status-strip.tsx` and `page.tsx` asked it whether to render the strip.
 * **The unit suite was green** — jsdom does not enforce the boundary, so both
 * files were exercised and neither complained. A browser pass found it.
 *
 * This is the guard the suite was missing rather than a second copy of one:
 * `viewer-today-guard.test.ts` polices which files may read the viewer's day,
 * and this polices which files may *call* across the boundary at all.
 */
const WEB_SOURCE = resolve(import.meta.dirname, '..');

/** `'use client'` or `"use client"`, as the very first statement in the file. */
const USE_CLIENT = /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use client['"]/;

/** Helpers only tests import — they never reach a bundle. */
const TEST_ONLY = 'testing';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const path = join(directory, item.name);

    if (item.isDirectory()) {
      return item.name === TEST_ONLY ? [] : sourceFiles(path);
    }

    return /\.tsx?$/.test(item.name) && !/\.test\.tsx?$/.test(item.name) ? [path] : [];
  });
}

/** Every relative or `@/`-aliased import in a file, as `{ names, specifier }`. */
function localImports(code: string): { names: string[]; specifier: string }[] {
  return [...code.matchAll(/import\s+(?!type\b)([^;]*?)\s+from\s+['"]([^'"]+)['"]/g)]
    .filter(([, , specifier]) => /^[.@]/.test(specifier as string))
    .map(([, clause, specifier]) => ({
      /*
       * Named bindings only. A default or namespace import of a client module
       * is a component or a namespace object, and neither is the call this
       * guard is about. `type` specifiers are erased before the bundle, so a
       * type imported across the boundary is not a client reference.
       */
      names: [...(clause as string).matchAll(/\{([^}]*)\}/g)]
        .flatMap((match) => (match[1] as string).split(','))
        .map((binding) => binding.trim())
        .filter((binding) => binding.length > 0 && !binding.startsWith('type '))
        .map((binding) => (binding.split(/\s+as\s+/).at(-1) as string).trim()),
      specifier: specifier as string,
    }));
}

/** Where an import specifier actually lands, or `null` when it is a package. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  const base = specifier.startsWith('@/')
    ? join(WEB_SOURCE, specifier.slice(2))
    : join(dirname(fromFile), specifier);

  for (const candidate of [
    `${base}.tsx`,
    `${base}.ts`,
    join(base, 'index.tsx'),
    join(base, 'index.ts'),
  ]) {
    try {
      readFileSync(candidate, 'utf8');
      return candidate;
    } catch {
      // Not this extension; try the next.
    }
  }

  return null;
}

describe('the client boundary', () => {
  it('is never called across from a server module', () => {
    const offenders: string[] = [];

    for (const path of sourceFiles(WEB_SOURCE)) {
      const source = readFileSync(path, 'utf8');

      // A client module calling another client module's export is fine.
      if (USE_CLIENT.test(source)) {
        continue;
      }

      const code = withoutComments(source);

      for (const { names, specifier } of localImports(code)) {
        const target = resolveSpecifier(path, specifier);

        if (target === null || !USE_CLIENT.test(readFileSync(target, 'utf8'))) {
          continue;
        }

        for (const name of names) {
          /*
           * A call, not a mention. `<Strip ... />` and `prop={Strip}` are both
           * legal and neither is followed by `(`; `hasStatusStrip(status)` is
           * the shape that throws at render time.
           */
          if (new RegExp(String.raw`\b${name}\s*\(`).test(code)) {
            offenders.push(
              `${path.slice(WEB_SOURCE.length + 1)} calls ${name}() from ${specifier}`,
            );
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  /* The guard has to be able to see a call, or it passes on everything. */
  it('recognises a call across the boundary when there is one', () => {
    const clientModule = "'use client';\nexport function helper() {}\n";
    const serverModule = "import { helper } from './x';\nhelper();\n";

    expect(USE_CLIENT.test(clientModule)).toBe(true);
    expect(USE_CLIENT.test(serverModule)).toBe(false);
    expect(localImports(serverModule)).toEqual([{ names: ['helper'], specifier: './x' }]);
    expect(/\bhelper\s*\(/.test(serverModule)).toBe(true);
  });
});
