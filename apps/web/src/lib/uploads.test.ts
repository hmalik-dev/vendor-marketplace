import { MAX_UPLOAD_BATCH_FILES, MAX_UPLOAD_BYTES } from '@vendor-marketplace/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  aggregateLine,
  connectionFailure,
  failureSentence,
  formatMegabytes,
  heldBackSentence,
  retryableTasks,
  screenDimensions,
  screenFile,
  splitBatch,
  summarise,
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

  it('states the actual size against the limit when a file is too large', () => {
    const failure = screenFile({
      name: 'huge.jpg',
      type: 'image/jpeg',
      size: MAX_UPLOAD_BYTES + 1,
    });

    expect(failure).toMatchObject({ kind: 'too-large', tone: 'red', retryable: false });
    expect(failure?.reason).toBe('12 MB is over the 12 MB limit.');
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
});

describe('batch reporting', () => {
  it('formats megabytes to one decimal', () => {
    expect(formatMegabytes(18.2 * 1024 * 1024)).toBe('18.2 MB');
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

    expect(aggregateLine(tasks)).toBe('Uploading 4 of 8 — 14 MB of 32 MB');
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
});
