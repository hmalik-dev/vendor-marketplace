import { ERROR_CODES, MAX_UPLOAD_BATCH_FILES, MAX_UPLOAD_BYTES } from '@vendor-marketplace/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  aggregateLine,
  connectionFailure,
  failureSentence,
  formatFileSize,
  heldBackSentence,
  rejectedFailure,
  retryableTasks,
  screenDimensions,
  screenFile,
  splitBatch,
  summarise,
  previewFailure,
  tooLargeFailure,
  tooNarrowFailure,
  unsupportedFormatFailure,
  type UploadTask,
} from './uploads';

function task(overrides: Partial<UploadTask> & Pick<UploadTask, 'id'>): UploadTask {
  return {
    name: `${overrides.id}.jpg`,
    sizeBytes: 1024 * 1024,
    status: 'queued',
    progress: 0,
    ...overrides,
  };
}

describe('screenFile', () => {
  it('passes a JPEG inside the size limit', () => {
    expect(screenFile({ name: 'a.jpg', type: 'image/jpeg', size: 1024 })).toBeNull();
  });

  it('names the extension when the format is one we cannot publish', () => {
    const failure = screenFile({ name: 'shot.heic', type: 'image/heic', size: 1024 });

    expect(failure).toMatchObject({
      kind: 'unsupported-format',
      tone: 'red',
      reason: "HEIC isn't a format we can publish.",
      retryable: false,
    });
    expect(failure?.fix).toContain('JPG or PNG');
  });

  /*
   * WebP was accepted until #29. The picker offering it while the server
   * refused it was the worst of both — a file a vendor could pick and then be
   * told off for.
   */
  it('no longer accepts WebP', () => {
    expect(screenFile({ name: 'a.webp', type: 'image/webp', size: 1024 })).toMatchObject({
      kind: 'unsupported-format',
    });
  });

  /*
   * The whole sentence, at the boundary, on both sides of it.
   *
   * This previously asserted `'12 MB is over the 12 MB limit.'` — the
   * contradiction itself, pinned as expected behaviour. The check is
   * `size > MAX_UPLOAD_BYTES`, so a refused file is always strictly larger;
   * one-decimal rounding was what made the sentence deny its own premise, and
   * a test asserting that string could never have caught it.
   */
  it.each([
    // A single byte over rounds to the limit at every sane precision, so the
    // exact count is stated rather than a rounder number that would read false.
    [MAX_UPLOAD_BYTES + 1, '12,000,001 bytes is over the 12 MB limit.'],
    [MAX_UPLOAD_BYTES + 4_000, '12.004 MB is over the 12 MB limit.'],
    [MAX_UPLOAD_BYTES + 1_000_000, '13 MB is over the 12 MB limit.'],
  ])('never states a refused size equal to the limit (%i bytes)', (size, reason) => {
    const failure = screenFile({ name: 'huge.jpg', type: 'image/jpeg', size });

    expect(failure).toMatchObject({ kind: 'too-large', tone: 'red', retryable: false });
    expect(failure?.reason).toBe(reason);
    expect(failure?.reason).not.toBe('12 MB is over the 12 MB limit.');
    expect(failure?.fix).toBe('Export it as a JPG at 2400px wide.');
  });

  it('accepts a file sitting exactly on the limit', () => {
    expect(screenFile({ name: 'a.jpg', type: 'image/jpeg', size: MAX_UPLOAD_BYTES })).toBeNull();
  });
});

describe('failure tones', () => {
  /*
   * `40-states.md`: red is "it failed", gold is "waiting on someone". A
   * too-narrow image is valid and merely not good enough to publish, so it is
   * a decision for the vendor rather than an error — gold, and worded as
   * "would look soft" rather than "invalid".
   */
  it('uses gold and soft-focus wording for an image below the width floor', () => {
    expect(tooNarrowFailure(900)).toMatchObject({
      tone: 'gold',
      reason: '900px wide would look soft on your profile.',
      fix: 'Export it at least 1200px wide.',
      retryable: false,
    });
  });

  it('uses red for a size refusal and for a dropped connection', () => {
    expect(tooLargeFailure(MAX_UPLOAD_BYTES + 1).tone).toBe('red');
    expect(unsupportedFormatFailure('a.gif').tone).toBe('red');
    expect(connectionFailure().tone).toBe('red');
  });

  it('offers a retry only where the same bytes are worth re-sending', () => {
    expect(connectionFailure().retryable).toBe(true);
    expect(connectionFailure().fix).toBe('The file is fine — send it again.');
    expect(tooLargeFailure(1).retryable).toBe(false);
    expect(tooNarrowFailure(900).retryable).toBe(false);
  });
});

