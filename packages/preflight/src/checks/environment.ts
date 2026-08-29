import {
  CAPABILITIES,
  type EnvVariable,
  requiresExplicitValue,
  shapeFor,
  variablesFor,
} from '@vendor-marketplace/shared/env';
import { ENV_FILES } from '../context.js';
import {
  type Check,
  type CheckContext,
  type CheckResult,
  type Target,
  fail,
  pass,
} from '../types.js';

function setupHint(variable: EnvVariable, target: Target): string {
  const url =
    target === 'production'
      ? (variable.setup.productionUrl ?? variable.setup.url)
      : variable.setup.url;

  return [...variable.setup.steps, url].join(' · ');
}

/**
 * A credential whose prefix names an environment fails its shape for two very
 * different reasons: it is malformed, or it is a perfectly good key from the
 * other environment. Only the second one is about to spend real money, and
 * printing a regex at the operator holding it invites them to paste it back.
 */
function modeMismatch(variable: EnvVariable, value: string, target: Target): string | undefined {
  if (variable.modes === undefined) {
    return undefined;
  }

  const other = target === 'local' ? 'production' : 'local';

  return shapeFor(variable, other)?.test(value) === true
    ? `is a ${variable.modes[other]} key — the ${target} target needs a ${variable.modes[target]} key`
    : undefined;
}

/**
 * Evaluates one variable. Returns a failure rather than throwing so that a run
 * reports every misconfigured value at once — fixing five credentials should
 * take one run, not five.
 */
export function evaluateVariable(variable: EnvVariable, context: CheckContext): CheckResult {
  const value = context.env[variable.key];
  const envFile = ENV_FILES[context.target];

  if (value === undefined || value.length === 0) {
    if (!requiresExplicitValue(variable, context.target)) {
      return pass(
        variable.capability,
        variable.key,
        variable.defaultValue !== undefined
          ? `unset, defaults to ${variable.defaultValue}`
          : `unset, and not required for the ${context.target} target`,
      );
    }

    const fix = context.envFileFound
      ? `Add ${variable.key} to ${envFile} — ${setupHint(variable, context.target)}`
      : `cp .env.example ${envFile}, then set ${variable.key}`;

    return fail(variable.capability, variable.key, `not set in ${envFile}`, fix);
  }

  if (variable.placeholder !== undefined && value === variable.placeholder) {
    return fail(
      variable.capability,
      variable.key,
      `still the placeholder ${variable.placeholder}`,
      setupHint(variable, context.target),
    );
  }

  // A production deployment left on a local default is the same class of
  // failure as a placeholder, and far more expensive to discover later.
  if (
    context.target === 'production' &&
    variable.environments === 'per-environment' &&
    variable.defaultValue !== undefined &&
    value === variable.defaultValue
  ) {
    return fail(
      variable.capability,
      variable.key,
      `still the local default ${variable.defaultValue}`,
      setupHint(variable, context.target),
    );
  }

  const shape = shapeFor(variable, context.target);

  if (shape && !shape.test(value)) {
    return fail(
      variable.capability,
      variable.key,
      modeMismatch(variable, value, context.target) ??
        `does not match the expected ${context.target} shape ${String(shape)}`,
      setupHint(variable, context.target),
    );
  }

  // Never echo the value: a passing line for CLERK_SECRET_KEY must not print
  // the secret it just validated.
  return pass(variable.capability, variable.key, shape ? 'set, shape ok' : 'set');
}

export const environmentCheck: Check = {
  id: 2,
  title: 'Environment',
  async run(context) {
    const results: CheckResult[] = [];

    for (const capability of CAPABILITIES) {
      if (!context.capabilities.has(capability)) {
        continue;
      }

      for (const variable of variablesFor(capability)) {
        results.push(evaluateVariable(variable, context));
      }
    }

    return results;
  },
};
