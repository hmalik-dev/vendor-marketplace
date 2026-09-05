import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as schemas from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';

/**
 * #407, acceptance 3 — **every** write path that accepts a client-supplied
 * object key asserts the key belongs to the caller, and nothing guards that by
 * being remembered.
 *
 * `imageRefSchema` accepts a bare object key, and every public vendor page
 * hands out the keys it renders, so a signed-in caller can name someone else's
 * key. The damage is not only the borrowed image: `findUnreferencedKeys` counts
 * the borrowed row as a live reference, so the owner's own delete finds the
 * object still referenced and leaves it in the bucket, served for ever, with no
 * way for them to remove it. `assertOwnedImageRefs` refuses the reference where
 * it is created; this file is what stops the next endpoint forgetting to call
 * it.
 *
 * Modelled on `request-body-free-text.test.ts`, and for the same reason: the
 * rule is one every future write path has to follow, and a paragraph asking
 * someone to remember is not a guarantee. The schemas are **discovered** from
 * the route files, so a new endpoint accepting an image reference fails here on
 * the day it is written; the guarded set below is pinned rather than derived,
 * so the discovery going stale fails too.
 *
 * The discovery reads a named `body:` schema, which is what every route in the
 * repository uses. The first test refuses the one shape it cannot see — a route
 * declaring its body inline — rather than leaving that as a silent gap.
 *
 * **What it does not cover, deliberately:** a write path that is not a Fastify
 * request body. `syncCoverFromPortfolio` copies a key the vendor already owns
 * from one of their own rows onto another, and the seeds write keys directly.
 * Neither takes a key from a caller, so neither is in scope.
 */
const MODULES = join(import.meta.dirname, 'modules');

/**
 * Which service owns each body schema's write, and therefore where the
 * assertion has to appear. Pinned on purpose — the discovery below fails when
 * this list stops matching the routes, which is the half that cannot be
 * forgotten.
 */
const GUARDED_BY: Record<string, string> = {
  updateUserSchema: 'modules/users/users.service.ts',
  createVendorProfileSchema: 'modules/vendors/vendors.service.ts',
  updateVendorProfileSchema: 'modules/vendors/vendors.service.ts',
  createPortfolioItemSchema: 'modules/portfolio/portfolio.service.ts',
};

function routeFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);

    if (statSync(full).isDirectory()) {
      return routeFiles(full);
    }

    return entry.endsWith('.routes.ts') ? [full] : [];
  });
}

/** Every schema name a route hands Fastify as its request body. */
function bodySchemaNames(): string[] {
  const found = new Set<string>();

  for (const file of routeFiles(MODULES)) {
    for (const match of readFileSync(file, 'utf8').matchAll(/\bbody:\s*([A-Za-z][\w]*Schema)\b/g)) {
      found.add(match[1]!);
    }
  }

  return [...found].sort();
}

interface ZodDef {
  readonly type?: string;
  readonly innerType?: unknown;
  readonly shape?: Record<string, unknown>;
  readonly element?: unknown;
  readonly options?: readonly unknown[];
}

function defOf(schema: unknown): ZodDef | undefined {
  return (schema as { def?: ZodDef } | undefined)?.def;
}

/** Peels `.optional()`, `.nullable()`, `.nullish()` and `.default()`. */
function unwrap(schema: unknown): unknown {
  let current = schema;

  for (let hop = 0; hop < 8; hop += 1) {
    const inner = defOf(current)?.innerType;

    if (inner === undefined) {
      return current;
    }

    current = inner;
  }

  return current;
}

/**
 * The field names under `schema` declared with `imageRefSchema`.
 *
 * Compared by **reference**, the way `request-body-free-text.test.ts` compares
 * its excluded formats: a field declared as a bare string is not an image
 * reference and needs no owner check, and one declared with the shared schema
 * is one however it is named.
 */
function imageRefFields(schema: unknown, depth = 0): string[] {
  if (depth > 6) {
    return [];
  }

  const inner = unwrap(schema);
  const def = defOf(inner);

  if (def?.shape) {
    return Object.entries(def.shape).flatMap(([field, child]) =>
      unwrap(child) === schemas.imageRefSchema ? [field] : imageRefFields(child, depth + 1),
    );
  }

  if (def?.options) {
    return def.options.flatMap((option) => imageRefFields(option, depth + 1));
  }

  if (def?.element !== undefined) {
    return imageRefFields(def.element, depth + 1);
  }

  return [];
}

/** The body schemas that accept an object key, with the fields that carry one. */
function schemasAcceptingKeys(): Record<string, string[]> {
  const found: Record<string, string[]> = {};

  for (const name of bodySchemaNames()) {
    const fields = imageRefFields((schemas as Record<string, unknown>)[name]);

    if (fields.length > 0) {
      found[name] = fields.sort();
    }
  }

  return found;
}

/** The arguments of every `assertOwnedImageRefs([...])` call in a service. */
function guardedFieldsIn(relativePath: string): string[] {
  const source = readFileSync(join(import.meta.dirname, relativePath), 'utf8');
  const fields = new Set<string>();

  for (const call of source.matchAll(/assertOwnedImageRefs\(\[([^\]]*)\]/g)) {
    for (const field of call[1]!.matchAll(/input\.(\w+)/g)) {
      fields.add(field[1]!);
    }
  }

  return [...fields];
}

describe('object keys on a request body', () => {
  /*
   * The discovery reads `body: <name>Schema`, so a route declaring its body
   * inline — `body: z.object({ imageUrl: imageRefSchema })` — would be invisible
   * to it and would ship unguarded while every assertion below still passed.
   * Rather than widen the parser to handle an expression, refuse the shape: a
   * route file that reaches for `imageRefSchema` directly is one whose body this
   * file cannot see.
   */
  it('finds no route declaring an image reference inline', () => {
    const inline = routeFiles(MODULES).filter((file) =>
      readFileSync(file, 'utf8').includes('imageRefSchema'),
    );

    expect(inline).toEqual([]);
  });

  /*
   * Guards the guard: a regex that matched no routes, or a traversal that found
   * no image references, would pass every assertion below having checked
   * nothing. Pinned rather than a floor, so a change that halves discovery
   * fails here instead of passing quietly.
   */
  it('finds the request bodies that accept an object key', () => {
    expect(schemasAcceptingKeys()).toEqual({
      createPortfolioItemSchema: ['imageUrl', 'thumbnailUrl'],
      createVendorProfileSchema: ['coverImageUrl', 'profileImageUrl'],
      updateUserSchema: ['avatarUrl'],
      updateVendorProfileSchema: ['coverImageUrl', 'profileImageUrl'],
    });
  });

  /*
   * The half that catches a *new* endpoint. A route body carrying an image
   * reference with no entry here is one nobody has decided where to guard.
   */
  it('has a guarded write path for every one of them', () => {
    expect(Object.keys(schemasAcceptingKeys()).sort()).toEqual(Object.keys(GUARDED_BY).sort());
  });

  /*
   * And the half that catches an *existing* schema growing a field: the guard
   * has to name every image reference the body accepts, not the ones it had
   * when it was written.
   */
  it('asserts ownership of every key field each body accepts', () => {
    for (const [name, fields] of Object.entries(schemasAcceptingKeys())) {
      const guarded = guardedFieldsIn(GUARDED_BY[name]!);

      for (const field of fields) {
        expect(guarded, `${name}.${field} is not passed to assertOwnedImageRefs`).toContain(field);
      }
    }
  });
});
