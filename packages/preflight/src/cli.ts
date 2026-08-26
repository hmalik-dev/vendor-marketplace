import { USAGE, parseArgs, resolveCapabilities } from './args.js';
import { capabilityList, renderReport } from './report.js';
import { runChecks } from './run.js';

async function main(): Promise<number> {
  let args;
  let capabilities;

  try {
    args = parseArgs(process.argv.slice(2));

    if (args.help) {
      process.stdout.write(`${USAGE}\n`);
      return 0;
    }

    capabilities = resolveCapabilities(args);
  } catch (error: unknown) {
    // Both a bad flag and an unknown ticket mean the gate was invoked wrongly,
    // which is distinct from the gate running and finding problems.
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n\n${USAGE}\n`);
    return 2;
  }

  const scope = args.ticket === undefined ? 'baseline' : `ticket #${args.ticket}`;
  const heading = `Preflight — ${scope}, ${args.target} environment (${capabilityList([...capabilities])})`;

  const results = await runChecks({ capabilities, target: args.target });
  const report = renderReport(results, heading);

  process.stdout.write(`${report.lines.join('\n')}\n`);
  return report.failures === 0 ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`Preflight crashed: ${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  });
