import { elements, type SourceFile } from './source-scan';

/**
 * Which stone token may take which role — the law behind four separate bugs.
 *
 * The recurring mistake is not "a border token used as text". It is ***the
 * nearest hex is not the right role***, and before this table existed it had
 * bitten four times:
 *
 * - `stone-400` as text on ink — the closing band's pitch (#430) and the admin
 *   header's operator line (#441).
 * - `stone-0` as a border on ink — the footer's legal hairline (#441).
 * - A 78% alpha of `stone-50` standing in for a value the frames name outright,
 *   which `theme.css` records as the defect that minted the ink-ground ramp.
 *
 * Three of those grew a hand-written per-call-site guard — `page.test.tsx`,
 * `admin-header.test.tsx`, `site-footer.test.tsx` — and a fourth would have
 * made it a habit rather than a rule. #447 is the rule.
 *
 * **The ramp is a vocabulary, not a gradient.** A step exists for a role on a
 * ground; reaching for the neighbouring hex because it looks close is the
 * defect. `theme.css` states this in prose beside the tokens; this states it as
 * data, and `theme-tokens.test.ts` asserts that no token escapes classification.
 */

/**
 * What a token is for.
 *
 * `ink-*` roles are the ones this file can police, because the ground is
 * observable — see `inkGroundViolations`. The light-ground roles are recorded
 * for completeness and to name the distinction, not enforced: `stone-400` is a
 * legitimate `text-*` on cream at four sites (an empty-state glyph, a rating
 * star and two package-manager glyphs), so a blanket ban is wrong and a source
 * scan cannot tell those apart from a mistake.
 */
export type TokenRole =
  /** A fill for a page, card, panel or input on the light side of the product. */
  | 'surface'
  /** A rule, hairline or control outline on a light ground. */
  | 'border'
  /** Type on a light ground. */
  | 'text'
  /** One of the two ink fills — the closing band and the footer. */
  | 'ink-ground'
  /** Type on an ink ground. */
  | 'ink-text'
  /** A rule or outline on an ink ground. */
  | 'ink-border';

interface StoneToken {
  readonly roles: readonly TokenRole[];
  /**
   * For an `ink-text` token: the ink ground it is pinned to, and what it draws
   * there. `theme.css` pins each of the four steps to a ground because the two
   * grounds are one value apart and the steps are not interchangeable across
   * them. `theme-tokens.test.ts` asserts each pair clears AA.
   */
  readonly onInk?: { readonly ground: string; readonly use: string };
}

/**
 * Every `--color-stone-*` in `theme.css`, and what it is for.
 *
 * `theme-tokens.test.ts` asserts this covers the ramp exactly, so a new step
 * cannot be minted without saying what role it takes.
 */
export const STONE_ROLES: Readonly<Record<string, StoneToken>> = {
  'stone-0': {
    roles: ['surface', 'ink-text'],
    onInk: { ground: 'stone-950', use: 'the footer wordmark and a hovered link' },
  },
  'stone-25': { roles: ['surface'] },
  'stone-50': {
    roles: ['surface', 'ink-text', 'ink-border'],
    onInk: { ground: 'stone-950', use: 'headings and links on either ink ground' },
  },
  'stone-100': { roles: ['surface'] },
  'stone-150': { roles: ['surface'] },
  'stone-200': { roles: ['border'] },
  'stone-250': { roles: ['surface'] },
  'stone-300': { roles: ['border'] },
  'stone-400': { roles: ['border', 'text'] },
  'stone-480': {
    roles: ['ink-text'],
    onInk: { ground: 'stone-900', use: "the closing band's pitch and step numerals" },
  },
  'stone-500': { roles: ['text'] },
  'stone-520': {
    roles: ['ink-text'],
    onInk: { ground: 'stone-950', use: 'the footer link columns' },
  },
  'stone-540': {
    roles: ['ink-text'],
    onInk: { ground: 'stone-900', use: 'muted copy on the closing band' },
  },
  'stone-560': {
    roles: ['ink-text'],
    onInk: { ground: 'stone-950', use: 'the footer micro-labels and tagline' },
  },
  'stone-600': { roles: ['text'] },
  'stone-700': { roles: ['text'] },
  'stone-800': { roles: ['ink-border'] },
  'stone-900': { roles: ['ink-ground', 'text'] },
  'stone-950': { roles: ['ink-ground'] },
};

