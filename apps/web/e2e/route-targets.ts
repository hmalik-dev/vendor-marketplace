import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { E2E_VENDOR_SLUG } from './fixtures-data.js';

/**
 * Every URL the route-landing sweep visits, **read out of the source** (VEN-379).
 *
 * A hand-maintained list is the thing this replaces: the sweep that found the
 * no-row dead end carried 32 literals, and a route added the next day would
 * have been outside it with nothing failing to say so. Two sources, both walked
 * on every run:
 *
 * - every App Router segment that renders or answers — a `page.tsx` or a
 *   `route.ts` — with route groups and optional catch-alls collapsed the way
 *   Next collapses them, and a required dynamic segment filled with a sample;
 * - every **literal** redirect destination the app names: `redirect('/…')`,
 *   `NextResponse.redirect(new URL('/…'`, `pathReturningTo('/…'`, the
 *   role tables' `role: '/…'` entries, and the shared `…_PATH` constants.
 *
 * A destination that is not a real route — a typo'd `redirect('/dashbaord')` —
 * becomes a target of its own and the sweep visits it, so the enumeration is
 * what reaches the defect rather than a reviewer's memory.
 */
export interface RouteTarget {
  /** The pathname visited, e.g. `/vendors/e2e-test-studio/request`. */
  path: string;
  /** Repository-relative files that produced it — a segment's file, or each redirect's caller. */
  sources: string[];
  /** A segment's own URL, a literal redirect destination, or both. */
  kinds: Array<'segment' | 'redirect'>;
  /**
   * A dynamic segment was filled with a value no fixture guarantees exists, so
   * `notFound()` is a correct answer rather than a dead route.
   */
  sampled: boolean;
}

export interface RouteTargetRoots {
  /** `apps/web/src/app`. */
  appDir: string;
  /** `apps/web/src` — where redirects are written. */
  webSourceDir: string;
  /** `packages/shared/src/constants`. */
  sharedConstantsDir: string;
  /** Paths in `sources` are made relative to this. */
  repoRoot: string;
}

/** A uuid-shaped id that no seed writes, for `[requestId]`, `[caseId]` and `[userId]`. */
export const SAMPLE_ID = '00000000-0000-4000-8000-000000000000';

function walk(directory: string, collected: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);

    if (statSync(absolute).isDirectory()) {
      walk(absolute, collected);
    } else {
      collected.push(absolute);
    }
  }

  return collected;
}

const IS_TEST = /\.(?:test|spec)\.tsx?$/;

/**
 * The URL a route file answers at, or `null` when the file is not addressable.
 *
 * `_private` folders are opted out of routing by Next; `(group)` and `@slot`
 * add no segment; `[[...optional]]` matches its parent's own URL.
 */
function segmentPath(appDir: string, file: string): { path: string; sampled: boolean } | null {
  const name = file.split(sep).pop() ?? '';

  if (name !== 'page.tsx' && name !== 'route.ts') {
    return null;
  }

  const segments = relative(appDir, file).split(sep).slice(0, -1);
  const parts: string[] = [];
  let sampled = false;

  for (const [index, segment] of segments.entries()) {
    if (segment.startsWith('_')) {
      return null;
    }

    if (/^\(.*\)$/.test(segment) || segment.startsWith('@') || /^\[\[\.\.\..+\]\]$/.test(segment)) {
      continue;
    }

    if (/^\[.+\]$/.test(segment)) {
      /*
       * The storefront is the one dynamic segment a fixture guarantees, and
       * the booking request form under it is the #401 gate — so it gets the
       * seeded vendor, not a sample that would 404 before any gate ran.
       */
      if (segment === '[slug]' && segments[index - 1] === 'vendors') {
        parts.push(E2E_VENDOR_SLUG);
      } else {
        parts.push(SAMPLE_ID);
        sampled = true;
      }
      continue;
    }

    parts.push(segment);
  }

  return { path: `/${parts.join('/')}`, sampled };
}

/** A literal path, with its query and fragment dropped — the sweep visits pathnames. */
function pathnameOf(literal: string): string {
  return literal.split(/[?#]/, 1)[0] ?? literal;
}

/*
 * Literal destinations only. A template with an interpolation is a destination
 * computed from data — a returnTo, a slug — and is exercised by the cells that
 * carry one, not by guessing a value here.
 */
const REDIRECT_CALLS = [
  /\bredirect\(\s*(['"`])(\/[^'"`$]*)\1/g,
  /\bNextResponse\.redirect\(\s*new URL\(\s*(['"`])(\/[^'"`$]*)\1/g,
  /\bpathReturningTo\(\s*(['"`])(\/[^'"`$]*)\1/g,
  /^\s*(?:customer|vendor|admin):\s*(['"`])(\/[^'"`$]*)\1/gm,
];

/*
 * Comments out first: prose here quotes retired destinations by design
 * ("`/customer/dashboard` used to…"), and a sweep that visited those would
 * fail on history rather than on code.
 */
export function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** The literal pathnames a source file redirects to. */
export function literalRedirectDestinations(code: string): string[] {
  const stripped = stripComments(code);

  return REDIRECT_CALLS.flatMap((pattern) =>
    [...stripped.matchAll(pattern)].map((match) => pathnameOf(match[2] ?? '')),
  );
}

const SHARED_PATH_CONSTANT = /^export const [A-Z_]+_PATH = (['"`])(\/[^'"`$]*)\1/gm;

export function enumerateRouteTargets(roots: RouteTargetRoots): RouteTarget[] {
  const targets = new Map<string, RouteTarget>();

  const add = (
    path: string,
    source: string,
    kind: 'segment' | 'redirect',
    sampled = false,
  ): void => {
    const existing = targets.get(path);
    const relativeSource = relative(roots.repoRoot, source);

    if (!existing) {
      targets.set(path, { path, sources: [relativeSource], kinds: [kind], sampled });
      return;
    }

    if (!existing.sources.includes(relativeSource)) existing.sources.push(relativeSource);
    if (!existing.kinds.includes(kind)) existing.kinds.push(kind);
  };

  for (const file of walk(roots.appDir)) {
    const segment = segmentPath(roots.appDir, file);
    if (segment) add(segment.path, file, 'segment', segment.sampled);
  }

  for (const file of walk(roots.webSourceDir).filter(
    (candidate) => /\.tsx?$/.test(candidate) && !IS_TEST.test(candidate),
  )) {
    for (const destination of literalRedirectDestinations(readFileSync(file, 'utf8'))) {
      add(destination, file, 'redirect');
    }
  }

  for (const file of walk(roots.sharedConstantsDir).filter(
    (candidate) => candidate.endsWith('.ts') && !IS_TEST.test(candidate),
  )) {
    for (const match of readFileSync(file, 'utf8').matchAll(SHARED_PATH_CONSTANT)) {
      add(pathnameOf(match[2] ?? ''), file, 'redirect');
    }
  }

  return [...targets.values()].sort((a, b) => a.path.localeCompare(b.path));
}
