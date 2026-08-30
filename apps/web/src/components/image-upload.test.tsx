import type { UploadedImage } from '@vendor-marketplace/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The upload transport and the toast are the two things this component does
 * not own. Both are stubbed so the test is about what reaches the `<img>` and
 * when the success is announced — which is the whole of #171.
 */
const uploadOne = vi.fn<(file: File, prefix: string) => Promise<UploadedImage>>();
const toastSuccess = vi.fn();

class TestTransportError extends Error {}

vi.mock('@/lib/use-api', () => ({
  useImageUpload: () => uploadOne,
  UploadTransportError: TestTransportError,
}));

vi.mock('sonner', () => ({ toast: { success: toastSuccess } }));

/*
 * Two different bases, on purpose.
 *
 * The API builds the URL it returns from `S3_PUBLIC_URL`; the browser builds
 * one from `NEXT_PUBLIC_S3_PUBLIC_URL`. Nothing makes them agree, and
 * `assertWebEnv` does not validate the public one — so a build can ship where
 * they differ or where it is missing entirely. Giving them different values
 * here is what makes "the preview keeps the URL the upload returned" a real
 * assertion rather than a coincidence of both spellings matching.
 */
const WEB_BASE = 'http://cdn.test';
const API_BASE = 'http://localhost:9000/vendor-marketplace-uploads';
vi.stubEnv('NEXT_PUBLIC_S3_PUBLIC_URL', WEB_BASE);

// Imported after the mocks and the stub so the module graph picks them up,
// matching `use-upload-queue.test.tsx`.
const { ImageUpload } = await import('./image-upload');

const KEY = 'vendor-profile/4e4f2d0a-6f1f-4b1a-9a3f-2f0a2b7c9d11.webp';
/** What the API returns — and what must stay on screen after success. */
const IMAGE_URL = `${API_BASE}/${KEY}`;

const STORED: UploadedImage = {
  imageKey: KEY,
  imageUrl: IMAGE_URL,
  thumbnailKey: KEY.replace('.webp', '-thumb.webp'),
  thumbnailUrl: IMAGE_URL.replace('.webp', '-thumb.webp'),
};

/** A file that passes `screenFile` — an accepted type, under the size limit. */
function acceptableFile(): File {
  return new File([new Uint8Array([1, 2, 3])], 'studio.jpg', { type: 'image/jpeg' });
}

function preview(): HTMLImageElement | null {
  return document.querySelector('img');
}

/** The preview, once it exists — every load/error test needs it non-null. */
async function shownPreview(): Promise<HTMLImageElement> {
  await waitFor(() => expect(preview()).not.toBeNull());
  return preview() as HTMLImageElement;
}

/**
 * A parent that behaves the way the real ones do.
 *
 * `vendor-profile-form` and `customer-profile-form` both keep **one** piece of
 * state and feed it back as `value`, taking `onChange`'s object key. That is
 * what produced #171: the key became the `src` and the browser resolved it
 * against the page path. A `vi.fn()` parent would never feed anything back, so
 * it cannot reproduce the defect and cannot prove it fixed.
 */
function Controlled({
  onChange,
  rounded,
  initialValue = null,
}: {
  onChange?: (imageKey: string) => void;
  rounded?: boolean;
  initialValue?: string | null;
}): React.ReactElement {
  const [value, setValue] = useState<string | null>(initialValue);

  return (
    <ImageUpload
      label="Profile photo"
      prefix="vendor-profile"
      value={value}
      rounded={rounded}
      onChange={(imageKey) => {
        setValue(imageKey);
        onChange?.(imageKey);
      }}
    />
  );
}

async function uploadOnto(): Promise<HTMLImageElement> {
  await userEvent.upload(screen.getByLabelText('Profile photo'), acceptableFile());
  return shownPreview();
}

beforeEach(() => {
  uploadOne.mockReset();
  toastSuccess.mockReset();
  uploadOne.mockResolvedValue(STORED);
});

