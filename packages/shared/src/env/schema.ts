import { z } from 'zod';
import {
  type Consumer,
  type EnvVariable,
  type RegistryEntryFor,
  type RegistryKey,
  type ShapeTarget,
  requiresExplicitValue,
  shapeFor,
} from './registry.js';
import { type Capability, variablesForAll } from './capabilities.js';
import { pointsAtLoopback } from './deployment.js';

export interface SchemaShapeOptions<
  TConsumer extends Consumer = Consumer,
  TCapability extends Capability = Capability,
> {
  /** The surface deriving the schema — only rows it reads are included. */
  readonly consumer: TConsumer;
  readonly capabilities: readonly TCapability[];
  /**
   * Which value set to enforce. Defaults to `baseline` — the apps derive their
   * schema at build and boot time, where they cannot prove which environment
   * they are in, so a mode restriction there would reject the live keys that
   * are correct in production. `pnpm preflight` is the caller that knows.
   */
  readonly target?: ShapeTarget;
}

/**
 * A row with a default parses from `undefined`; one that is `optionalFor` this
 * target parses from `undefined` to `undefined`; anything else is required. The
 * type describes the baseline target, where a default always applies — a
 * narrower target only ever narrows what is accepted, never what the value is —
 * so the optional branch checks for `baseline` explicitly rather than for any
 * exemption at all.
 *
 * The two are ordered rather than combined because they cannot both apply: a
 * row with a default has nothing to be optional about, and `.default()` already
 * makes absence legal.
 */
type FieldFor<TEntry> = TEntry extends { readonly defaultValue: string }
  ? z.ZodDefault<z.ZodString>
  : TEntry extends { readonly optionalFor: readonly (infer TTargets)[] }
    ? 'baseline' extends TTargets
      ? z.ZodOptional<z.ZodString>
      : z.ZodString
    : z.ZodString;

/** The Zod shape a consumer's rows contribute, keyed by their literal keys. */
export type RegistryShape<TConsumer extends Consumer, TCapability extends Capability> = {
  [TEntry in RegistryEntryFor<TConsumer, TCapability> as TEntry['key']]: FieldFor<TEntry>;
};

/**
 * Keys whose value is a credential, and must not be echoed into a boot log.
 *
 * The "still on its development default" message names the value so the
 * operator knows what to replace. That is right for a URL and wrong for a
 * secret: nothing sensitive defaults today, but the first row that does would
 * print itself into every failed deployment's log.
 */
const SECRET_KEY = /KEY|SECRET|TOKEN|PASSWORD/;

function schemaFor(variable: EnvVariable, target: ShapeTarget): z.ZodTypeAny {
  const shape = shapeFor(variable, target);
  const explicit = requiresExplicitValue(variable, target);

  /*
   * A row that *has* a default and must be stated anyway is the failure this
   * message exists for: on a deployment the development default is not a
   * fallback, it is the defect. Saying so names the fix, where a bare
   * "is required" sends the operator looking for a value that is right there
   * in `.env.example`.
   */
  const fallback = SECRET_KEY.test(variable.key)
    ? 'its development default'
    : `its development default (${variable.defaultValue})`;
  const missing =
    explicit && variable.defaultValue !== undefined
      ? `${variable.key} is required on a deployment: it differs per environment, and ${fallback} must never be served to real users`
      : `${variable.key} is required`;

  let field = z.string({ error: missing }).min(1, missing);

  if (shape) {
    field = field.regex(shape, `${variable.key} does not look like a real value`);
  }

  /*
   * Requiring a value to be *stated* is not the whole law: a deployment that
   * sets `S3_ENDPOINT=http://localhost:9000` by hand satisfies presence and is
   * still the development default reaching production. A loopback host is
   * never a public deployment's own — the app talks to Neon, R2 and Clerk over
   * the network — so refusing one closes the half that absence does not. Per
   * *entry*, because `WEB_URL` is a comma-separated allow-list and its first
   * entry is the origin handed to Stripe.
   */
  const checked =
    target === 'deployed'
      ? field.refine((value) => !pointsAtLoopback(value), {
          error: `${variable.key} points at localhost, which no deployment can reach`,
        })
      : field;

  if (variable.defaultValue !== undefined) {
    return explicit ? checked : checked.default(variable.defaultValue);
  }

  /*
   * A row with no default that this target excuses is genuinely absent-able,
   * and until #439 no such row was read by an app — `DATABASE_URL_UNPOOLED`
   * and `NEON_BRANCH` are `tooling` only. Without this branch
   * `RESEND_WEBHOOK_SECRET` would be *required* by the API despite being
   * declared optional everywhere, which is the whole point of that row: a
   * deployment whose account holder has not configured the Resend webhook must
   * still boot and must still record what it attempted to send.
   *
   * **Empty is absent**, and that is the half a plain `.optional()` gets wrong.
   * `''` would otherwise fail both `min(1)` and the row's shape and refuse the
   * whole boot — for a variable declared in a hosting dashboard with the box
   * left blank, a `.env` line with nothing after the `=`, or a `cp
   * .env.example .env` where only the used rows were filled in. Preflight
   * already treats empty and unset as one thing (`environment.ts` checks
   * `length === 0`), so the two agreeing is what keeps a green preflight from
   * preceding a server that will not start.
   */
  return explicit
    ? checked
    : z.preprocess((value) => (value === '' ? undefined : value), checked.optional());
}

function rowsFor<TConsumer extends Consumer, TCapability extends Capability>(
  options: Pick<SchemaShapeOptions<TConsumer, TCapability>, 'consumer' | 'capabilities'>,
): readonly EnvVariable[] {
  return variablesForAll(options.capabilities).filter((variable) =>
    variable.consumers.includes(options.consumer),
  );
}

/**
 * Builds the Zod shape for every registry row a consumer reads, so the API and
 * the web build validate exactly the contract the registry declares rather than
 * restating it.
 */
export function registrySchemaShape<TConsumer extends Consumer, TCapability extends Capability>(
  options: SchemaShapeOptions<TConsumer, TCapability>,
): RegistryShape<TConsumer, TCapability> {
  const target = options.target ?? 'baseline';
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const variable of rowsFor(options)) {
    shape[variable.key] = schemaFor(variable, target);
  }

  return shape as RegistryShape<TConsumer, TCapability>;
}

/** Every key a consumer reads within a set of capabilities, in registry order. */
export function registryKeys<TConsumer extends Consumer, TCapability extends Capability>(
  options: Omit<SchemaShapeOptions<TConsumer, TCapability>, 'target'>,
): RegistryKey<TConsumer, TCapability>[] {
  return rowsFor(options).map((variable) => variable.key) as RegistryKey<TConsumer, TCapability>[];
}
