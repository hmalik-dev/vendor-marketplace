'use client';

import {
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  MAX_VENDOR_APPLICATION_MESSAGE_LENGTH,
  vendorApplicationInputSchema,
  vendorApplicationReceiptSchema,
  type VendorApplicationInput,
} from '@vendor-marketplace/shared';
import { useId, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApi } from '@/lib/use-api';
import { userFacingError } from '@/lib/user-facing-error';

export interface VendorApplicationFormProps {
  /**
   * The signed-in address the vendor gate refused, or `null` for a visitor.
   * When present it is the address applied with and is not editable: the
   * invite has to name the email this person will sign up with again.
   */
  sessionEmail: string | null;
}

type Field = keyof VendorApplicationInput;

const FIELDS: readonly {
  name: Exclude<Field, 'email' | 'message'>;
  label: string;
  autoComplete: string;
}[] = [
  { name: 'businessName', label: 'Business name', autoComplete: 'organization' },
  { name: 'category', label: 'What you offer', autoComplete: 'off' },
  { name: 'city', label: 'City', autoComplete: 'address-level2' },
];

const LABEL = 'text-sm font-semibold text-stone-700';

/** The waitlist form the vendor gate sends an un-invited vendor to (VEN-406). */
export function VendorApplicationForm({
  sessionEmail,
}: VendorApplicationFormProps): React.ReactElement {
  const call = useApi();
  const fieldId = useId();
  const [values, setValues] = useState<VendorApplicationInput>({
    email: sessionEmail ?? '',
    businessName: '',
    category: '',
    city: '',
    message: '',
  });
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function set(name: Field, value: string): void {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    const parsed = vendorApplicationInputSchema.safeParse(values);

    if (!parsed.success) {
      setProblem('Fill in your email, business name, what you offer and your city.');
      return;
    }

    setSaving(true);
    setProblem(null);

    try {
      await call('/vendor-applications', {
        method: 'POST',
        body: parsed.data,
        schema: vendorApplicationReceiptSchema,
      });
      setSentTo(parsed.data.email);
    } catch (error) {
      setProblem(userFacingError(error, 'Your application did not send. Try again.'));
    } finally {
      setSaving(false);
    }
  }

  if (sentTo !== null) {
    return (
      <Banner status="settled" title="Application received">
        We will email {sentTo} if we invite you. Then sign in with that same email, or sign up with
        it and choose vendor if you have no account yet.
      </Banner>
    );
  }

  return (
    // `noValidate`: this form owns its submit, and the browser's validation would cancel it (#388).
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {problem ? (
        <Banner status="failed" title="Not sent">
          {problem}
        </Banner>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${fieldId}-email`} className={LABEL}>
          Email
        </label>
        <Input
          id={`${fieldId}-email`}
          type="email"
          autoComplete="email"
          maxLength={MAX_EMAIL_LENGTH}
          value={values.email}
          readOnly={sessionEmail !== null}
          onChange={(event) => set('email', event.target.value)}
        />
      </div>

      {FIELDS.map((field) => (
        <div key={field.name} className="flex flex-col gap-1.5">
          <label htmlFor={`${fieldId}-${field.name}`} className={LABEL}>
            {field.label}
          </label>
          <Input
            id={`${fieldId}-${field.name}`}
            autoComplete={field.autoComplete}
            maxLength={MAX_NAME_LENGTH}
            value={values[field.name]}
            onChange={(event) => set(field.name, event.target.value)}
          />
        </div>
      ))}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${fieldId}-message`} className={LABEL}>
          Anything we should know <span className="font-normal text-stone-600">(optional)</span>
        </label>
        <Textarea
          id={`${fieldId}-message`}
          maxLength={MAX_VENDOR_APPLICATION_MESSAGE_LENGTH}
          value={values.message}
          onChange={(event) => set('message', event.target.value)}
        />
      </div>

      <Button type="submit" variant="primary" size="lg" disabled={saving} loading={saving}>
        {saving ? 'Sending…' : 'Apply to join'}
      </Button>
    </form>
  );
}
