export const meta = {
  name: 'hunt-bugs',
  description:
    'Sweep the whole application for defects — read-only static hunt plus adversarial browser driving — and return verified, implementable findings',
  whenToUse:
    'Before a release, after a run of tickets, or whenever you want the unhappy paths found rather than guessed at. Requires the dev stack to be running.',
  phases: [
    {
      title: 'Preflight',
      detail: 'confirm the stack is up, the database is a dev branch, and test accounts exist',
    },
    { title: 'Map', detail: 'enumerate surfaces, roles, guards and state transitions' },
    { title: 'Sweep', detail: 'one read-only hunter per defect dimension, in parallel' },
    {
      title: 'Drive',
      detail: 'adversarial browser passes, one flow at a time — the browser is shared',
    },
    {
      title: 'Verify',
      detail: 'three skeptics per finding with distinct lenses; majority refute kills it',
    },
    { title: 'Report', detail: 'dedupe, rank, and write each survivor as an implementable ticket' },
  ],
};

// ---------------------------------------------------------------------------
// Tunables. Override any of them by passing args, e.g.
//   Run /hunt-bugs with {"drive": false} to skip the browser phase.
// ---------------------------------------------------------------------------
const cfg = Object.assign(
  {
    drive: true, // run the browser phase at all
    votes: 3, // skeptics per candidate finding
    flows: null, // null = every flow below
    dimensions: null, // null = every dimension below
    webOrigin: null, // null = WEB_URL / WEB_PORT from the environment, else 3000
    apiOrigin: null, // null = NEXT_PUBLIC_API_URL / PORT from the environment, else 4000
  },
  args && typeof args === 'object' && !Array.isArray(args) ? args : {},
);

const DIMENSIONS = [
  {
    key: 'authorization',
    prompt: `Hunt for authorization defects across apps/api and apps/web.
Every authorization decision must read the local users.role column, never Clerk
unsafeMetadata, which the account holder can write. Look for: an endpoint with no
guard beside guarded neighbours; a guard that checks authentication but not
ownership; a resource fetched by id without scoping to the caller; a role checked
on the client only; a vendor able to read or mutate another vendor's rows.`,
  },
  {
    key: 'input-validation',
    prompt: `Hunt for untrusted input reaching a sink without validation. Trace
each route's Zod schema to the service and the DAO. Look for: a value used in a
query, path, shell, URL or rendered output before validation; normalization that
happens after the emptiness or length check rather than before; dynamic sort,
order or pagination values not drawn from an allowlist; an IN clause built
without guarding the empty array; unbounded pagination.`,
  },
  {
    key: 'async-and-errors',
    prompt: `Hunt for broken async and error handling. Look for: a missing await;
an await outside try/catch and not propagated; forEach used where the body
awaits; a fire-and-forget promise with no void and no comment; an empty catch; a
catch that neither rethrows, returns a typed error, nor logs and returns a typed
fallback; an internal error string or stack reaching the client; a thrown bare
Error where AppError was required, which turns a real message into an opaque 500.`,
  },
  {
    key: 'idempotency-and-races',
    prompt: `Hunt for defects that appear on the second request or under
concurrency. Look for: a state-changing operation with no protection against
duplicate delivery; a multi-statement write not wrapped in one transaction; a
read-then-write with no locking where two callers can interleave; a webhook
handler that is not idempotent; a booking or availability transition that two
concurrent requests could both win.`,
  },
  {
    key: 'data-integrity',
    prompt: `Hunt for violations of the project's data law. Look for: a literal
union redeclared instead of derived from the shared as-const enum in
packages/shared/src/constants, especially one that has already drifted; money
held as a float or converted anywhere but the display boundary via formatPrice;
an event date round-tripped through a JS Date in local time rather than kept as a
YYYY-MM-DD string; any endpoint writing vendor_profiles.avg_rating or
review_count, which must only ever be recomputed.`,
  },
  {
    key: 'production-defaults',
    prompt: `Hunt for development defaults that can reach production. Look for: a
fallback localhost origin, a permissive CORS or CSP branch, a stub or test key, a
feature flag defaulting open, an auth check skipped when an env var is absent.
For each, decide whether the deployed environment is forced to supply the real
value or throw. A default that silently applies in production is the finding —
and it is exactly the code no test covers, so check whether a test asserts the
production branch.`,
  },
  {
    key: 'react-boundaries',
    prompt: `Hunt for React and Next.js App Router defects in apps/web. Look for:
server-only code imported into a client component; data fetched in useEffect
where a Server Component should await it; an effect with a subscription,
listener, timer or async call and no cleanup; a violated exhaustive-deps that
actually causes a stale closure; state mutated in place; a list key that is an
index over a reorderable list; a client component that could have been a server
one and is leaking a secret or a large payload to the browser.`,
  },
  {
    key: 'query-shape',
    prompt: `Hunt for query defects in packages/db and apps/api DAOs. Look for: a
query inside a loop where a join or an IN would do; a list endpoint with no
limit; a SELECT * in production code; a missing index behind a filter or sort the
UI exposes; a count computed by loading rows; a join that multiplies rows and is
then not deduplicated.`,
  },
  {
    key: 'state-side-effects',
    prompt: `Hunt for handlers whose own calls undo each other. First build a
side-effect map of every shared store, context and reducer in apps/web: for each
action or setter, list what it sets and — separately — what it resets that it
does not own. That map is the point; the defect is invisible without it. Then
read each onClick, onSubmit and onChange and trace its calls in order. Look for:
a later call resetting state an earlier call in the same handler just set; a
handler whose final state does not match what its own label promises; two awaits
whose resolution order decides the outcome; an optimistic update with no rollback
on the failure branch; a close or reset handler clearing state a sibling still
renders from. Both functions working in isolation is the normal case here — the
bug is the interaction. Booking request, messaging and availability carry the
most shared state.`,
  },
  {
    key: 'illegal-states',
    prompt: `Hunt for domain states the types permit but the business forbids.
Read the Zod schemas in packages/shared and the Drizzle tables in packages/db
against the state machines mapped above. Look for: fields optional in the type
that are mandatory once a status is reached, so "paid with no vendor" or
"confirmed with no date" is representable; a status union and a nullable
timestamp that can disagree with each other; two booleans encoding three states
when only two are legal; a bare string where an as-const enum already exists; a
column left nullable that every write path populates; an API type wider than the
column it lands in. Report each as a concrete row or object that should be
impossible and is not — not as a style preference.`,
  },
  {
    key: 'absent-and-boundary',
    prompt: `Hunt for unhandled absence and boundary conditions. Look for: a
.find(), Map.get() or array index used without a guard; a DB row destructured
without checking it exists; JSON.parse on a persisted or external string with no
try/catch and no typed fallback; an empty list rendering nothing rather than an
empty state; a single-item list; a list long enough to paginate; a nullable chain
without optional chaining; || used where ?? was meant, clobbering 0, "" or false.`,
  },
];

