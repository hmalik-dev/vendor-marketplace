'use client';

import {
  BOOKING_REQUEST_NOTES_MAX_LENGTH,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  MAX_GUEST_COUNT,
  bookingRequestDetailSchema,
  isUniversallyPastDate,
  type AvailabilityStatus,
  type EventType,
} from '@vendor-marketplace/shared';
import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { RequestStepper } from '@/components/booking/request-stepper';
import {
  RequestSummaryRail,
  type RailPackage,
  type RailVendor,
} from '@/components/booking/request-summary-rail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import {
  describeBlockerCount,
  useSubmitValidation,
  type FieldIssue,
} from '@/lib/use-submit-validation';
import { cn } from '@/lib/utils';

export interface BookingRequestScreenProps {
  vendorId: string;
  vendorSlug: string;
  vendor: RailVendor;
  /** The vendor's own reply window, when they have declared one. */
  responseTimeHours: number | null;
  servicePackage: (RailPackage & { id: string; maxGuests: number | null }) | null;
  /** Dates the vendor's calendar has a row for, keyed by `YYYY-MM-DD`. */
  calendar: Readonly<Record<string, AvailabilityStatus>>;
  /** Pre-filled from the search or the profile rail the customer came from. */
  initialDate: string;
  /** `todayDateString()` resolved on the server, so the two agree. */
  today: string;
}

interface FormState {
  eventDate: string;
  eventType: EventType | '';
  eventStartTime: string;
  guestCount: string;
  eventLocation: string;
  notes: string;
}

const FIELD_LABELS = {
  eventDate: 'Event date',
  eventType: 'Event type',
  eventStartTime: 'Start time',
  guestCount: 'Guest count',
  eventLocation: 'Venue or location',
  notes: 'Anything else they should know?',
  customDetails: 'Describe what you need',
} as const;

/**
 * Frame `04`, with frame `22`'s validation vocabulary applied to it.
 *
 * One page, three phases inside it: fill the form, review what is going out,
 * then a success panel that names what happens next — never a dead-end
 * confirmation page. The rail never leaves, so the vendor, the package and the
 * total are visible the whole way through.
 */
