'use client';

import { MAX_NAME_LENGTH, personalNameInputSchema } from '@vendor-marketplace/shared';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { ACCOUNT_SETTINGS_PATH, SETTINGS_SAVED_PARAM } from '@/components/account/settings-paths';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApi } from '@/lib/use-api';
import { userFacingError } from '@/lib/user-facing-error';
import { wireUserSchema } from '@/lib/wire-schemas';

const LABEL = 'text-sm font-semibold text-stone-700';

export interface ChangeNameFormProps {
  firstName: string;
  lastName: string;
}

/**
 * The name row's page (VEN-703): first and last name for every role, held to
 * the same shared schema the customer-details step uses and written through
 * the same `PUT /users/me`. Success goes back to the list, whose banner
 * confirms it; the refresh re-reads the layout so the header's initials follow.
 */
export function ChangeNameForm(props: ChangeNameFormProps): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const fieldId = useId();
  const [firstName, setFirstName] = useState(props.firstName);
  const [lastName, setLastName] = useState(props.lastName);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (saving) {
      return;
    }

    const parsed = personalNameInputSchema.safeParse({ firstName, lastName });
    if (!parsed.success) {
      setProblem('Enter your first and last name.');
      return;
    }

    setSaving(true);
    setProblem(null);

    try {
      await call('/users/me', { method: 'PUT', body: parsed.data, schema: wireUserSchema });
    } catch (error) {
      setProblem(userFacingError(error, "That didn't save — try again."));
      setSaving(false);
      return;
    }

    router.push(`${ACCOUNT_SETTINGS_PATH}?${SETTINGS_SAVED_PARAM}=name`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {problem ? (
        <Banner status="failed" role="alert" title="That did not save">
          {problem}
        </Banner>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${fieldId}-first`} className={LABEL}>
            First name
          </label>
          <Input
            id={`${fieldId}-first`}
            autoComplete="given-name"
            maxLength={MAX_NAME_LENGTH}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${fieldId}-last`} className={LABEL}>
            Last name
          </label>
          <Input
            id={`${fieldId}-last`}
            autoComplete="family-name"
            maxLength={MAX_NAME_LENGTH}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>
      </div>

      <Button type="submit" loading={saving} disabled={saving} className="self-start">
        Save name
      </Button>
    </form>
  );
}