function tokensWith(role: TokenRole): ReadonlySet<string> {
  return new Set(
    Object.entries(STONE_ROLES)
      .filter(([, token]) => token.roles.includes(role))
      .map(([name]) => name),
  );
}

/** The tokens that may be `text-*` inside an ink subtree. */
export const INK_TEXT = tokensWith('ink-text');
/** The tokens that may be `border-*` inside an ink subtree. */
export const INK_BORDER = tokensWith('ink-border');
/** The two ink fills themselves. */
export const INK_GROUNDS = tokensWith('ink-ground');

/**
 * A **bare** ink fill — the alpha modifier is what separates a ground from a
 * scrim, and the distinction is the whole reason this guard is not the
 * file-level rule #441 rejected.
 *
 * Twenty call sites write an ink fill, but only three of them establish an ink
 * *ground*: the closing band, the admin header and the footer. The rest are
 * `/40` overlays, a `/14` chip, a hover tint, a button variant and the logo's
 * mono fill — none of which is a region type renders on. Requiring no `/alpha`
 * takes the candidate set from the fourteen files #441 measured to three
 * regions.
 *
 * Built from `STONE_ROLES` rather than written as a literal, for two reasons.
 * It cannot drift from the table — declaring a third ink ground updates the
 * guard. And a literal here would read as a **class**: `design-tokens.test.ts`
 * scans this source for utilities naming undefined ramp steps, and a truncated
 * `bg-stone-9` inside a character class is exactly the false positive that
 * ratchet exists to catch. It caught this one.
 *
 * The lookbehind rejects a variant-prefixed fill. `hover:bg-stone-900` is a
 * tint on some other ground, not a region type renders on, and treating it as
 * one would make that element's whole subtree an ink region and flag its
 * light-ground text. A ground that exists only under a `md:` or `dark:` variant
 * is likewise not a stable ground, and is deliberately out of scope.
 */
export const INK_GROUND = new RegExp(
  String.raw`(?<![\w:-])bg-(?:${[...INK_GROUNDS].join('|')})(?![\w/-])`,
);

/**
 * A `text-`, `border-` or `divide-` utility naming a stone token, with any
 * alpha — including the directional forms.
 *
 * `border-t-stone-0` is the same defect as `border-stone-0` and this repo
 * writes both (`ui/button.tsx`, `search/search-bar.tsx`), so a pattern that
 * only knew the undirected form would have read #441's own hairline defect as
 * clean had it been written `border-t-`. The alpha is matched loosely enough to
 * cover the arbitrary-value forms (`/[78%]`) as well as the plain `/78`.
 *
 * `ring-*` and `outline-*` are deliberately **not** here. They draw a focus
 * affordance rather than a border, and on an ink ground the right value for one
 * is `stone-0` — which holds no `ink-border` role, so including them would fail
 * correct code.
 */
