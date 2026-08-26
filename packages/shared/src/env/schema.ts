import { z } from 'zod';
import {
  type Consumer,
  type EnvVariable,
  type RegistryEntryFor,
  type RegistryKey,
  requiresExplicitValue,
  shapeFor,
} from './registry.js';
import { type Capability, variablesForAll } from './capabilities.js';

export interface SchemaShapeOptions<
  TConsumer extends Consumer = Consumer,
  TCapability extends Capability = Capability,
> {
  /** The surface deriving the schema — only rows it reads are included. */
  readonly consumer: TConsumer;
  readonly capabilities: readonly TCapability[];
  /** Which shape to enforce. Defaults to `local`. */
  readonly target?: 'local' | 'production';
}

/**
 * A row with a default parses from `undefined`; one without does not. The type
 * describes the local target, where a default always applies — a production
 * schema only ever narrows what is accepted, never what the value is.
 */
type FieldFor<TEntry> = TEntry extends { readonly defaultValue: string }
  ? z.ZodDefault<z.ZodString>
  : z.ZodString;

/** The Zod shape a consumer's rows contribute, keyed by their literal keys. */
export type RegistryShape<TConsumer extends Consumer, TCapability extends Capability> = {
  [TEntry in RegistryEntryFor<TConsumer, TCapability> as TEntry['key']]: FieldFor<TEntry>;
};

function schemaFor(variable: EnvVariable, target: 'local' | 'production'): z.ZodTypeAny {
  const shape = shapeFor(variable, target);

  let field = z.string().min(1, `${variable.key} is required`);

  if (shape) {
    field = field.regex(shape, `${variable.key} does not look like a real value`);
  }

  return requiresExplicitValue(variable, target) || variable.defaultValue === undefined
    ? field
    : field.default(variable.defaultValue);
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
  const target = options.target ?? 'local';
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