describe('screenDimensions', () => {
  /*
   * jsdom has no `createImageBitmap`, which is exactly the absent-decoder path
   * the helper is written to survive: it declines to judge and leaves the
   * width floor to the server, rather than passing or failing on a guess.
   */
  it('declines to judge where the browser cannot decode an image', async () => {
    expect(typeof createImageBitmap).not.toBe('function');
    await expect(screenDimensions(new Blob([new Uint8Array(4)]))).resolves.toBeNull();
  });

  it('flags a narrow image in gold when a decoder is available', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 900, close: () => undefined }));

    await expect(screenDimensions(new Blob([new Uint8Array(4)]))).resolves.toMatchObject({
      kind: 'too-narrow',
      tone: 'gold',
    });

    vi.unstubAllGlobals();
  });

  it('passes an image at or above the floor', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 1200, close: () => undefined }));

    await expect(screenDimensions(new Blob([new Uint8Array(4)]))).resolves.toBeNull();

    vi.unstubAllGlobals();
  });
});

describe('splitBatch', () => {
  it('lets a selection at the limit through whole', () => {
    const files = Array.from({ length: MAX_UPLOAD_BATCH_FILES }, (_, index) => index);

    expect(splitBatch(files).accepted).toHaveLength(MAX_UPLOAD_BATCH_FILES);
    expect(splitBatch(files).heldBack).toEqual([]);
  });

  it('trims the overflow instead of refusing the whole selection', () => {
    const files = Array.from({ length: MAX_UPLOAD_BATCH_FILES + 3 }, (_, index) => index);
    const { accepted, heldBack } = splitBatch(files);

    expect(accepted).toHaveLength(MAX_UPLOAD_BATCH_FILES);
    expect(heldBack).toEqual([20, 21, 22]);
  });

  it('names the held-back files so nothing vanishes silently', () => {
    expect(heldBackSentence(['x.jpg', 'y.jpg'])).toBe(
      '20 files upload at a time, so 2 files were held back: x.jpg, y.jpg. Add them next.',
    );
  });

  /*
   * The noun agreed for one file and the verb did not, so picking 21 read
   * "1 file were held back". Only the plural case had a test, which is exactly
   * why the singular one was wrong.
   */
  it('agrees in the singular, verb and pronoun included', () => {
    expect(heldBackSentence(['b21.jpg'])).toBe(
      '20 files upload at a time, so 1 file was held back: b21.jpg. Add it next.',
    );
  });
});

/*
 * Every failure sentence begins with a capital. The extensionless branch did
 * not — a JPG renamed `noextension` produced "file isn't a format we can
 * publish." — and it escaped review because the first word is interpolated,
 * so no literal in the source began lowercase.
 */
describe('failure sentences', () => {
  it.each([
    ['noextension', 'File'],
    ['photo.heic', 'HEIC'],
    ['scan.tiff', 'TIFF'],
  ])('starts %s with a capital', (fileName, expectedStart) => {
    const { reason } = unsupportedFormatFailure(fileName);

    expect(reason.startsWith(expectedStart)).toBe(true);
    expect(reason[0]).toBe(reason[0]?.toUpperCase());
  });

  it('starts every other failure sentence with a capital too', () => {
    const sentences = [
      tooLargeFailure(MAX_UPLOAD_BYTES + 4_000).reason,
      tooNarrowFailure(680).reason,
      connectionFailure().reason,
      previewFailure().reason,
    ];

    for (const sentence of sentences) {
      expect(sentence[0]).toBe(sentence[0]?.toUpperCase());
    }
  });
});