const FLOWS = [
  {
    key: 'discovery',
    name: 'Landing, search and vendor profile',
    routes: '/, /search, /vendors/[slug]',
    focus: `Search with no results, one result, and enough results to paginate.
Filters that contradict each other. A vendor slug that does not exist, and one
that exists but is suspended. Every facet count and result count on screen must
come from the query — flag any number that looks like platform marketing.`,
  },
  {
    key: 'booking-request',
    name: 'Booking request submission',
    routes: '/vendors/[slug]/request, /bookings',
    focus: `Submit empty. Submit a past date. Submit a date the vendor has marked
unavailable. Double-click submit and check whether two requests were created.
Submit, press Back, submit again. Request a vendor as that same vendor's own
account. Open the request form signed out.`,
  },
  {
    key: 'messaging',
    name: 'Messaging',
    routes: '/messages',
    focus: `Send an empty message and a very long one. Send a script tag and an
emoji. Open a thread belonging to another account by putting its id in the URL.
Send from two tabs at once. Check whether the thread list updates and whether
anything polls forever.`,
  },
  {
    key: 'customer-account',
    name: 'Customer profile and dashboard',
    routes: '/customer/profile, /dashboard',
    focus: `Save the profile with every field empty, then with each field at
maximum length. Navigate away with unsaved changes. Open the customer dashboard
as a vendor account and as a signed-out visitor.`,
  },
  {
    key: 'vendor-onboarding',
    name: 'Vendor profile, portfolio and packages',
    routes: '/vendor/profile/edit, /vendor/portfolio, /vendor/packages',
    focus: `Save an incomplete profile. Upload a file that is not an image, one
that is far too large, and one with a hostile filename. Reorder the portfolio and
refresh. Set a package price of zero, a negative price, and a very large one —
money is integer cents, so check what is stored. Delete the cover photo and see
what becomes the cover.`,
  },
  {
    key: 'vendor-availability',
    name: 'Vendor availability and dashboard',
    routes: '/vendor/availability, /vendor/dashboard',
    focus: `Mark a date unavailable that already has a confirmed booking. Mark a
past date. Toggle the same date twice quickly. Check the timezone: a date set at
23:00 local must not move a day. Open the vendor dashboard as a customer.`,
  },
  {
    key: 'auth-and-roles',
    name: 'Authentication and role boundaries',
    routes: '/sign-in, /sign-up, /suspended, cross-role access',
    focus: `Sign up choosing each role and confirm the role that lands in the
database is the one the server narrowed, not one the client could set. Visit
every authenticated route signed out and confirm the redirect target. Take a URL
that works for the customer account and open it as the vendor account, and the
reverse. Confirm a suspended account cannot reach anything but /suspended. Sign
out in one tab with the app open in another.`,
  },
];

