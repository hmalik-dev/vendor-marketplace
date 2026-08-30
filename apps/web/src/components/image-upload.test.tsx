import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ERROR_CODES, type ErrorCode } from '@vendor-marketplace/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api-client';

const uploadOne = vi.fn();

class TestTransportError extends Error {}

vi.mock('@/lib/use-api', () => ({
  useImageUpload: () => uploadOne,
  UploadTransportError: TestTransportError,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { ImageUpload } = await import('./image-upload');

/**
 * #170. The uploader rendered the API's own authorization sentence at the
 * reader. `uploads.test.ts` asserts the classifier's return value; this asserts
 * the **rendered** output, which is what the ticket requires — a leak reaches a
 * person through the DOM, not through a return value.
 */
describe('ImageUpload, when the server refuses the upload', () => {
  beforeEach(() => {
    uploadOne.mockReset();
  });

  /** Renders the uploader, fails the upload with `code`, returns the shown line. */
  async function failureLineFor(code: ErrorCode, message: string): Promise<string> {
    uploadOne.mockRejectedValue(new ApiClientError(403, code, message));

    render(
      <ImageUpload
        label="Profile photo"
        prefix="customer-profile"
        value={null}
        onChange={vi.fn()}
      />,
    );

    // Clears the client-side screen, so the refusal comes from the server.
    const file = new File([new Uint8Array(2048)], 'photo.jpg', { type: 'image/jpeg' });
    await userEvent.upload(screen.getByLabelText('Profile photo'), file);

    const status = await screen.findByRole('status');
    return status.textContent ?? '';
  }

  it('never renders the internal authorization sentence', async () => {
    const line = await failureLineFor(
      ERROR_CODES.FORBIDDEN,
      'This endpoint requires the vendor role',
    );

    expect(line).not.toContain('requires the vendor role');
    expect(line).not.toContain('endpoint');
    expect(document.body.textContent).not.toContain('requires the vendor role');
  });

  it('renders a reason and a matching fix in its place', async () => {
    const line = await failureLineFor(
      ERROR_CODES.FORBIDDEN,
      'This endpoint requires the vendor role',
    );

    expect(line).toContain("This account can't add a photo here.");
    expect(line).toContain('Switch to the account this page belongs to.');
  });

  it('still renders a validation message, which the API writes for a person', async () => {
    const line = await failureLineFor(ERROR_CODES.VALIDATION_ERROR, 'Image is 900px wide.');

    expect(line).toContain('Image is 900px wide.');
  });

  it('withholds an internal-error message rather than repeating it', async () => {
    const line = await failureLineFor(ERROR_CODES.INTERNAL_ERROR, 'ECONNREFUSED 10.0.0.4:5432');

    expect(line).toContain("We couldn't save that photo.");
    expect(document.body.textContent).not.toContain('10.0.0.4');
  });
});
