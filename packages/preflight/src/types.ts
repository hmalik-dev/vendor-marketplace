import type { Capability } from '@vendor-marketplace/shared/env';

export type Target = 'local' | 'production';

export interface CheckContext {
  readonly repoRoot: string;
  /** `.env` merged under the real process environment, exactly as the apps see it. */
  readonly env: NodeJS.ProcessEnv;
  /** Whether a `.env` file was found at the repository root. */
  readonly envFileFound: boolean;
  readonly capabilities: ReadonlySet<Capability>;
  readonly target: Target;
}

export interface CheckResult {
  readonly ok: boolean;
  readonly capability: Capability;
  /** Short label, e.g. `Node >= 20`. */
  readonly name: string;
  /** What was found. Shown on both pass and fail when present. */
  readonly detail?: string;
  /** The literal command or URL that fixes a failure. */
  readonly fix?: string;
}

export interface Check {
  /** Number from the ticket's check table, used only for ordering. */
  readonly id: number;
  readonly title: string;
  run(context: CheckContext): Promise<CheckResult[]>;
}

export function pass(capability: Capability, name: string, detail?: string): CheckResult {
  return detail === undefined
    ? { ok: true, capability, name }
    : { ok: true, capability, name, detail };
}

export function fail(
  capability: Capability,
  name: string,
  detail: string,
  fix: string,
): CheckResult {
  return { ok: false, capability, name, detail, fix };
}