describe('batch reporting', () => {
  /*
   * Decimal megabytes, matching the file manager. This divided by 1024 twice
   * while labelling the result MB, so a 70,062,643-byte file read as 66.8 MB
   * where Finder said 70.1 MB — internally consistent and 4.8% wrong against
   * the only number the vendor can check.
   */
  it('reports megabytes in the same units the file manager does', () => {
    expect(formatFileSize(18_200_000)).toBe('18.2 MB');
    expect(formatFileSize(70_062_643)).toBe('70.1 MB');
  });

  /* A fraction of a megabyte is a rounding artefact, not a size. */
  it('reports a small file in kB rather than as 0.2 MB', () => {
    expect(formatFileSize(204_800)).toBe('205 kB');
  });

  it('writes the aggregate line the frame specifies', () => {
    const tasks: UploadTask[] = [
      task({ id: '1', status: 'done', progress: 100, sizeBytes: 4 * 1024 * 1024 }),
      task({ id: '2', status: 'done', progress: 100, sizeBytes: 4 * 1024 * 1024 }),
      task({ id: '3', status: 'done', progress: 100, sizeBytes: 4 * 1024 * 1024 }),
      task({ id: '4', status: 'uploading', progress: 50, sizeBytes: 4 * 1024 * 1024 }),
      ...Array.from({ length: 4 }, (_, index) =>
        task({ id: `${index + 5}`, sizeBytes: 4 * 1024 * 1024 }),
      ),
    ];

    expect(aggregateLine(tasks)).toBe('Uploading 4 of 8 — 14.7 MB of 33.6 MB');
  });

  it('has no aggregate line once every file has settled', () => {
    expect(
      aggregateLine([
        task({ id: '1', status: 'done', progress: 100 }),
        task({ id: '2', status: 'failed', failure: connectionFailure() }),
      ]),
    ).toBeNull();
  });

  it('has no aggregate line when nothing was picked', () => {
    expect(aggregateLine([])).toBeNull();
  });
});

/*
 * The ticket's headline requirement: eight files, two failures, six saved.
 * Partial success is the normal case — a failure never rolls back a sibling.
 */
describe('an eight-file batch with two failures', () => {
  const tasks: UploadTask[] = [
    ...Array.from({ length: 6 }, (_, index) =>
      task({ id: `ok-${index}`, status: 'done', progress: 100 }),
    ),
    task({ id: 'dropped', status: 'failed', failure: connectionFailure() }),
    task({ id: 'narrow', status: 'failed', failure: tooNarrowFailure(900) }),
  ];

  it('keeps the six successes and counts the two failures', () => {
    expect(summarise(tasks)).toMatchObject({ settled: 8, total: 8, failed: 2 });
    expect(tasks.filter((row) => row.status === 'done')).toHaveLength(6);
  });

  it('says everything else saved rather than a bare upload-failed', () => {
    expect(failureSentence(tasks)).toBe("2 photos didn't upload. Everything else saved.");
  });

  it('offers a retry only for the file whose bytes are still good', () => {
    expect(retryableTasks(tasks).map((row) => row.id)).toEqual(['dropped']);
  });

  it('says nothing at all when every file landed', () => {
    expect(failureSentence(tasks.slice(0, 6))).toBeNull();
    expect(retryableTasks(tasks.slice(0, 6))).toEqual([]);
  });

  /*
   * The mid-batch checkpoint the ticket describes: ten files, two failed
   * client-side, one uploading and seven still queued at ~800ms. The banner
   * claimed "Everything else saved" when nothing had been persisted at all —
   * it was describing the end of a batch that had barely started.
   */
  it('does not claim completion while files are still queued or uploading', () => {
    const midBatch: UploadTask[] = [
      task({ id: 'f1', status: 'failed', failure: tooNarrowFailure(680) }),
      task({ id: 'f2', status: 'failed', failure: tooNarrowFailure(700) }),
      task({ id: 'up', status: 'uploading', progress: 40 }),
      ...Array.from({ length: 7 }, (_, index) => task({ id: `q${index}`, status: 'queued' })),
    ];

    const sentence = failureSentence(midBatch);

    expect(sentence).toBe("2 photos didn't upload. 8 still going.");
    expect(sentence).not.toContain('Everything else saved');
  });

  /* Once the batch settles, the original sentence is the right one again. */
  it('claims the remainder saved only after everything has settled', () => {
    expect(failureSentence(tasks)).toBe("2 photos didn't upload. Everything else saved.");
  });

  /*
   * Nothing else to claim when the whole batch failed. "Everything else saved"
   * of an empty remainder is the same false note in a quieter voice.
   */
  it('claims nothing about a remainder that does not exist', () => {
    const allFailed: UploadTask[] = [
      task({ id: 'a', status: 'failed', failure: connectionFailure() }),
      task({ id: 'b', status: 'failed', failure: connectionFailure() }),
    ];

    expect(failureSentence(allFailed)).toBe("2 photos didn't upload.");
  });
});

