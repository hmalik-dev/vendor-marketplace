import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AuthFieldProps extends Omit<React.ComponentProps<'input'>, 'id'> {
  label: string;
  helper?: string;
}

/** A labelled field for the sign-in and sign-up forms: frame `12`'s label over a 38px input. */
export function AuthField({ label, helper, ...input }: AuthFieldProps): React.ReactElement {
  const id = useId();

  return (
    <div className="mb-4 flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="bg-stone-0"
        aria-describedby={helper ? `${id}-helper` : undefined}
        {...input}
      />
      {helper ? (
        <p id={`${id}-helper`} className="text-helper text-stone-600">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