const STONE_UTILITY = /\b(text|border(?:-[trblxyse])?|divide(?:-[xy])?)-(stone-\d+)(\/[^\s"'`]+)?/g;

/**
 * A top-level `function NAME` / `const NAME =` and everything until the next
 * one — the unit the subtree walk folds in when it names one.
 *
 * The column-zero anchor is load-bearing and is about *rejecting*, not
 * accepting: an indented `const` is a binding inside some body, and treating it
 * as a top-level declaration would end the enclosing chunk there and lose the
 * rest of that component. Prettier — enforced by `format:check` in CI — puts
 * every real top-level declaration at column zero, so nothing genuine is missed
 * by the anchor. What it does not normalise is a *fake* declaration at column
 * zero inside a multi-line template literal, which would truncate the real
 * chunk silently. No such line exists in this tree, and no two top-level names
 * collide in any scanned file; both were checked rather than assumed.
 */
const TOP_LEVEL_DECLARATION =
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;

/**
 * A `const NAME = '…'` holding a class string, at **any** indentation.
 *
 * The enclosing component's own body is not in the subtree and is not folded in
 * by name either — you are already inside it, so nothing names it. A class
 * constant bound there rather than at module scope was therefore invisible, and
 * that is the same defect one scope up: moving `LEGAL_CLASS` into `SiteFooter`
 * and setting it to `text-stone-400` left the whole suite green.
 *
 * Seeding the walk with the *enclosing chunk* would fix it and break the guard:
 * `page.tsx`'s ink `<section>` lives inside `HomePage`, whose body is the whole
 * landing page, so the ink region would swallow every light-ground class on it.
 * Resolving local class strings by name keeps the subtree as the boundary and
 * closes the hole that actually bites.
 */
const LOCAL_CLASS = /\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(['"`])([^'"`]*)\2/g;

/** An identifier as it appears in a subtree — a candidate declaration name. */
const IDENTIFIER = /\b([A-Za-z_$][\w$]*)\b/g;

/**
 * Every declaration in `code` the walk can follow, by name.
 *
 * A top-level chunk runs from its own declaration line to the line before the
 * next, so a component's whole body — including the JSX it returns — travels
 * with its name. Local class strings fill in behind those, never over them: a
 * top-level declaration of a name is the one that file exports and uses.
 */
function followableDeclarations(code: string): Map<string, string> {
  const starts = [...code.matchAll(TOP_LEVEL_DECLARATION)];

  const declarations = new Map(
    [...code.matchAll(LOCAL_CLASS)].map((match) => [match[1]!, match[3]!]),
  );

  for (const [index, match] of starts.entries()) {
    declarations.set(match[1]!, code.slice(match.index, starts[index + 1]?.index ?? code.length));
  }

  return declarations;
}

/**
 * The subtree, plus the text of every top-level declaration it reaches.
 *
 * This is the fix for the hole that made the first version of this guard nearly
 * worthless. A component defined *beside* the ink element rather than inside it
 * contributes no subtree — and `site-footer.tsx` is built that way: `<footer>`
 * opens at the bottom of the file and delegates every column and link to
 * `FooterColumn` and `FooterLink` declared above it. So `COLUMN_HEADING`, which
 * holds the `text-stone-560` that `STONE_ROLES` pins as *the footer
 * micro-labels*, was never read at all. Setting it to `text-stone-400` — the
 * exact #430/#441 defect — left the entire suite green.
 *
 * Following names transitively closes it: the subtree names `FooterColumn`,
 * whose body names `COLUMN_HEADING`, whose value is the class string. The walk
 * is bounded by the number of declarations in the file, since each is folded in
 * at most once.
 *
 * Imported names resolve to nothing and are skipped, which is the cross-file
 * limit stated on `inkGroundViolations`.
 *
 * The fold follows **any** name the subtree mentions, and it does not know
 * prose from code. A heading reading `Browse` beside a top-level `const Browse`
 * would fold that declaration in; and a component reached from ink is read
 * whole, so a tone branch that renders light *elsewhere* is reported here.
 * Neither occurs in this tree — the footer reaches its ten genuine references
 * and `page.tsx` three of eighteen — and both fail loudly rather than silently,
 * which is the right way round for a tripwire.
 */
function reachableText(code: string, subtree: string): string {
  const declarations = followableDeclarations(code);
  const seen = new Set<string>();
  const queue = [subtree];
  const parts = [subtree];

  for (let chunk = queue.shift(); chunk !== undefined; chunk = queue.shift()) {
    for (const match of chunk.matchAll(IDENTIFIER)) {
      const name = match[1]!;
      const body = declarations.get(name);

      if (body === undefined || seen.has(name)) continue;

      seen.add(name);
      parts.push(body);
      queue.push(body);
    }
  }

  return parts.join(' ');
}

/** One element inside an ink region using a token that is not for that role. */
export interface TokenRoleViolation {
  /** The file, relative to the web app's source root. */
  readonly file: string;
  /** 1-indexed line of the opening tag that establishes the ink ground. */
  readonly line: number;
  /** The offending utility as written — `text-stone-400`, `border-stone-0/10`. */
  readonly utility: string;
  /** Why it is wrong, ready to print in a failure. */
  readonly reason: string;
}

/**
 * Every stone utility inside an ink region that is not for that ground.
 *
 * The ground a given element renders on is not visible to a scan that reads one
 * class at a time, which is what made the earlier attempts fail. It **is**
 * visible to a scan that walks the JSX subtree of the element establishing the
 * ground — so that is what this does: find the elements whose own class list
 * carries a bare ink fill, then read every `text-*` and `border-*` stone
 * utility in that element's attributes and children.
 *
 * Names the subtree uses are followed — see `reachableText`, which is what
 * makes this reach a component declared beside the ink element rather than
 * inside it. Reading inline attributes alone was not enough, and the footer is
 * the proof.
 *
 * Two clauses, and each one has a real instance behind it:
 *
 * 1. The token must carry the matching `ink-` role. `text-stone-400` on ink was
 *    #430 and #441; `border-stone-0` on ink was #441.
 * 2. `text-*` on ink carries no alpha. The four ink steps exist *because* an
 *    alpha cannot reach them — 78% of `stone-50` over `stone-950` lands a step
 *    light and off-hue from the value the frames draw, which is the defect
 *    `theme.css` records as having minted the ramp. A border may still be an
 *    alpha; the hairlines are drawn that way in the frames.
 *
 * Three limits, stated because a guard whose reach is assumed wider than it is
 * is worse than none:
 *
 * - **Cross-file.** A ground established in one file whose type arrives from
 *   another through `children` is invisible here. All four instances were
 *   same-file; a cross-file rule would have to be a browser assertion.
 * - **A lighter ground nested inside an ink region** is not subtracted, so a
 *   cream card inside the footer would have its correct `text-stone-600`
 *   reported. No such structure exists today. If one is built, exclude that
 *   element's subtree rather than widening the role table to accommodate it.
 * - **Light grounds are not policed at all.** On cream, `stone-400` is
 *   legitimate `text-*` at four decorative sites, so no source scan can
 *   separate a correct use from a mistake. "Wrong role on a light ground" is
 *   an open class, not one this guard closed.
 */
export function inkGroundViolations(file: SourceFile): TokenRoleViolation[] {
  // Six files in ~270 carry an ink fill at all. The rest are one regex each,
  // rather than a tag enumeration and a full-file `elements` scan per tag.
  if (!INK_GROUND.test(file.code)) return [];

  const tags = new Set([...file.code.matchAll(/<([A-Za-z][\w.]*)(?=[\s/>])/g)].map((m) => m[1]!));

  const found = new Map<string, TokenRoleViolation>();

  for (const tag of tags) {
    for (const element of elements(file.code, tag)) {
      if (!INK_GROUND.test(element.attributes)) continue;

      const reached = reachableText(file.code, `${element.attributes} ${element.children}`);

      for (const match of reached.matchAll(STONE_UTILITY)) {
        const [utility, property, token, alpha] = match as unknown as [
          string,
          string,
          string,
          string | undefined,
        ];

        const isText = property === 'text';
        const permitted = isText ? INK_TEXT : INK_BORDER;
        const report = (reason: string) =>
          found.set(`${file.name}:${element.line}:${utility}`, {
            file: file.name,
            line: element.line,
            utility,
            reason,
          });

        if (!permitted.has(token)) {
          report(
            `${token} is ${roleOf(token)}, not an ink-ground ${isText ? 'text' : 'border'} value — use one of ${[...permitted].join(', ')}`,
          );
        } else if (isText && alpha !== undefined) {
          report(
            `${token} is right but the alpha is not — the ink text ramp exists because an alpha of a light token cannot reach these values`,
          );
        }
      }
    }
  }

  return [...found.values()];
}

function roleOf(token: string): string {
  const roles = STONE_ROLES[token]?.roles;

  return roles === undefined ? 'not a token in the stone ramp' : `a ${roles.join('/')} value`;
}
