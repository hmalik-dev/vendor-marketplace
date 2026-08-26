import { z } from 'zod';

const emailAddressSchema = z.object({
  id: z.string(),
  email_address: z.string(),
});

/**
 * Only the fields the local `users` row mirrors. Clerk sends a much larger
 * payload and adds to it over time, so unknown keys are ignored rather than
 * rejected.
 */
const userDataSchema = z.object({
  id: z.string().min(1),
  email_addresses: z.array(emailAddressSchema).optional(),
  primary_email_address_id: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  unsafe_metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const clerkWebhookEventSchema = z.object({
  type: z.string().min(1),
  data: userDataSchema,
});

export type ClerkWebhookEvent = z.infer<typeof clerkWebhookEventSchema>;
export type ClerkWebhookUserData = z.infer<typeof userDataSchema>;

/** Resolves the address Clerk marks primary, falling back to the first listed. */
export function primaryEmail(data: ClerkWebhookUserData): string | null {
  const addresses = data.email_addresses ?? [];
  const primary = addresses.find((address) => address.id === data.primary_email_address_id);
  return primary?.email_address ?? addresses[0]?.email_address ?? null;
}
