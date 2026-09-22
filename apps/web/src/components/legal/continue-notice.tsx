import { LEGAL_PATHS } from '@vendor-marketplace/shared';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * "By continuing you agree to the Terms and Privacy Policy" — the notice that
 * sits directly under a submit which means agreement (VEN-507).
 *
 * It is a notice, not a control: there is no box to tick. On the sign-up form
 * it records nothing; on the confirm screen the submit that follows it writes
 * the acceptance. Both links open in a new tab so reading them costs the reader
 * nothing they have typed.
 */
export function ContinueNotice({ className }: { className?: string }): React.ReactElement {
  const link = 'font-semibold text-clay-500 underline underline-offset-4';

  return (
    <p className={cn('text-center text-helper text-stone-700', className)} data-continue-notice="">
      By continuing you agree to the{' '}
      <Link href={LEGAL_PATHS.terms} target="_blank" rel="noopener noreferrer" className={link}>
        Terms
      </Link>{' '}
      and{' '}
      <Link href={LEGAL_PATHS.privacy} target="_blank" rel="noopener noreferrer" className={link}>
        Privacy Policy
      </Link>
      .
    </p>
  );
}
