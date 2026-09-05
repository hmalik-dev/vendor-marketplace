import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_CUSTOMER_BIO_LENGTH } from '@vendor-marketplace/shared';
import * as schemas from '@vendor-marketplace/shared';
import type { ZodType } from 'zod';
import { describe, expect, it } from 'vitest';

/**
 * #398, acceptance 4 — **every** free-text write path routes through the one
 * neutralisation, and nothing guards that by being remembered.
 *
 * `trimmedString` strips Unicode bidi controls at the parse boundary, before
 * the length checks, so a venue name carrying an override cannot reorder the
 * sentence around it on either party's screen. Twenty-odd fields use it. The
 * ones that did not were not wrong on purpose: each was written out as
 * `z.string().trim().min().max()` to carry its own error message or to allow an
 * empty value, and lost the strip by writing the chain by hand.
 *
 * That is the failure this file exists to catch, so it is deliberately **not** a
 * list of field names — a list is another thing to remember. It reads the
 * schemas the routes actually attach as request bodies, and parses a bidi
 * control through every string field of each.
 *
 * The schemas are discovered from the route files rather than named here, so a
 * new endpoint wiring an unprotected schema fails this test on the day it is
 * written, not on the day someone re-reads the file.
 *
 * **What it does not cover, deliberately:** a write path that is not a Fastify
 * request body. Names mirrored from Clerk are the live example — the account
 * holder types them, they reach the public vendor page through `reviewerName`,
 * and no route schema ever sees them. Those go through `mirroredClerkName` and
 * are covered by `modules/webhooks/clerk.routes.test.ts`. A new write path of
 * that shape needs its own guard; this one cannot see it.
 */
const MODULES = join(import.meta.dirname, 'modules');

/** `RIGHT-TO-LEFT OVERRIDE`, the one the sweep found stored and rendered. */
const RLO = '‮';

/** Long enough to satisfy a minimum length; short enough for every maximum. */
const PROBE = `${'a'.repeat(20)}${RLO}${'b'.repeat(20)}`;

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
    const source = readFileSync(file, 'utf8');

    for (const match of source.matchAll(/\bbody:\s*([A-Za-z][\w]*Schema)\b/g)) {
      found.add(match[1]!);
    }
  }

  return [...found].sort();
}

/**
 * Formats that are not prose and carry their own validator: an object key, a
 * slug, an email, a phone number, a URL. Compared by **reference** rather than
 * by field name, so a new field declared with one of them is excluded
 * automatically and a new field declared as a bare string is not.
 *
 * `imageRefSchema` is here because an image reference is a stored key that
 * `resolveImageUrl` turns into a URL, not text anybody reads. It does accept a
 * bidi control today — measured, not assumed — and that is deliberately **not**
 * filed as a defect: the value is percent-encoded into a URL and no surface
 * renders it as text, so it breaks image resolution rather than reordering
 * prose. Neutralising prose would be the wrong fix for it in any case.
 */
const CONSTRAINED_FORMATS: readonly unknown[] = [
  schemas.imageRefSchema,
  schemas.slugSchema,
  schemas.emailSchema,
  schemas.phoneSchema,
  schemas.urlSchema,
  schemas.calendarDateSchema,
  schemas.uuidSchema,
];