const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'file', 'trigger', 'consequence', 'severity'],
        properties: {
          title: { type: 'string', description: 'One line, names the defect' },
          file: { type: 'string', description: 'file:line, or the URL for a browser finding' },
          trigger: {
            type: 'string',
            description: 'Concrete inputs, role or sequence that reaches it',
          },
          consequence: { type: 'string', description: 'What the user or the data ends up with' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          evidence: {
            type: 'string',
            description: 'Console output, response body, or the lines that prove it',
          },
        },
      },
    },
  },
};

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['refuted', 'reason'],
  properties: {
    refuted: { type: 'boolean', description: 'true if this is not a real defect' },
    reason: { type: 'string' },
    correctedSeverity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
  },
};

// ---------------------------------------------------------------------------
// Preflight. The browser phase is worthless against a stack that is not up, and
// destructive against production. Establish both before spending anything.
// ---------------------------------------------------------------------------
phase('Preflight');

/*
 * The origins to probe, which a lane moves. `pnpm lane:exec <n> --` puts
 * `WEB_URL`, `WEB_PORT`, `NEXT_PUBLIC_API_URL` and `PORT` in the child
 * environment. Naming 3000/4000 here made the gate return ready:false inside a
 * lane whose servers were correctly on their own ports — and a not-ready
 * verdict silently skips the entire browser phase, so seven flows went undriven
 * while the sweep still reported as having run.
 *
 * The workflow sandbox exposes no `process` at all (verified 2026-09-03: the
 * run died at `process.env` before spawning a single agent), so the
 * environment is consulted only where it exists, and a lane that cannot rely
 * on it passes `{"webOrigin": "...", "apiOrigin": "..."}` as args instead.
 */
// `WEB_URL` doubles as the API's CORS allow-list and so is comma-separated;
// only its first origin is a URL anything can curl.
const firstOrigin = (value) => value.split(',')[0].trim();
const env = typeof process !== 'undefined' && process.env ? process.env : {};
const webOrigin = cfg.webOrigin
  ? firstOrigin(cfg.webOrigin)
  : env.WEB_URL
    ? firstOrigin(env.WEB_URL)
    : `http://localhost:${env.WEB_PORT || 3000}`;
const apiOrigin = cfg.apiOrigin
  ? firstOrigin(cfg.apiOrigin)
  : env.NEXT_PUBLIC_API_URL
    ? firstOrigin(env.NEXT_PUBLIC_API_URL)
    : `http://localhost:${env.PORT || 4000}`;

const ready = await agent(
  `Check whether this repository's development stack is ready for a browser sweep.
Do not start anything and do not modify anything. Report only what you observe:

1. Is the web app serving at ${webOrigin}? Is the API serving at ${apiOrigin}? curl both.
2. Does the API's health endpoint report a database connection?
3. Read the DATABASE_URL currently in use WITHOUT printing its value, and report
   only whether the branch name contains "production". This must be false.
4. Does .env.e2e.local exist, and does it name both a customer and a vendor test
   account? Report only whether they are present, never their values.

Return ready:true only if the web app and API are both serving and the database
is not production.`,
  {
    schema: {
      type: 'object',
      required: ['ready', 'blockers'],
      properties: {
        ready: { type: 'boolean' },
        blockers: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
      },
    },
  },
);

const canDrive = cfg.drive && ready && ready.ready === true;