export function BookingRequestScreen({
  vendorId,
  vendorSlug,
  vendor,
  responseTimeHours,
  servicePackage,
  calendar,
  initialDate,
  today,
}: BookingRequestScreenProps): React.ReactElement {
  const fieldId = useId();
  const request = useApi();

  const [form, setForm] = useState<FormState>({
    eventDate: initialDate,
    eventType: '',
    eventStartTime: '',
    guestCount: '',
    eventLocation: '',
    notes: '',
  });
  const [customDetails, setCustomDetails] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [sendFailure, setSendFailure] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void =>
    setForm((current) => ({ ...current, [key]: value }));

  const dateStatus = form.eventDate ? (calendar[form.eventDate] ?? 'available') : 'available';

  const issues = useMemo<FieldIssue[]>(() => {
    const found: FieldIssue[] = [];

    const blocker = (field: keyof typeof FIELD_LABELS, message: string): void => {
      found.push({
        field: `${fieldId}-${field}`,
        label: FIELD_LABELS[field],
        message,
        severity: 'blocker',
      });
    };

    if (!form.eventDate) {
      blocker(
        'eventDate',
        'Pick the day of the event — the vendor answers with their calendar open.',
      );
    } else if (isUniversallyPastDate(form.eventDate, new Date()) || form.eventDate < today) {
      blocker('eventDate', 'That day has passed. Pick a date from today onwards.');
    } else if (dateStatus === 'booked' || dateStatus === 'pending') {
      blocker(
        'eventDate',
        `${vendor.businessName} is already taken on that date. Pick another day.`,
      );
    } else if (dateStatus === 'blocked') {
      found.push({
        field: `${fieldId}-eventDate`,
        label: FIELD_LABELS.eventDate,
        message: `${vendor.businessName} has this date blocked. You can still send the request, but they may well decline.`,
        severity: 'costly',
      });
    }

    if (!form.eventType) {
      blocker('eventType', 'Say what the occasion is — it changes what the vendor quotes.');
    }

    if (form.guestCount) {
      const guests = Number.parseInt(form.guestCount, 10);

      if (!Number.isFinite(guests) || guests < 1) {
        blocker('guestCount', 'Enter how many people are coming, as a whole number.');
      } else if (guests > MAX_GUEST_COUNT) {
        blocker('guestCount', `That is more than ${MAX_GUEST_COUNT.toLocaleString()} guests.`);
      } else if (servicePackage?.maxGuests && guests > servicePackage.maxGuests) {
        blocker(
          'guestCount',
          `${vendor.businessName} covers events up to ${servicePackage.maxGuests} guests. Enter ${servicePackage.maxGuests} or fewer, or pick a larger package.`,
        );
      }
    }

    if (form.notes.length > BOOKING_REQUEST_NOTES_MAX_LENGTH) {
      blocker(
        'notes',
        `You are ${form.notes.length - BOOKING_REQUEST_NOTES_MAX_LENGTH} characters over. Trim it to ${BOOKING_REQUEST_NOTES_MAX_LENGTH}.`,
      );
    }

    if (!servicePackage && customDetails.trim().length < 10) {
      blocker(
        'customDetails',
        'Describe what you need in a sentence or two, so there is something to quote.',
      );
    }

    return found;
  }, [form, customDetails, dateStatus, servicePackage, vendor.businessName, today, fieldId]);

  const validation = useSubmitValidation(issues);

  async function send(): Promise<void> {
    setSubmitting(true);
    setSendFailure(null);

    try {
      const created = await request('/booking-requests', {
        schema: bookingRequestDetailSchema.pick({ id: true }),
        method: 'POST',
        body: {
          vendorId,
          ...(servicePackage ? { packageId: servicePackage.id } : {}),
          eventDate: form.eventDate,
          ...(form.eventType ? { eventType: form.eventType } : {}),
          ...(form.eventStartTime ? { eventStartTime: form.eventStartTime } : {}),
          ...(form.eventLocation.trim() ? { eventLocation: form.eventLocation.trim() } : {}),
          ...(form.guestCount ? { guestCount: Number.parseInt(form.guestCount, 10) } : {}),
          ...(servicePackage
            ? form.notes.trim()
              ? { customDetails: form.notes.trim() }
              : {}
            : { customDetails: customDetails.trim() }),
        },
      });

      setSentAt(created.id);
    } catch (error) {
      setSendFailure(
        error instanceof ApiClientError
          ? error.message
          : 'The request did not reach us. Check your connection and send it again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (sentAt) {
    return (
      <SuccessPanel
        businessName={vendor.businessName}
        vendorSlug={vendorSlug}
        responseTimeHours={responseTimeHours}
      />
    );
  }

  const primaryLabel = step === 1 ? 'Continue to review' : 'Send request';

  return (
    <div className="mx-auto grid w-full max-w-[1360px] gap-8.5 px-6 pt-6.5 pb-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px] xl:px-10">
      <div className="min-w-0">
        <RequestStepper current={step} />

        <h1 className="mb-1 font-display text-[26px] tracking-[-.01em] text-stone-900">
          {step === 1
            ? `Tell ${vendor.businessName} about your event`
            : 'Check this over before it goes'}
        </h1>
        <p className="mb-5 text-md text-stone-700">
          {step === 1
            ? 'The more they know now, the fewer messages it takes to lock the date.'
            : 'Nothing is sent yet. Edit anything that is not right.'}
        </p>

        {validation.attempted && validation.blockers.length > 0 ? (
          <div className="mb-5 flex max-w-[640px] items-start gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-3.25">
            <span
              aria-hidden="true"
              className="mt-0.25 size-4.5 shrink-0 rounded-full bg-error-500"
            />
            <div>
              <p className="mb-0.75 text-base font-semibold text-stone-900">
                {describeBlockerCount(validation.blockers.length)}
              </p>
              <p className="text-sm text-stone-700">
                {validation.blockers.map((issue, index) => (
                  <span key={issue.field}>
                    {index > 0 ? ' · ' : null}
                    <a
                      href={`#${issue.field}`}
                      className="font-semibold text-error-500 underline underline-offset-2"
                    >
                      {issue.label}
                    </a>
                  </span>
                ))}
              </p>
            </div>
          </div>
        ) : null}

        {sendFailure ? (
          <div className="mb-5 flex max-w-[640px] items-start gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-3.25">
            <span
              aria-hidden="true"
              className="mt-0.25 size-4.5 shrink-0 rounded-full bg-error-500"
            />
            <p className="text-base text-stone-900">{sendFailure}</p>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid max-w-[660px] grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <Field
              id={`${fieldId}-eventDate`}
              label={FIELD_LABELS.eventDate}
              issue={validation.issueFor(`${fieldId}-eventDate`)}
              hint={
                dateStatus === 'available' && form.eventDate
                  ? `${vendor.businessName} is free on this date`
                  : undefined
              }
            >
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  min={today}
                  value={form.eventDate}
                  onChange={(event) => set('eventDate', event.target.value)}
                />
              )}
            </Field>

            <Field
              id={`${fieldId}-eventType`}
              label={FIELD_LABELS.eventType}
              issue={validation.issueFor(`${fieldId}-eventType`)}
            >
              {(props) => (
                <select
                  {...props}
                  value={form.eventType}
                  onChange={(event) => set('eventType', event.target.value as EventType)}
                  /* `props.className` carries the tier styling, so it goes last. */
                  className={cn('appearance-none', props.className)}
                >
                  <option value="">Choose an occasion</option>
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {EVENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field
              id={`${fieldId}-eventStartTime`}
              label={FIELD_LABELS.eventStartTime}
              issue={validation.issueFor(`${fieldId}-eventStartTime`)}
            >
              {(props) => (
                <Input
                  {...props}
                  type="time"
                  value={form.eventStartTime}
                  onChange={(event) => set('eventStartTime', event.target.value)}
                />
              )}
            </Field>

            <Field
              id={`${fieldId}-guestCount`}
              label={FIELD_LABELS.guestCount}
              issue={validation.issueFor(`${fieldId}-guestCount`)}
            >
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={servicePackage?.maxGuests ?? MAX_GUEST_COUNT}
                  placeholder="120"
                  value={form.guestCount}
                  onChange={(event) => set('guestCount', event.target.value)}
                />
              )}
            </Field>

            <Field
              id={`${fieldId}-eventLocation`}
              label={FIELD_LABELS.eventLocation}
              issue={validation.issueFor(`${fieldId}-eventLocation`)}
              className="sm:col-span-2"
            >
              {(props) => (
                <Input
                  {...props}
                  placeholder="Barr Mansion, 10463 Sprinkle Rd, Austin, TX"
                  value={form.eventLocation}
                  onChange={(event) => set('eventLocation', event.target.value)}
                />
              )}
            </Field>

            <Field
              id={`${fieldId}-notes`}
              label={FIELD_LABELS.notes}
              issue={validation.issueFor(`${fieldId}-notes`)}
              className="sm:col-span-2"
              footer={
                <div className="mt-1.25 flex justify-between text-xs text-stone-600">
                  <span>Optional, but it speeds up the quote</span>
                  <span>
                    {form.notes.length} / {BOOKING_REQUEST_NOTES_MAX_LENGTH}
                  </span>
                </div>
              }
            >
              {(props) => (
                <Textarea
                  {...props}
                  placeholder="Outdoor ceremony at 4, reception inside. We'd love golden-hour portraits and we have an elderly grandparent who can't stand for long."
                  value={form.notes}
                  onChange={(event) => set('notes', event.target.value)}
                  className={cn('min-h-24 leading-[1.6]', props.className)}
                />
              )}
            </Field>
          </div>
        ) : (
          <ReviewSummary
            form={form}
            customDetails={customDetails}
            hasPackage={servicePackage !== null}
            onEdit={() => {
              validation.reset();
              setStep(1);
            }}
          />
        )}
      </div>

      <div className="lg:sticky lg:top-[calc(var(--header-height)+16px)] lg:self-start">
        <RequestSummaryRail
          vendor={vendor}
          servicePackage={servicePackage}
          customDetails={customDetails}
          onCustomDetailsChange={setCustomDetails}
          customDetailsId={`${fieldId}-customDetails`}
          customDetailsInvalid={
            validation.issueFor(`${fieldId}-customDetails`)?.severity === 'blocker'
          }
          primaryLabel={primaryLabel}
          submitting={submitting}
          blockerCount={validation.attempted ? validation.blockers.length : 0}
          askHref={`/vendors/${vendorSlug}`}
          onPrimary={() =>
            validation.attemptSubmit(() => {
              if (step === 1) {
                setStep(2);
                validation.reset();
                return;
              }

              void send();
            })
          }
        />
      </div>
    </div>
  );
}

/** `.inp` from the frame: `stone-150` fill, `stone-300` hairline, 10px radius. */
const FIELD_CONTROL =
  'h-auto w-full rounded-[10px] border border-stone-300 bg-stone-150 px-3.25 py-2.5 text-base text-stone-900 focus-visible:border-clay-400 focus-visible:ring-3 focus-visible:ring-clay-400/15';

interface FieldProps {
  id: string;
  label: string;
  issue: FieldIssue | null;
  /** The `sage-600` reassurance under the date — the question actually being asked. */
  hint?: string;
  className?: string;
  footer?: React.ReactNode;
  children: (props: {
    id: string;
    className: string;
    'aria-invalid'?: true;
    'aria-describedby'?: string;
  }) => React.ReactElement;
}

/**
 * One labelled control and whatever the three tiers have to say about it: red
 * ring and red message for a blocker, gold border and gold message for a cost,
 * and the sage line when there is simply good news.
 */
function Field({
  id,
  label,
  issue,
  hint,
  className,
  footer,
  children,
}: FieldProps): React.ReactElement {
  const messageId = `${id}-message`;
  const blocked = issue?.severity === 'blocker';
  const costly = issue?.severity === 'costly';

  return (
    <div className={className}>
      <Label
        htmlFor={id}
        className="mb-1.5 text-xs font-semibold tracking-[.05em] text-stone-600 uppercase"
      >
        {label}
      </Label>
      {children({
        id,
        className: cn(
          FIELD_CONTROL,
          blocked && 'border-[1.5px] border-error-500 ring-3 ring-error-500/[.18]',
          costly && 'border-[1.5px] border-gold-400 bg-stone-0',
        ),
        ...(blocked ? { 'aria-invalid': true as const } : {}),
        ...(issue ? { 'aria-describedby': messageId } : {}),
      })}
      {issue ? (
        <p
          id={messageId}
          className={cn(
            'mt-1.5 text-xs leading-[1.5]',
            blocked ? 'text-error-500' : 'text-gold-600',
          )}
        >
          {issue.message}
        </p>
      ) : hint ? (
        <p className="mt-1.25 text-xs text-sage-600">{hint}</p>
      ) : null}
      {footer}
    </div>
  );
}

/**
 * "June 14, 2026", the way the frame writes a date. Built from the parts rather
 * than from `new Date(value)`, which reads a bare `YYYY-MM-DD` as UTC midnight
 * and shows the day before in any western timezone.
 */
function formatEventDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return 'Not set';
  }

  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "2:00 PM" from the `HH:MM` the input holds. */
