// Exercises .claude/workflows/hunt-bugs.js against a stubbed runtime.
// Verifies control flow, not agent quality: preflight gating, dedupe, majority
// verification, and that the browser phase really is serial.
import { readFileSync } from 'node:fs';

const SRC = readFileSync('.claude/workflows/hunt-bugs.js', 'utf8').replace(
  'export const meta',
  'const meta',
);

async function run({ argsValue, agentImpl }) {
  const state = {
    phases: [],
    logs: [],
    labels: [],
    concurrent: 0,
    maxConcurrentDrive: 0,
    driveOrder: [],
  };

  const agent = async (prompt, opts = {}) => {
    const label = opts.label || '(unlabelled)';
    state.labels.push(label);
    const isDrive = opts.phase === 'Drive';
    if (isDrive) {
      state.concurrent++;
      state.maxConcurrentDrive = Math.max(state.maxConcurrentDrive, state.concurrent);
      state.driveOrder.push(label);
    }
    await new Promise((r) => setTimeout(r, 5));
    const out = await agentImpl(prompt, opts, state);
    if (isDrive) state.concurrent--;
    return out;
  };
  const parallel = async (thunks) =>
    Promise.all(
      thunks.map((t) =>
        Promise.resolve()
          .then(t)
          .catch(() => null),
      ),
    );
  const pipeline = async () => {
    throw new Error('pipeline not expected in this script');
  };
  const phase = (t) => state.phases.push(t);
  const log = (m) => state.logs.push(m);
  const budget = { total: null, spent: () => 0, remaining: () => Infinity };

  const fn = new Function(
    'agent',
    'parallel',
    'pipeline',
    'phase',
    'log',
    'args',
    'budget',
    `return (async () => { ${SRC} })()`,
  );
  const result = await fn(agent, parallel, pipeline, phase, log, argsValue, budget);
  return { result, state };
}

const FINDING = (t, f) => ({ title: t, file: f, trigger: 'x', consequence: 'y', severity: 'high' });
let fails = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? ' ok ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) fails++;
};

// --- Case 1: stack down -> Drive skipped, static sweep still runs -----------
{
  const { state } = await run({
    argsValue: undefined,
    agentImpl: async (p, o) => {
      if (o.schema && o.schema.properties.ready)
        return { ready: false, blockers: ['web not serving on 3000'] };
      if (o.schema === undefined) return 'map text';
      if (o.agentType === 'bug-hunter') return { findings: [FINDING('bug A', 'a.ts:1')] };
      if (o.schema && o.schema.properties.refuted) return { refuted: false, reason: 'real' };
      return 'report';
    },
  });
  check('stack down: Drive phase never started', state.phases.indexOf('Drive') === -1);
  check(
    'stack down: user is told why',
    state.logs.some((l) => l.includes('SKIPPED') && l.includes('3000')),
    state.logs.find((l) => l.includes('SKIPPED')) || 'no skip log',
  );
  check(
    'stack down: static sweep still ran',
    state.labels.filter((l) => l.startsWith('sweep:')).length === 11,
  );
}

// --- Case 2: stack up -> Drive runs, and runs SERIALLY ----------------------
{
  const { result, state } = await run({
    argsValue: undefined,
    agentImpl: async (p, o) => {
      if (o.schema && o.schema.properties.ready) return { ready: true, blockers: [] };
      if (o.schema === undefined && o.label && o.label.startsWith('map:')) return 'map text';
      if (o.agentType === 'bug-hunter') return { findings: [FINDING('static bug', 's.ts:9')] };
      if (o.agentType === 'unhappy-path-hunter')
        return { findings: [FINDING('browser bug ' + o.label, '/url')] };
      if (o.schema && o.schema.properties.refuted) return { refuted: false, reason: 'real' };
      return 'FINAL REPORT';
    },
  });
  check('stack up: Drive phase ran', state.phases.indexOf('Drive') !== -1);
  check(
    'browser agents are SERIAL (max 1 concurrent)',
    state.maxConcurrentDrive === 1,
    `max concurrent = ${state.maxConcurrentDrive}`,
  );
  check('all 7 flows driven', state.driveOrder.length === 7, state.driveOrder.length + ' flows');
  check('report returned', result && result.report === 'FINAL REPORT');
  check(
    'findings carry a source tag',
    result.verified.every((v) => v.source),
    JSON.stringify(result.verified[0] && result.verified[0].source),
  );
}