if (cfg.drive && !canDrive) {
  log(
    `Browser phase SKIPPED — ${ready && ready.blockers ? ready.blockers.join('; ') : 'preflight did not return'}. ` +
      `Run /start, then re-run. The static sweep continues.`,
  );
}

// ---------------------------------------------------------------------------
// Map. A barrier is correct here: the sweep prompts need the whole inventory.
// ---------------------------------------------------------------------------
phase('Map');

const mapParts = await parallel([
  () =>
    agent(
      `Enumerate every user-reachable surface in apps/web. For each: route path,
whether it is a Server or Client Component, which role may reach it, what guard
enforces that, every form and mutation on it, and every empty/loading/error state
it declares. Read the files; do not infer from names.`,
      { label: 'map:web', phase: 'Map' },
    ),
  () =>
    agent(
      `Enumerate every route registered in apps/api/src/modules. For each: method
and path, the Zod schema, the guard, the service it calls, the DAO queries that
service reaches, and what it returns on each failure branch. Read the files.`,
      { label: 'map:api', phase: 'Map' },
    ),
  () =>
    agent(
      `Map this application's authorization model. Where is a user row created and
how is the role narrowed there? Which surfaces are customer-only, vendor-only,
admin-only, or public? Where does any code read the role from a token or from
Clerk metadata rather than the local users.role column? List every place the two
could disagree.`,
      { label: 'map:authz', phase: 'Map' },
    ),
  () =>
    agent(
      `Map the domain state machines: booking request status, availability, and
any suspension or moderation state. For each, list the states, the legal
transitions, what performs each transition, and which transitions have no guard
against being applied twice or out of order.`,
      { label: 'map:state', phase: 'Map' },
    ),
]);

const inventory = mapParts.filter(Boolean).join('\n\n---\n\n');

// ---------------------------------------------------------------------------
// Sweep. One read-only hunter per dimension, all at once.
// ---------------------------------------------------------------------------
phase('Sweep');

const dims = cfg.dimensions
  ? DIMENSIONS.filter((d) => cfg.dimensions.indexOf(d.key) !== -1)
  : DIMENSIONS;

log(`Static sweep: ${dims.length} dimensions in parallel.`);

// The source key is attached inside the map, before any filtering. Tagging it
// afterwards by array index silently mislabels every finding once one agent
// returns null, because filter(Boolean) shifts the indices.
const staticFindings = (
  await parallel(
    dims.map(
      (d) => () =>
        agent(`${d.prompt}\n\nApplication inventory for context:\n\n${inventory}`, {
          label: `sweep:${d.key}`,
          phase: 'Sweep',
          agentType: 'bug-hunter',
          schema: FINDINGS_SCHEMA,
        }).then((r) =>
          r && r.findings
            ? r.findings.map((f) => Object.assign({ source: `static:${d.key}` }, f))
            : [],
        ),
    ),
  )
)
  .filter(Boolean)
  .flat();

// ---------------------------------------------------------------------------
// Drive. SERIAL, deliberately. The Playwright MCP server is one shared browser:
// two agents driving it at once fight over tabs and navigation, and every
// finding either produces becomes untrustworthy. A plain for-of loop keeps
// exactly one driver alive at a time.
// ---------------------------------------------------------------------------
const browserFindings = [];

if (canDrive) {
  phase('Drive');
  const flows = cfg.flows ? FLOWS.filter((f) => cfg.flows.indexOf(f.key) !== -1) : FLOWS;
  log(`Browser sweep: ${flows.length} flows, one at a time (single shared browser).`);

  for (let i = 0; i < flows.length; i++) {
    const f = flows[i];
    const result = await agent(
      `Drive the "${f.name}" flow (${f.routes}) and try to break it.

${f.focus}

Work through your full adversarial checklist — hostile input, out-of-order
sequences, wrong identity, and absent resources — not only the focus items above.
Read the browser console at every step and assert no horizontal overflow.

Sign in with the accounts named in .env.e2e.local. Never print a credential.
You are the only agent using the browser right now; close what you open.

Report only what you actually observed. A validation message correctly refusing
bad input is the system working, not a finding.`,
      {
        label: `drive:${f.key}`,
        phase: 'Drive',
        agentType: 'unhappy-path-hunter',
        schema: FINDINGS_SCHEMA,
      },
    );
    if (result && result.findings) {
      for (const finding of result.findings) {
        browserFindings.push(Object.assign({ source: `browser:${f.key}` }, finding));
      }
    }
    log(`Flow ${i + 1}/${flows.length} done — ${browserFindings.length} browser findings so far.`);
  }
}

