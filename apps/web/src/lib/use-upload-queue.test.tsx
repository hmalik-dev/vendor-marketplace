import { act, renderHook, waitFor } from '@testing-library/react';
import { ERROR_CODES, MAX_UPLOAD_BATCH_FILES } from '@vendor-marketplace/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from './api-client';

const uploadOne = vi.fn();

class TestTransportError extends Error {}

vi.mock('./use-api', () => ({
  useImageUpload: () => uploadOne,
  UploadTransportError: TestTransportError,
}));

const { useUploadQueue } = await import('./use-upload-queue');

function jpeg(name: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type: 'image/jpeg' });
}

const stored = { imageUrl: 'https://cdn.test/a.webp', thumbnailUrl: 'https://cdn.test/a-t.webp' };

describe('useUploadQueue', () => {
  beforeEach(() => {
    uploadOne.mockReset();
    uploadOne.mockResolvedValue(stored);
  });

  /*
   * The ticket's headline requirement. Partial success is the normal case: the
   * six that landed are already saved, and the two that did not keep their
   * tiles so the vendor can tell which shots they were.
   */
  it('saves six of eight when two files fail, and keeps the two tiles', async () => {
    const saved: string[] = [];
    const files = Array.from({ length: 8 }, (_unused, index) => jpeg(`shot-${index}.jpg`));

    uploadOne.mockImplementation(async (file: File) => {
      if (file.name === 'shot-3.jpg') {
        throw new TestTransportError();
      }
      if (file.name === 'shot-6.jpg') {
        throw new ApiClientError(400, ERROR_CODES.VALIDATION_ERROR, 'Image is 900px wide.');
      }
      return stored;
    });

    const { result } = renderHook(() =>
      useUploadQueue({
        prefix: 'portfolio',
        onUploaded: async () => {
          saved.push('one');
        },
      }),
    );

    act(() => result.current.addFiles(files));

    await waitFor(() =>
      expect(result.current.tasks.every((task) => task.status !== 'queued')).toBe(true),
    );

    expect(saved).toHaveLength(6);
    expect(result.current.tasks.filter((task) => task.status === 'done')).toHaveLength(6);

    const failed = result.current.tasks.filter((task) => task.status === 'failed');
    expect(failed.map((task) => task.name)).toEqual(['shot-3.jpg', 'shot-6.jpg']);
    expect(failed[0]?.failure?.kind).toBe('connection-dropped');
    expect(failed[1]?.failure?.reason).toBe('Image is 900px wide.');
  });

  it('re-sends only the failure whose bytes are still good', async () => {
    const files = [jpeg('good.jpg'), jpeg('dropped.jpg'), jpeg('huge.jpg')];
    let dropOnce = true;

    uploadOne.mockImplementation(async (file: File) => {
      if (file.name === 'dropped.jpg' && dropOnce) {
        dropOnce = false;
        throw new TestTransportError();
      }
      if (file.name === 'huge.jpg') {
        throw new ApiClientError(413, ERROR_CODES.VALIDATION_ERROR, 'Too big.');
      }
      return stored;
    });

    const { result } = renderHook(() =>
      useUploadQueue({ prefix: 'portfolio', onUploaded: async () => undefined }),
    );

    act(() => result.current.addFiles(files));

    // Wait on every task having settled rather than on a count, so the
    // assertion cannot land in the gap between the two failures.
    await waitFor(() =>
      expect(
        result.current.tasks.every((task) => task.status === 'done' || task.status === 'failed'),
      ).toBe(true),
    );
    expect(result.current.tasks.filter((task) => task.status === 'failed')).toHaveLength(2);

    act(() => result.current.retryAll());

    await waitFor(() =>
      expect(result.current.tasks.find((task) => task.name === 'dropped.jpg')?.status).toBe('done'),
    );
    expect(result.current.tasks.find((task) => task.name === 'huge.jpg')?.status).toBe('failed');
    expect(result.current.tasks.filter((task) => task.status === 'failed')).toHaveLength(1);
  });

  /*
   * The upload never leaves the browser for a file the picker should not have
   * offered — the server would refuse it anyway, and a round trip to be told
   * so is time the vendor does not get back.
   */
  it('fails an unsupported file locally without calling the network', async () => {
    const heic = new File([new Uint8Array(8)], 'shot.heic', { type: 'image/heic' });

    const { result } = renderHook(() =>
      useUploadQueue({ prefix: 'portfolio', onUploaded: async () => undefined }),
    );

    act(() => result.current.addFiles([heic]));

    await waitFor(() => expect(result.current.tasks[0]?.status).toBe('failed'));
    expect(result.current.tasks[0]?.failure?.kind).toBe('unsupported-format');
    expect(uploadOne).not.toHaveBeenCalled();
  });

  it('trims an over-large batch and names what was held back', async () => {
    const files = Array.from({ length: MAX_UPLOAD_BATCH_FILES + 2 }, (_unused, index) =>
      jpeg(`shot-${index}.jpg`),
    );

    const { result } = renderHook(() =>
      useUploadQueue({ prefix: 'portfolio', onUploaded: async () => undefined }),
    );

    act(() => result.current.addFiles(files));

    expect(result.current.tasks).toHaveLength(MAX_UPLOAD_BATCH_FILES);
    expect(result.current.heldBackNotice).toContain('shot-20.jpg, shot-21.jpg');

    await waitFor(() =>
      expect(result.current.tasks.every((task) => task.status === 'done')).toBe(true),
    );
  });

  /*
   * The bytes reaching object storage is not the same as the vendor having the
   * photo. If the row cannot be written, the tile fails rather than claiming a
   * success that would vanish on the next page load.
   */
  it('fails the tile when the upload lands but the row cannot be saved', async () => {
    const { result } = renderHook(() =>
      useUploadQueue({
        prefix: 'portfolio',
        onUploaded: async () => {
          throw new ApiClientError(500, ERROR_CODES.INTERNAL_ERROR, 'Could not save it.');
        },
      }),
    );

    act(() => result.current.addFiles([jpeg('a.jpg')]));

    await waitFor(() => expect(result.current.tasks[0]?.status).toBe('failed'));
    /*
     * #170: an `INTERNAL_ERROR` sentence is written for a developer, so the
     * tile states the refusal in its own words rather than repeating it. The
     * tile still fails, which is what this test is about.
     */
    expect(result.current.tasks[0]?.failure?.reason).toBe("We couldn't save that photo.");
    expect(result.current.tasks[0]?.failure?.fix).toBe('Try again in a moment.');
  });

  it('reports determinate progress as the bytes go out', async () => {
    // The upload is held open after reporting 40%, so the mid-flight value is
    // observable rather than raced against completion.
    let release: (value: typeof stored) => void = () => undefined;

    uploadOne.mockImplementation(
      async (_file: File, _prefix: string, options: { onProgress?: (n: number) => void }) => {
        options.onProgress?.(40);
        return new Promise<typeof stored>((resolve) => {
          release = resolve;
        });
      },
    );

    const { result } = renderHook(() =>
      useUploadQueue({ prefix: 'portfolio', onUploaded: async () => undefined }),
    );

    act(() => result.current.addFiles([jpeg('a.jpg')]));

    await waitFor(() => expect(result.current.tasks[0]?.progress).toBe(40));
    expect(result.current.tasks[0]?.status).toBe('uploading');

    await act(async () => {
      release(stored);
    });

    await waitFor(() => expect(result.current.tasks[0]?.status).toBe('done'));
    expect(result.current.tasks[0]?.progress).toBe(100);
  });
});