// --- Case 3: dedupe across dimensions --------------------------------------
{
  const { result } = await run({
    argsValue: { drive: false },
    agentImpl: async (p, o) => {
      if (o.schema && o.schema.properties.ready) return { ready: true, blockers: [] };
      if (o.schema === undefined && o.label && o.label.startsWith('map:')) return 'map';
      // every dimension reports the SAME defect
      if (o.agentType === 'bug-hunter') return { findings: [FINDING('same defect', 'dup.ts:4')] };
      if (o.schema && o.schema.properties.refuted) return { refuted: false, reason: 'real' };
      return 'report';
    },
  });
  check(
    '11 identical findings dedupe to 1',
    result.verified.length === 1,
    `${result.verified.length} survived`,
  );
}

// --- Case 4: majority refutation kills a finding ---------------------------
{
  let vote = 0;
  const { result } = await run({
    argsValue: { drive: false },
    agentImpl: async (p, o) => {
      if (o.schema && o.schema.properties.ready) return { ready: true, blockers: [] };
      if (o.schema === undefined && o.label && o.label.startsWith('map:')) return 'map';
      if (o.agentType === 'bug-hunter') return { findings: [FINDING('shaky', 'q.ts:1')] };
      if (o.schema && o.schema.properties.refuted) {
        vote++;
        return { refuted: vote % 3 !== 0, reason: 'no' };
      }
      return 'report';
    },
  });
  check(
    '2-of-3 refute kills the finding',
    result.verified.length === 0,
    `${result.verified.length} survived`,
  );
  check(
    'empty result explains itself',
    typeof result.report === 'string' && result.report.includes('refuted'),
  );
}

// --- Case 5: a dead sweep agent does not mislabel its neighbours ------------
{
  let n = 0;
  const { result } = await run({
    argsValue: { drive: false },
    agentImpl: async (p, o) => {
      if (o.schema && o.schema.properties.ready) return { ready: true, blockers: [] };
      if (o.schema === undefined && o.label && o.label.startsWith('map:')) return 'map';
      if (o.agentType === 'bug-hunter') {
        n++;
        return n <= 3 ? null : { findings: [FINDING('f' + n, 'f' + n + '.ts:1')] };
      }
      if (o.schema && o.schema.properties.refuted) return { refuted: false, reason: 'real' };
      return 'report';
    },
  });
  const sources = result.verified.map((v) => v.source);
  check(
    '3 dead agents: survivors keep correct source tags',
    new Set(sources).size === sources.length && sources.every((s) => s.startsWith('static:')),
    sources.join(', '),
  );
}

// --- Case 6: args override -------------------------------------------------
{
  const { state } = await run({
    argsValue: { drive: false, dimensions: ['authorization', 'input-validation'] },
    agentImpl: async (p, o) => {
      if (o.schema && o.schema.properties.ready) return { ready: true, blockers: [] };
      if (o.schema === undefined && o.label && o.label.startsWith('map:')) return 'map';
      if (o.agentType === 'bug-hunter') return { findings: [] };
      return 'report';
    },
  });
  check(
    'args narrows the dimension set',
    state.labels.filter((l) => l.startsWith('sweep:')).length === 2,
  );
  check('args can disable the browser phase', state.phases.indexOf('Drive') === -1);
}

// --- Case 7: #238 — the readiness gate follows the lane's ports ------------
// Naming 3000/4000 made the gate report not-ready inside a lane serving
// correctly on its own ports, and Case 1 proves a not-ready verdict skips the
// whole browser phase. The prompt has to name the origins the lane will bind.
{
  const laneEnv = {
    WEB_URL: 'http://localhost:3031',
    WEB_PORT: '3031',
    NEXT_PUBLIC_API_URL: 'http://localhost:4031',
    PORT: '4031',
  };
  const saved = {};
  for (const [key, value] of Object.entries(laneEnv)) {
    saved[key] = process.env[key];
    process.env[key] = value;
  }

  let readinessPrompt = '';
  try {
    await run({
      argsValue: { drive: false, dimensions: ['authorization'] },
      agentImpl: async (p, o) => {
        if (o.schema && o.schema.properties.ready) {
          readinessPrompt = p;
          return { ready: true, blockers: [] };
        }
        if (o.schema === undefined && o.label && o.label.startsWith('map:')) return 'map';
        if (o.agentType === 'bug-hunter') return { findings: [] };
        return 'report';
      },
    });
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  check('lane ports: readiness prompt names the lane web origin', readinessPrompt.includes('3031'));
  check('lane ports: readiness prompt names the lane API origin', readinessPrompt.includes('4031'));
  check(
    'lane ports: readiness prompt names no shared dev port',
    !readinessPrompt.includes('3000') && !readinessPrompt.includes('4000'),
    readinessPrompt.split('\n').find((l) => l.includes('3000') || l.includes('4000')) || '',
  );
}

console.log(fails === 0 ? '\nAll control-flow checks pass.' : `\n${fails} FAILING`);
process.exit(fails ? 1 : 0);
