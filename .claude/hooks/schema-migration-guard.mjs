// PostToolUse guard: editing the Drizzle schema without generating a migration
// leaves the repo in a state that builds locally and fails on deploy. CLAUDE.md
// says to run `pnpm db:generate`; this makes the reminder fire every time
// instead of relying on the model remembering it.
//
// Also blocks hand-edits to generated migration files, which the next
// `db:generate` would silently overwrite.

async function readInput() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  try {
    return JSON.parse(input || '{}');
  } catch {
    return {};
  }
}

const payload = await readInput();
const filePath = payload.tool_input?.file_path ?? payload.tool_input?.path ?? '';

if (!filePath) {
  process.stdout.write('{}');
  process.exit(0);
}

const normalized = filePath.replace(/\\/g, '/');

if (normalized.includes('/packages/db/drizzle/')) {
  process.stdout.write(
    JSON.stringify({
      systemMessage: 'Edited a generated migration file.',
      additionalContext:
        'You just edited a file under packages/db/drizzle/, which is generated output. ' +
        'The next `pnpm db:generate` will overwrite it. Revert this edit and change ' +
        'packages/db/src/schema instead, then regenerate.',
    }),
  );
  process.exit(0);
}

if (normalized.includes('/packages/db/src/schema')) {
  process.stdout.write(
    JSON.stringify({
      additionalContext:
        'You changed the Drizzle schema. Before this work can be committed, run ' +
        '`pnpm db:generate` and commit the generated migration in the same commit. ' +
        'Never hand-edit the output in packages/db/drizzle/.',
    }),
  );
  process.exit(0);
}

process.stdout.write('{}');
