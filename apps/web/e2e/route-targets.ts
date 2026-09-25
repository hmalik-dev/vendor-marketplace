import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

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

const SESSION_BINDING = /\b(?:const|let)\s+(\w+)\s*=\s*await\s+getServerSession\(\)/g;

/** What follows the empty-session test: a `redirect(`, braced or not, returned or not. */
const THEN_REDIRECT = String.raw`\s*\)\s*\{?\s*(?:return\s+)?redirect\(`;

/** The two gates every other one wraps: each redirects a caller with no usable session. */
const DIRECT_SESSION_GATES: ReadonlySet<string> = new Set(['requireCurrentUser', 'requireRole']);

/** A top-level `function` or `const` declaration, exported or file-local. */
const DECLARATION = /^(export\s+)?(?:(?:async\s+)?function\s+(\w+)|const\s+(\w+)\s*=)/gm;

function callsAny(code: string, names: Iterable<string>): boolean {
  return [...names].some((name) => new RegExp(String.raw`\b${name}\(`).test(code));
}

interface Declaration {
  name: string;
  exported: boolean;
  /** The source from this declaration's line up to the next top-level one. */
  body: string;
}

/** Every top-level `function`/`const` declaration in a file, exported or file-local. */
function declarationsIn(file: string): Declaration[] {
  const code = stripComments(readFileSync(file, 'utf8'));
  const starts = [...code.matchAll(DECLARATION)];
  return starts.map((match, index) => ({
    name: match[2] ?? match[3] ?? '',
    exported: match[1] !== undefined,
    body: code.slice(match.index, starts[index + 1]?.index ?? code.length),
  }));
}

/**
 * Every `src/lib` helper that refuses a caller without a session because it
 * calls a gate on the way — `requireNonAdmin` wrapping `requireCurrentUser`,
 * `gateCheckout` reaching `requireRole` through a file-local `cache()`d helper
 * (VEN-757). Resolved from the source to a fixed point rather than listed, so
 * the next wrapper reads as a gate without anyone adding it here.
 *
 * A file-local helper counts only inside its own file: the same name
 * elsewhere is a different function.
 */
export function sessionGateNames(libDir: string): Set<string> {
  const filesDeclarations = walk(libDir)
    .filter((file) => /\.tsx?$/.test(file) && !IS_TEST.test(file))
    .map(declarationsIn);
  const gates = new Set(DIRECT_SESSION_GATES);

  let gatesChanged = true;
  while (gatesChanged) {
    gatesChanged = false;
    for (const declarations of filesDeclarations) {
      const local = new Set<string>();
      let localChanged = true;
      while (localChanged) {
        localChanged = false;
        for (const { name, exported, body } of declarations) {
          const known = exported ? gates : local;
          if (known.has(name) || !callsAny(body, [...gates, ...local])) continue;
          known.add(name);
          if (exported) gatesChanged = true;
          else localChanged = true;
        }
      }
    }
  }

  return gates;
}

/**
 * Whether a render-chain file refuses a caller without a usable session: a
 * call to one of `gates` — `requireRole`, `requireCurrentUser`, or a helper
 * `sessionGateNames` resolved as wrapping one — or a hand-rolled gate that
 * redirects when `getServerSession()` comes back empty (VEN-590), the shape
 * the VEN-512 screens use. Reading the session is not enough: the root layout
 * and `/` read it to draw the header and render for everyone.
 */
export function refusesWithoutSession(
  code: string,
  gates: ReadonlySet<string> = DIRECT_SESSION_GATES,
): boolean {
  const stripped = stripComments(code);
  if (callsAny(stripped, gates)) return true;
  const inline = String.raw`!\s*\(\s*await\s+getServerSession\(\)\s*\)`;
  const bound = [...stripped.matchAll(SESSION_BINDING)].map(
    ([, name]) => String.raw`!\s*${name}|${name}\s*===?\s*null`,
  );

  return [inline, ...bound].some((test) =>
    new RegExp(String.raw`\bif\s*\(\s*(?:${test})${THEN_REDIRECT}`).test(stripped),
  );
}

/** A segment's own `page.tsx` or `route.ts` — the first source the enumerator records for it. */
export function segmentFile(target: RouteTarget, roots: RouteTargetRoots): string | null {
  return target.kinds.includes('segment') ? join(roots.repoRoot, target.sources[0] ?? '') : null;
}

/** The segment's file and every `layout.tsx` above it — everything that runs to render it. */
export function renderChain(target: RouteTarget, roots: RouteTargetRoots): string[] {
  const file = segmentFile(target, roots);
  if (file === null) return [];

  const chain = [file];
  for (
    let directory = dirname(file);
    directory.startsWith(roots.appDir);
    directory = dirname(directory)
  ) {
    chain.push(join(directory, 'layout.tsx'));
  }
  return chain;
}

/**
 * A route that refuses a caller without a usable session anywhere in its render
 * chain. `ROLE_ROUTE_RULES` names only the routes someone wrote into the role
 * table, so a gated page left out of it is swept strictly only through this.
 */
export function isSessionGated(
  target: RouteTarget,
  roots: RouteTargetRoots,
  gates: ReadonlySet<string> = DIRECT_SESSION_GATES,
): boolean {
  return renderChain(target, roots).some(
    (file) => existsSync(file) && refusesWithoutSession(readFileSync(file, 'utf8'), gates),
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
