import {
  CAPABILITIES,
  type EnvVariable,
  requiresExplicitValue,
  shapeFor,
  variablesFor,
} from '@vendorhub/shared/env';
import { ENV_FILES } from '../context.js';
import { type Check, type CheckContext, type CheckResult, fail, pass } from '../types.js';

function setupHint(variable: EnvVariable): string {
  return [...variable.setup.steps, variable.setup.url].join(' · ');
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
      return pass(variable.capability, variable.key, `unset, defaults to ${variable.defaultValue}`);
    }

    const fix = context.envFileFound
      ? `Add ${variable.key} to ${envFile} — ${setupHint(variable)}`
      : `cp .env.example ${envFile}, then set ${variable.key}`;

    return fail(variable.capability, variable.key, `not set in ${envFile}`, fix);
  }

  if (variable.placeholder !== undefined && value === variable.placeholder) {
    return fail(
      variable.capability,
      variable.key,
      `still the placeholder ${variable.placeholder}`,
      setupHint(variable),
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
      setupHint(variable),
    );
  }

  const shape = shapeFor(variable, context.target);

  if (shape && !shape.test(value)) {
    return fail(
      variable.capability,
      variable.key,
      `does not match the expected ${context.target} shape ${String(shape)}`,
      setupHint(variable),
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