/*
 * #170. The customer profile uploader rendered the API's own authorization
 * sentence at the reader — "This endpoint requires the vendor role" — under
 * export advice that had nothing to do with the refusal.
 */
describe('a refusal the server explained to a developer', () => {
  const INTERNAL_MESSAGE = 'This endpoint requires the vendor role';

  it('never renders the internal authorization sentence', () => {
    const failure = rejectedFailure(INTERNAL_MESSAGE, ERROR_CODES.FORBIDDEN);

    expect(`${failure.reason} ${failure.fix}`).not.toContain('requires the vendor role');
  });

  it('names the account rather than the role the server wanted', () => {
    expect(rejectedFailure(INTERNAL_MESSAGE, ERROR_CODES.FORBIDDEN)).toEqual({
      kind: 'not-allowed',
      tone: 'red',
      reason: "This account can't add a photo here.",
      fix: 'Switch to the account this page belongs to.',
      retryable: false,
    });
  });

  it('tells a signed-out reader to sign in, which is a different fix', () => {
    expect(rejectedFailure('Authentication required', ERROR_CODES.UNAUTHORIZED)).toEqual({
      kind: 'not-allowed',
      tone: 'red',
      reason: "You've been signed out.",
      fix: 'Sign in again, then add the photo.',
      retryable: false,
    });
  });

  it('withholds the message when no code identifies it as user-facing', () => {
    // Retryable: nothing said the bytes were wrong, unlike a stated rule.
    expect(rejectedFailure(INTERNAL_MESSAGE)).toMatchObject({
      reason: "We couldn't save that photo.",
      fix: 'Try again in a moment.',
      retryable: true,
    });
  });

  it('withholds an internal-error message too, not just an authorization one', () => {
    const failure = rejectedFailure('ECONNREFUSED 10.0.0.4:5432', ERROR_CODES.INTERNAL_ERROR);

    expect(failure.reason).toBe("We couldn't save that photo.");
  });

  /*
   * `31-content-voice.md`: "No jargon: no API, webhook, session, null, entity,
   * record." Copy is reviewed by eye exactly once and then lives forever, so
   * the ban is asserted rather than remembered.
   */
  it('keeps the banned jargon out of every refusal it writes', () => {
    const codes = [
      ERROR_CODES.UNAUTHORIZED,
      ERROR_CODES.FORBIDDEN,
      ERROR_CODES.INTERNAL_ERROR,
      undefined,
    ] as const;

    for (const code of codes) {
      const failure = rejectedFailure('Something internal.', code);
      const copy = `${failure.reason} ${failure.fix}`.toLowerCase();

      for (const word of ['session', 'api', 'webhook', 'null', 'entity', 'record', 'endpoint']) {
        expect(copy, `code ${code ?? 'none'}`).not.toContain(word);
      }
    }
  });

  it('still renders a validation message, which the API writes for a person', () => {
    const failure = rejectedFailure('Image is 900px wide.', ERROR_CODES.VALIDATION_ERROR);

    expect(failure).toMatchObject({
      kind: 'rejected',
      reason: 'Image is 900px wide.',
      retryable: false,
    });
    expect(failure.fix).toContain('at least');
  });
});
