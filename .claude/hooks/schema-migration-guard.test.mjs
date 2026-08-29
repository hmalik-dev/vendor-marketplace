// Exercises .claude/hooks/schema-migration-guard.mjs by running it as the
// harness does: JSON on stdin, JSON on stdout. The hook is wired in
// .claude/settings.json and had no test, so a silent regression in it would
// have removed the migration reminder without anything failing.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), 'schema-migration-guard.mjs');

function runHook(payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [HOOK], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) => {
      let parsed;
      try {
        parsed = JSON.parse(out || '{}');
      } catch {
        return reject(new Error(`hook did not emit JSON. stdout=${out} stderr=${err}`));
      }
      resolve({ code, out: parsed, err });
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

let fails = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? ' ok ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) fails++;
};

const edit = (file_path) => ({ tool_input: { file_path } });

// --- Editing the Drizzle schema reminds you to generate a migration ---------
{
  const { code, out } = await runHook(edit('/repo/packages/db/src/schema/bookings.ts'));
  check('schema edit: exits 0', code === 0, `exit ${code}`);
  check(
    'schema edit: asks for pnpm db:generate',
    typeof out.additionalContext === 'string' && out.additionalContext.includes('pnpm db:generate'),
    JSON.stringify(out).slice(0, 90),
  );
}

// --- Editing generated migration output is called out ----------------------
{
  const { out } = await runHook(edit('/repo/packages/db/drizzle/0007_odd_wasp.sql'));
  check(
    'generated migration edit: flagged as generated output',
    typeof out.systemMessage === 'string' && out.systemMessage.includes('generated migration'),
    JSON.stringify(out).slice(0, 90),
  );
  check(
    'generated migration edit: tells you where to change it instead',
    typeof out.additionalContext === 'string' &&
      out.additionalContext.includes('packages/db/src/schema'),
  );
}

// --- Windows-style separators reach the same branches ----------------------
{
  const { out } = await runHook(edit('C:\\repo\\packages\\db\\src\\schema\\vendors.ts'));
  check(
    'backslash path: still recognised as a schema edit',
    typeof out.additionalContext === 'string' && out.additionalContext.includes('pnpm db:generate'),
  );
}

// --- Unrelated files stay silent -------------------------------------------
{
  const { code, out } = await runHook(edit('/repo/apps/web/src/app/page.tsx'));
  check('unrelated file: exits 0', code === 0);
  check('unrelated file: says nothing', Object.keys(out).length === 0, JSON.stringify(out));
}

// --- Malformed and empty input must not crash the tool call ----------------
{
  const { code, out } = await runHook({});
  check('no file_path: exits 0 and says nothing', code === 0 && Object.keys(out).length === 0);
}
{
  const child = spawn(process.execPath, [HOOK], { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  const code = await new Promise((r) => {
    child.on('close', r);
    child.stdin.end('not json at all');
  });
  check('malformed stdin: exits 0 with valid JSON', code === 0 && out.trim() === '{}', out);
}

console.log(fails === 0 ? '\nAll schema-migration-guard checks pass.' : `\n${fails} FAILING`);
process.exit(fails ? 1 : 0);