describe('ImageUpload', () => {
  it('previews the resolved URL the upload returned, never the storage key', async () => {
    render(<Controlled />);

    fireEvent.load(await uploadOnto());

    /*
     * The regression: the parent stores the key, fed it straight back as
     * `value`, and the browser resolved it against the current page —
     * `/vendor/profile/vendor-profile/<uuid>.webp`, `naturalWidth` 0, 500.
     */
    await waitFor(() => expect(preview()?.getAttribute('src')).toBe(IMAGE_URL));
    expect(preview()?.getAttribute('src')).not.toBe(KEY);
  });

  it('keeps the API’s own URL after success rather than re-deriving one', async () => {
    render(<Controlled />);

    fireEvent.load(await uploadOnto());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());

    /*
     * The two bases differ here, so re-deriving would swap the `src` to
     * `${WEB_BASE}/${KEY}` in the same commit as the toast — and would blank
     * the zone outright wherever the public base is unset. Neither may happen.
     */
    expect(preview()?.getAttribute('src')).toBe(IMAGE_URL);
    expect(preview()?.getAttribute('src')).not.toBe(`${WEB_BASE}/${KEY}`);
  });

  it('holds the success toast until the image has actually loaded', async () => {
    render(<Controlled />);

    const img = await uploadOnto();

    // The upload has resolved 201 — and that alone is not success.
    expect(toastSuccess).not.toHaveBeenCalled();

    fireEvent.load(img);

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Profile photo updated.'));
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });

  it('commits the storage key to the form only once the preview has loaded', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);

    const img = await uploadOnto();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.load(img);

    // The key is what gets persisted; the API's URL is what stays on screen.
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(KEY));
    expect(preview()?.getAttribute('src')).toBe(IMAGE_URL);
  });

  it('keeps a determinate percentage on screen while the preview is verified', async () => {
    render(<Controlled />);

    await uploadOnto();

    /*
     * `40-states.md` allows no indeterminate wait. The request has finished,
     * so the honest figure is 100 while the browser draws it — never a
     * disabled zone with nothing on it.
     */
    expect(screen.getByRole('status').textContent).toContain('100%');
  });

  it('surfaces a preview that fails to load instead of reporting success', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);

    fireEvent.error(await uploadOnto());

    expect(
      await screen.findByText('That photo saved, but the preview would not load.'),
    ).toBeDefined();
    // Re-sending stores a second object that would not render either.
    expect(screen.getByText('Reload the page to see it.')).toBeDefined();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the Add photo invitation when the preview failed, rather than a blank circle', async () => {
    render(<Controlled rounded />);

    fireEvent.error(await uploadOnto());

    await waitFor(() => expect(preview()).toBeNull());
    expect(screen.getByText('Add photo')).toBeDefined();
  });

  it('puts the previous photo back when a replacement will not render', async () => {
    const existing = `${WEB_BASE}/vendor-profile/old.webp`;
    render(<Controlled initialValue={existing} />);

    await waitFor(() => expect(preview()?.getAttribute('src')).toBe(existing));
    fireEvent.error(await uploadOnto());

    await waitFor(() => expect(preview()?.getAttribute('src')).toBe(existing));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('renders an already-stored value untouched and announces nothing', () => {
    const onChange = vi.fn();
    const existing = `${WEB_BASE}/vendor-profile/old.webp`;
    render(<Controlled initialValue={existing} onChange={onChange} />);

    expect(preview()?.getAttribute('src')).toBe(existing);
    // The first paint of an existing photo is not an upload, so it announces
    // nothing and commits nothing.
    fireEvent.load(preview() as HTMLImageElement);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('resolves a stored key the form already holds, so a reload still shows the photo', () => {
    render(<Controlled initialValue={KEY} />);

    // No upload in flight, so the key has to resolve through the app's one
    // resolution site rather than reaching `src` raw.
    expect(preview()?.getAttribute('src')).toBe(`${WEB_BASE}/${KEY}`);
  });
});