interface ZodDef {
  readonly type?: string;
  readonly innerType?: unknown;
  readonly shape?: Record<string, unknown>;
  readonly element?: unknown;
  readonly options?: readonly unknown[];
  readonly valueType?: unknown;
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
 * Every string leaf under a request body, with the path that reaches it.
 *
 * The traversal is the point. A first version read only the top-level shape,
 * and it missed both of the shapes this file most needed to check:
 * `availabilityEntrySchema.note` is nested inside the array
 * `availabilityBulkUpdateSchema.entries`, and `resolveTagSuggestionSchema` is a
 * discriminated union, so it has no `shape` at all and was skipped whole. Both
 * are vendor- and admin-written free text that reaches a stored row.
 */
function stringLeaves(schema: unknown, path: string, depth = 0): [string, unknown][] {
  if (depth > 6) {
    return [];
  }

  const inner = unwrap(schema);

  if (CONSTRAINED_FORMATS.includes(inner)) {
    return [];
  }

  const def = defOf(inner);

  if (def?.shape) {
    return Object.entries(def.shape).flatMap(([field, child]) =>
      stringLeaves(child, `${path}.${field}`, depth + 1),
    );
  }

  if (def?.options) {
    return def.options.flatMap((option, index) =>
      stringLeaves(option, `${path}[${index}]`, depth + 1),
    );
  }

  if (def?.element !== undefined) {
    return stringLeaves(def.element, `${path}[]`, depth + 1);
  }

  if (def?.valueType !== undefined) {
    return stringLeaves(def.valueType, `${path}{}`, depth + 1);
  }

  return def?.type === 'string' ? [[path, schema]] : [];
}

interface Probed {
  /** Leaves that parsed the probe and handed the control back. */
  readonly leaks: string[];
  /**
   * Leaves that refused the probe outright. Refusing is not passing: the field
   * was never tested, and a format schema that escapes `CONSTRAINED_FORMATS` by
   * being a clone — `calendarDateSchema.refine(…)` is one — lands here rather
   * than in the exclusion list. Held separately so the coverage is visible
   * instead of assumed.
   */
  readonly skipped: string[];
}

function probeRequestBodies(): Probed {
  const leaks: string[] = [];
  const skipped: string[] = [];

  for (const name of bodySchemaNames()) {
    for (const [path, leaf] of stringLeaves((schemas as Record<string, unknown>)[name], name)) {
      const parsed = (leaf as ZodType).safeParse(PROBE);

      if (!parsed.success) {
        skipped.push(path);
        continue;
      }

      if (typeof parsed.data === 'string' && parsed.data.includes(RLO)) {
        leaks.push(path);
      }
    }
  }

  return { leaks, skipped };
}

describe('free text on a request body', () => {
  /*
   * Guards the guard twice over: a regex that matched no routes, or a set of
   * schemas none of which had a string field, would pass every assertion below
   * while checking nothing.
   */
  it('finds the request bodies it is meant to be checking', () => {
    const names = bodySchemaNames();

    // Pinned, not a floor: a change that halved discovery would pass a floor.
    expect(names).toHaveLength(20);
    expect(names).toContain('createVendorProfileSchema');
    expect(names).toContain('createBookingRequestSchema');

    for (const name of names) {
      expect((schemas as Record<string, unknown>)[name], `${name} is not exported`).toBeDefined();
    }
  });

  /*
   * The traversal, not just the list. Both of these are free text that reaches
   * a stored row and neither is a top-level string field, so a walker that
   * only read `def.shape` would report a clean run having checked neither.
   */
  it('reaches through arrays and discriminated unions to the text inside', () => {
    const paths = bodySchemaNames().flatMap((name) =>
      stringLeaves((schemas as Record<string, unknown>)[name], name).map(([path]) => path),
    );

    expect(paths).toContain('availabilityBulkUpdateSchema.entries[].note');
    expect(paths).toContain('resolveTagSuggestionSchema[0].adminNote');
    expect(paths).toContain('createVendorProfileSchema.bio');
    // The excluded formats are excluded by reference, not by name.
    expect(paths).not.toContain('createPortfolioItemSchema.imageUrl');
  });

  it('strips bidi controls from every free-text field', () => {
    expect(probeRequestBodies().leaks).toEqual([]);
  });

  /*
   * The probe clears every minimum and sits under every maximum in scope — the
   * tightest is `tagline` at 80 — so a leaf that refuses it is refusing on
   * *format*, and the two that do are both dates. Named rather than tolerated:
   * a field that starts refusing the probe stops being checked, and would
   * otherwise leave no trace of having dropped out.
   */
  it('leaves only the two date formats untested', () => {
    expect(probeRequestBodies().skipped).toEqual([
      'createBookingRequestSchema.eventDate',
      'createBookingRequestSchema.eventStartTime',
    ]);
  });

  /*
   * The strip has to happen before the length checks, or a string padded out
   * with invisible controls buys itself characters against the maximum.
   */
  it('measures length after stripping, not before', () => {
    /*
     * The payload has to exceed the maximum *before* the strip and clear it
     * after, or the assertion passes under either ordering: 200 characters
     * against a 300 maximum proves nothing, because neither order rejects it.
     * 290 visible characters plus 40 controls is 330, so a schema that
     * measured first would refuse the very string it is supposed to accept.
     */
    const bio = 'x'.repeat(MAX_CUSTOMER_BIO_LENGTH - 10);
    const padded = `${bio}${RLO.repeat(40)}`;

    expect(padded.length).toBeGreaterThan(MAX_CUSTOMER_BIO_LENGTH);

    const parsed = schemas.updateUserSchema.safeParse({ bio: padded });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.bio).toBe(bio);
  });
});
