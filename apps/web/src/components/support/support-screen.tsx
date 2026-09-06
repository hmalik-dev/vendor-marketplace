'use client';

import {
  BRAND_NAME,
  emailSchema,
  MAX_SUPPORT_MESSAGE_LENGTH,
  SUPPORT_TOPICS,
  SUPPORT_TOPIC_LABELS,
  SUPPORT_TOPIC_WITH_REFERENCE,
  supportMessageReceiptSchema,
  supportSendFailureDetailsSchema,
  type SupportErrorContext,
  type SupportTopic,
} from '@vendor-marketplace/shared';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SingleSelectDropdown } from '@/components/ui/dropdown-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError } from '@/lib/api-client';
import { FIELD_FOCUS } from '@/lib/focus';
import { useApi } from '@/lib/use-api';
import { userFacingError } from '@/lib/user-facing-error';
import { cn } from '@/lib/utils';

/**
 * Frame `29 Contact support`, all six states.
 *
 * It is a form and not a `mailto:` for four reasons the design settles and
 * this file does not relitigate: the destination is an env var, so it ships
 * before #374 rules on a monitored address and is never scraped; it carries
 * the error reference *for* the visitor rather than asking them to paste it;
 * Clerk already knows who a signed-in sender is; and the transport exists.
 *
 * **It is not a helpdesk.** There is no thread, no in-app reply, no ticket
 * status and no attachment, and both the sent state and the confirmation email
 * say so — precisely so nobody comes back here looking for a status this
 * product deliberately does not keep.
 */

export interface SupportScreenProps {
  /**
   * The address on the sender's account, or `null` when nobody is signed in.
   *
   * It is the whole difference between states 1 and 2: with one, identity comes
   * from the session and the reply-to row is a statement; without one, the
   * email field appears and has to justify itself.
   */
  accountEmail: string | null;
  /**
   * The digest, route and moment the 500 screen handed over — state 3.
   *
   * Already parsed by the page, which drops it whole if any part of it fails
   * its schema: a half-valid reference reaches the support inbox looking like a
   * log line that does not exist.
   */
  errorContext: SupportErrorContext | null;
}

/** The four phases the screen moves through. States 1-3 are all `editing`. */
type Phase = 'editing' | 'sending' | 'sent' | 'failed';

/**
 * The field fill frames `29` and `09` both draw: `#F1ECE4` on `#E4DDD1`,
 * 10px radius, 13.5px ink. The same constant the storefront and customer
 * editors use, for the same reason — one field shape, not three.
 */
const FIELD = cn(
  'h-auto w-full rounded-[10px] border border-stone-300 bg-stone-150 px-3.25 py-2.5 text-base text-stone-900',
  FIELD_FOCUS,
);

const HELPER = 'mt-1.5 text-[11.5px] text-stone-600';

/** `Jun 12, 2:41 PM` — the frame's own format, and UTC as everywhere else. */
const MOMENT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
});

const TOPIC_OPTIONS = SUPPORT_TOPICS.map((topic) => ({
  value: topic,
  label: SUPPORT_TOPIC_LABELS[topic],
}));

/**
 * The reference block the sent state hands back, with its copy control.
 *
 * `navigator.clipboard` is absent over plain HTTP and in a browser that has
 * refused the permission, so the control reports what happened rather than
 * silently doing nothing — a Copy that looks like it worked and did not is
 * worse than no Copy at all.
 */
function ReferenceBlock({ reference }: { reference: string }): React.ReactElement {
  const [copied, setCopied] = useState<'idle' | 'done' | 'unavailable'>('idle');

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied('done');
    } catch {
      setCopied('unavailable');
    }
  }

  return (
    <div className="w-full max-w-[290px] rounded-[11px] border border-stone-300 bg-stone-150 p-3.25">
      <p className="text-label font-semibold tracking-label text-stone-600 uppercase">
        Your reference
      </p>
      <div className="mt-1.75 flex items-center justify-center gap-2.5">
        <span className="font-mono text-[15px] tracking-[.02em] text-stone-900 select-all">
          {reference}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className={cn(
            'rounded-md text-[11.5px] font-semibold text-clay-500 hover:text-clay-600',
            FIELD_FOCUS,
          )}
        >
          {copied === 'done' ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-[1.45] text-stone-600">
        Quote this if you follow up. It&rsquo;s in the confirmation email too.
      </p>
      {/*
        Only when the browser refused. `role="status"` rather than an alert:
        the reference is on screen and selectable either way, so this is a note
        about the shortcut, not about the message.
      */}
      {copied === 'unavailable' ? (
        <p role="status" className="mt-2 text-[11px] leading-[1.45] text-stone-600">
          Your browser wouldn&rsquo;t let us copy it — select the code above instead.
        </p>
      ) : null}
    </div>
  );
}