function formatClockTime(value: string): string {
  const [hours, minutes] = value.split(':').map(Number);

  if (!value || Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 'Not set';
  }

  const suffix = hours < 12 ? 'AM' : 'PM';
  const hour = hours % 12 === 0 ? 12 : hours % 12;

  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

interface ReviewSummaryProps {
  form: FormState;
  customDetails: string;
  hasPackage: boolean;
  onEdit: () => void;
}

/** Step 2: the same shell, the form column read-only, one way back to editing. */
function ReviewSummary({
  form,
  customDetails,
  hasPackage,
  onEdit,
}: ReviewSummaryProps): React.ReactElement {
  const rows: { label: string; value: string }[] = [
    { label: FIELD_LABELS.eventDate, value: formatEventDate(form.eventDate) },
    {
      label: FIELD_LABELS.eventType,
      value: form.eventType ? EVENT_TYPE_LABELS[form.eventType] : '—',
    },
    { label: FIELD_LABELS.eventStartTime, value: formatClockTime(form.eventStartTime) },
    { label: FIELD_LABELS.guestCount, value: form.guestCount || 'Not set' },
    { label: FIELD_LABELS.eventLocation, value: form.eventLocation || 'Not set' },
    {
      label: hasPackage ? FIELD_LABELS.notes : FIELD_LABELS.customDetails,
      value: (hasPackage ? form.notes : customDetails) || 'Nothing added',
    },
  ];

  return (
    <div className="max-w-[660px] overflow-hidden rounded-[14px] border border-stone-300 bg-stone-0">
      <div className="flex items-center justify-between border-b border-stone-200 px-4.5 py-3">
        {/* `font-sans` is deliberate: h2 inherits the display face, and
            `01-foundations.md` never sets Serif below 16px. */}
        <h2 className="font-sans text-base font-semibold text-stone-900">Event details</h2>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
      </div>
      <dl className="divide-y divide-stone-200">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-4 px-4.5 py-3">
            <dt className="w-40 shrink-0 text-sm text-stone-600">{row.label}</dt>
            <dd className="text-base whitespace-pre-wrap text-stone-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

interface SuccessPanelProps {
  businessName: string;
  vendorSlug: string;
  responseTimeHours: number | null;
}

/**
 * Step 3. It names what happens next and hands the customer somewhere to go —
 * `13-booking-request.md` rules out a dead-end confirmation page.
 *
 * The reply window is the vendor's own declared figure, never a platform
 * median: the tracker's no-invented-numbers rule allows a vendor's own facts
 * and nothing else.
 */
function SuccessPanel({
  businessName,
  vendorSlug,
  responseTimeHours,
}: SuccessPanelProps): React.ReactElement {
  return (
    <div className="mx-auto w-full max-w-[660px] px-6 py-14 xl:px-10">
      <RequestStepper current={3} />

      <div className="overflow-hidden rounded-[18px] bg-stone-0 shadow-[0_2px_10px_rgba(35,32,28,.06)]">
        <div className="flex gap-2.5 bg-sage-50 px-6 py-4">
          <span aria-hidden="true" className="mt-1.75 size-2 shrink-0 rounded-full bg-sage-400" />
          <p className="text-sm leading-[1.55] text-sage-600">
            Sent. No card has been charged, and none will be until you approve a price.
          </p>
        </div>

        <div className="px-6 py-6">
          <h1 className="mb-2 font-display text-[26px] tracking-[-.01em] text-stone-900">
            Your request is with {businessName}
          </h1>
          <p className="mb-5 text-md leading-[1.6] text-stone-700">
            {responseTimeHours
              ? `${businessName} usually replies within ${responseTimeHours} ${responseTimeHours === 1 ? 'hour' : 'hours'}.`
              : `${businessName} has 48 hours to confirm the date or send a revised quote.`}{' '}
            You will get a notification either way, and the request closes on its own after a week
            if it goes unanswered.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="primary">
              <Link href="/bookings">See your requests</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/vendors/${vendorSlug}`}>Back to {businessName}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