// ---------------------------------------------------------------------------
// Dedupe across everything, then verify. The barrier is genuine: two dimensions
// routinely find the same defect from different angles, and verifying it twice
// costs three extra agents for no information.
// ---------------------------------------------------------------------------
const candidates = staticFindings.concat(browserFindings);

const seen = {};
const unique = [];
for (const f of candidates) {
  const k = (f.file || '') + '|' + (f.title || '').toLowerCase().slice(0, 60);
  if (!seen[k]) {
    seen[k] = true;
    unique.push(f);
  }
}

log(
  `${candidates.length} candidates, ${unique.length} unique after dedupe. Verifying with ${cfg.votes} skeptics each.`,
);

if (unique.length === 0) {
  return {
    verified: [],
    report: 'No candidate defects found. Widen the dimensions or flows before believing this.',
  };
}

phase('Verify');

const LENSES = [
  'Does it actually reproduce? Trace the exact path from the trigger to the consequence in the real code. If any step is assumed rather than read, refute it.',
  'Is it already handled somewhere the finder did not look — a guard higher in the stack, a database constraint, a Zod schema, a middleware, a type that makes the state unreachable? If so, refute it.',
  'Is the consequence real and material, or is this a style preference, a speculative hardening, or a defect that cannot affect a user or the data? If it is not material, refute it.',
];

const verified = (
  await parallel(
    unique.map(
      (f) => () =>
        parallel(
          Array.from(
            { length: cfg.votes },
            (_unused, v) => () =>
              agent(
                `A sweep reported this candidate defect. Your job is to REFUTE it.

  title:       ${f.title}
  location:    ${f.file}
  trigger:     ${f.trigger}
  consequence: ${f.consequence}
  severity:    ${f.severity}
  evidence:    ${f.evidence || '(none supplied)'}
  found by:    ${f.source}

${LENSES[v % LENSES.length]}

Read the actual code before deciding. Default to refuted:true when you are
uncertain — a false finding costs more to triage than a missed one costs to find
next sweep. If it survives, say precisely why, and correct the severity if the
finder over- or under-stated it.`,
                {
                  label: `verify:${(f.title || '').slice(0, 32)}`,
                  phase: 'Verify',
                  schema: VERDICT_SCHEMA,
                },
              ),
          ),
        ).then((votes) => {
          const cast = votes.filter(Boolean);
          const kills = cast.filter((v) => v.refuted).length;
          const survives = cast.length > 0 && kills < cast.length / 2;
          const corrected = cast.map((v) => v.correctedSeverity).filter(Boolean);
          return survives
            ? Object.assign({}, f, {
                severity: corrected.length ? corrected[0] : f.severity,
                upheldBy: cast.length - kills,
                of: cast.length,
                why: cast
                  .filter((v) => !v.refuted)
                  .map((v) => v.reason)
                  .join(' '),
              })
            : null;
        }),
    ),
  )
).filter(Boolean);

log(`${verified.length} of ${unique.length} findings survived adversarial verification.`);

if (verified.length === 0) {
  return { verified: [], report: 'Every candidate was refuted. Nothing to file.' };
}

// ---------------------------------------------------------------------------
// Report. One agent turns survivors into tickets someone can pick up cold.
// ---------------------------------------------------------------------------
phase('Report');

const report = await agent(
  `Write up ${verified.length} verified defects as implementable tickets.

${JSON.stringify(verified, null, 2)}

Rank by severity, then by blast radius. Group defects that share one root cause
into a single ticket — three symptoms of one missing guard is one ticket, not
three.

For each ticket use exactly this shape:

## <outcome-oriented title, imperative, names the thing>
**Severity:** <critical|high|medium|low> · **Upheld:** <n>/<of> · **Source:** <source>

### Outcome
What is correct once this is fixed.

### Reproduction
Numbered steps someone can follow cold — URL, account role, exact inputs.

### Where
file:line, and the neighbouring code that shows the intended pattern.

### Acceptance criteria
- Observable, testable behaviour
- The regression test that must fail before the fix and pass after
- Edge and failure behaviour the fix must also cover

Then close with a one-line tally: how many critical, high, medium, low, and how
many were dropped in verification.

Do not invent a defect that is not in the list, and do not soften one that is.`,
  { label: 'report', phase: 'Report' },
);

return { verified, report };