export function SupportScreen({
  accountEmail,
  errorContext,
}: SupportScreenProps): React.ReactElement {
  const fieldId = useId();
  const request = useApi();

  const [topic, setTopic] = useState<SupportTopic | ''>(
    // Preselected only when a reference is attached — the visitor already said
    // what happened by arriving from the error screen.
    errorContext ? SUPPORT_TOPIC_WITH_REFERENCE : '',
  );
  const [topicOpen, setTopicOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState<Phase>('editing');
  const [reference, setReference] = useState<string | null>(null);
  /*
   * A refusal that is about what they typed, shown beside the fields rather
   * than as state 6.
   *
   * State 6 names the cause as **transport** and says in so many words that
   * editing cannot fix it. Routing a 400 there tells someone whose address is
   * missing its `.com` that the mail service is at fault, and offers them a
   * retry that re-sends the identical body and fails identically. So the two
   * are separated by status: 4xx is theirs to fix and stays in `editing`,
   * 5xx and a dead network are ours and are state 6.
   */
  const [refusal, setRefusal] = useState<string | null>(null);

  const topicId = `${fieldId}-topic`;
  const emailId = `${fieldId}-email`;
  const messageId = `${fieldId}-message`;

  const locked = phase === 'sending';
  const replyTo = accountEmail ?? email;

  /*
   * The address has to be one the answer can actually reach, and the schema
   * that decides is the API's own rather than a second regex written here —
   * `ana@nandakumar` is the commonest typo there is, and it clears every
   * "contains an @" check.
   */
  const emailIsUsable = accountEmail !== null || emailSchema.safeParse(email.trim()).success;

  /*
   * The button is held shut until there is something to send. `40-states.md`
   * prefers a blocker the reader cannot cross to a message explaining that
   * they did, and every one of these is knowable without a round trip.
   */
  const incomplete = topic === '' || message.trim() === '' || !emailIsUsable;

  async function send(): Promise<void> {
    /*
     * Re-entrancy guard as well as the disabled button, because the two fail
     * differently: the button can be re-enabled by a render, and a keyboard
     * `Enter` held down repeats. A second send would put two reports in the
     * inbox, two receipts in their mailbox, and two references on a screen
     * that can only show the last one.
     */
    if (topic === '' || phase === 'sending') {
      return;
    }

    setPhase('sending');
    setRefusal(null);

    try {
      const receipt = await request('/support/messages', {
        schema: supportMessageReceiptSchema,
        method: 'POST',
        body: {
          topic,
          message,
          ...(accountEmail === null ? { email } : {}),
          ...(errorContext ? { errorContext } : {}),
        },
      });

      setReference(receipt.reference);
      setPhase('sent');
    } catch (error) {
      /*
       * A 4xx is about the request, not the transport — a malformed address, a
       * rate limit, an expired session. `userFacingError` keeps the API's own
       * sentence where it wrote one and replaces its generic shapes with the
       * fallback below, exactly as every other form in the product does.
       */
      if (error instanceof ApiClientError && error.statusCode < 500) {
        setRefusal(userFacingError(error, 'Check the details above, then send again.'));
        setPhase('editing');
        return;
      }

      /*
       * The reference the API issued *before* it attempted the send, which is
       * what lets a failed message still be something the visitor can ask
       * about. A failure that carries none is still state 6 — the copy below
       * names the cause either way — it simply has no code to quote.
       */
      const details =
        error instanceof ApiClientError
          ? supportSendFailureDetailsSchema.safeParse(error.details)
          : null;

      setReference(details?.success === true ? details.data.reference : null);
      setPhase('failed');
    }
  }

  if (phase === 'sent' && reference !== null) {
    return (
      <div className="flex flex-col items-center px-4 py-14 text-center">
        <span
          aria-hidden="true"
          className="mb-4 flex size-10.5 items-center justify-center rounded-full bg-sage-50"
        >
          <span className="mt-[-3px] h-1.75 w-3.25 rotate-[-45deg] border-b-2 border-l-2 border-sage-600" />
        </span>

        <h1 className="font-display text-[23px] text-stone-900">Message sent</h1>

        <p className="mt-2.25 max-w-[290px] text-[13px] leading-[1.6] text-stone-700">
          We&rsquo;ll reply to <strong className="font-semibold text-stone-900">{replyTo}</strong>,
          usually within one business day.
        </p>

        <div className="mt-4.5 flex justify-center">
          <ReferenceBlock reference={reference} />
        </div>

        <p className="mt-4 max-w-[290px] text-[12px] leading-[1.55] text-stone-600">
          There&rsquo;s nothing to check back on here — the answer comes to your inbox.
        </p>

        <Button asChild variant="secondary" className="mt-4.5 w-full max-w-[250px] justify-center">
          <Link href="/search">Back to browsing</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[620px] px-4 py-11 sm:px-6 lg:px-8">
      <p className="text-label font-semibold tracking-label text-stone-600 uppercase">Support</p>

      <h1 className="display-heading mt-2.25 text-[31px] text-stone-900">Tell us what happened</h1>

      <p className="mt-2.25 text-base leading-[1.65] text-stone-700">
        We reply by email, usually within one business day. This sends a message to the {BRAND_NAME}{' '}
        team — it doesn&rsquo;t open a chat thread here.
      </p>

      {/*
        State 6. The reference is issued before the send resolves, so a message
        the mail service rejected still has a handle — and the cause is named as
        *transport* so nobody rewords a message that was fine.

        A bespoke panel rather than `Banner`: frame `29` draws states 2, 4 and 6
        as notes rather than as rendered frames, and `40-states.md` — which is
        the law both answer to — puts a failure in the red wash this uses.
        `Banner` is the same two tokens with a dot and a stone title, and is
        what every *standing* failure in the product renders as; this one is
        the outcome of the action directly above it, which is the case frame
        `26` draws inline.
      */}
      {phase === 'failed' ? (
        <div
          role="alert"
          className="mt-5.5 rounded-[10px] border border-error-200 bg-error-50 px-3.25 py-3"
        >
          <p className="text-[12.5px] font-semibold text-clay-600">
            Your message didn&rsquo;t go through — our mail service rejected it
          </p>
          <p className="mt-1 text-[11.5px] leading-[1.5] text-stone-700">
            Nothing you typed is lost, and it isn&rsquo;t something you can fix by editing it.
            {reference === null ? null : (
              <>
                {' '}
                We&rsquo;ve logged the failure as{' '}
                <span className="font-mono text-[11px] select-all">{reference}</span>.
              </>
            )}
          </p>
        </div>
      ) : null}

      {/*
        State 3. Stone block, mono type, no input chrome and no clear
        affordance: there is nothing to copy and no field to accidentally empty.
      */}
      {errorContext ? (
        <div className="mt-5.5 rounded-[12px] border border-stone-300 bg-stone-150 px-3.75 py-3.5">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex size-3.75 items-center justify-center rounded-[4px] bg-stone-200"
            >
              <span className="h-[1.6px] w-1.75 rotate-[-45deg] rounded-[2px] bg-stone-600" />
            </span>
            <p className="text-label font-semibold tracking-[.06em] text-stone-600 uppercase">
              Attached automatically
            </p>
          </div>

          <div className="mt-2 flex items-baseline justify-between gap-3">
            <span className="font-mono text-[13px] break-all text-stone-900">
              {errorContext.digest}
            </span>
            <span className="shrink-0 text-[11.5px] text-stone-600">
              {MOMENT.format(new Date(errorContext.occurredAt))} · {errorContext.route}
            </span>
          </div>

          <p className="mt-2 text-[11.5px] leading-[1.5] text-stone-600">
            The reference from the page you came from. It points at the exact entry in our server
            log, so we can look before we ask you anything. Nothing to copy, and no field to
            accidentally clear.
          </p>
        </div>
      ) : null}

      <div className="mt-4">
        <Label htmlFor={topicId}>Topic</Label>
        {/* The one dropdown, not a native `<select>` (#167). */}
        <SingleSelectDropdown
          open={topicOpen}
          onOpenChange={(next) => setTopicOpen(locked ? false : next)}
          label="Topic"
          countNoun="topics"
          options={TOPIC_OPTIONS}
          value={topic}
          onChange={(next) => setTopic(next as SupportTopic)}
          trigger={
            <button
              type="button"
              id={topicId}
              aria-haspopup="listbox"
              aria-expanded={topicOpen}
              disabled={locked}
              // A bordered field owns its indicator; see `@/lib/focus`.
              data-focus-own
              className={cn(
                FIELD,
                'mt-1.5 flex items-center justify-between gap-2 text-left disabled:opacity-50',
              )}
            >
              <span className={cn('truncate', topic === '' && 'text-stone-600')}>
                {topic === '' ? 'Choose a topic' : SUPPORT_TOPIC_LABELS[topic]}
              </span>
            </button>
          }
        />
      </div>

      {/*
        State 1's one field, and the only one that has to justify itself. A
        signed-in sender never sees it: identity comes from the session, so
        there is no typo that can lose them an answer.
      */}
      {accountEmail === null ? (
        <div className="mt-4">
          <Label htmlFor={emailId}>Your email</Label>
          <Input
            id={emailId}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            readOnly={locked}
            className={cn(FIELD, 'mt-1.5')}
          />
          <p className={HELPER}>The only address we&rsquo;ll use, and only to answer this.</p>
        </div>
      ) : null}

      <div className="mt-4">
        <Label htmlFor={messageId}>Message</Label>
        <Textarea
          id={messageId}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="What happened, and what you expected instead"
          // Capped at the API's own limit, so the refusal is unreachable by
          // typing — `web-route-boundaries.md`, and #408's rule that a value
          // the schema accepts must fit what receives it.
          maxLength={MAX_SUPPORT_MESSAGE_LENGTH}
          readOnly={locked}
          className={cn(FIELD, 'mt-1.5 min-h-[132px] leading-[1.6]')}
        />
        <p className={HELPER}>What you were doing, and what you expected instead.</p>
      </div>

      {/*
        State 2. A statement, not an input: changing where replies go means
        changing the account.
      */}
      {accountEmail === null ? null : (
        <p className="mt-4 rounded-[10px] border border-stone-300 bg-stone-0 px-3.25 py-2.75 text-[12.5px] leading-[1.4] text-stone-700">
          We&rsquo;ll reply to{' '}
          <strong className="font-semibold text-stone-900">{accountEmail}</strong> — the email on
          your account.
        </p>
      )}

      <div className="mt-5.5 flex flex-wrap items-center gap-3.5">
        {/*
          State 4: one idiom for the whole screen — full clay fill, the ring in
          place of nothing, the label to the present participle, fields
          read-only. No tint, because a lightened button loses contrast against
          its own white label; no skeleton, because the content is already on
          screen; no overlay, because it would hide the message they just wrote.
        */}
        <Button
          type="button"
          variant="primary"
          loading={locked}
          /*
           * `locked` is repeated rather than left to `Button`'s own
           * `disabled ?? loading`: `incomplete` is always a boolean, so the
           * `??` never falls through to it, and the control would keep its
           * pointer events for the whole of `Sending…`.
           */
          disabled={incomplete || locked}
          onClick={() => void send()}
        >
          {/*
            One action, and one only. There is no fallback address yet (#374),
            so a second button would imply a choice that does not exist.
          */}
          {locked ? 'Sending…' : phase === 'failed' ? 'Try again' : 'Send message'}
        </Button>
        <span className="text-[12.5px] text-stone-600">
          {locked ? 'Fields locked' : 'One email, no ticket to track.'}
        </span>
      </div>

      {/*
        A refusal about the request rather than the transport. It sits under
        the control that produced it and does not disable that control — the
        next keystroke is what answers it.
      */}
      {refusal === null ? null : (
        <p role="alert" className="mt-3 text-[12.5px] text-error-500">
          {refusal}
        </p>
      )}
    </div>
  );
}
