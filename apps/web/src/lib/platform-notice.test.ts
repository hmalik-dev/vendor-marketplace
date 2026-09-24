import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiRequest = vi.fn();
vi.mock('./api-client', () => ({ apiRequest }));

const { getPlatformNotice } = await import('./platform-notice');

beforeEach(() => {
  apiRequest.mockReset();
});

describe('getPlatformNotice', () => {
  it('returns the posted notice, read uncached from /platform/notice', async () => {
    apiRequest.mockResolvedValue({ message: 'Payouts are delayed.', tone: 'warning' });

    await expect(getPlatformNotice()).resolves.toEqual({
      message: 'Payouts are delayed.',
      tone: 'warning',
    });
    expect(apiRequest).toHaveBeenCalledWith('/platform/notice', {
      schema: expect.anything(),
    });
  });

  it('returns null when no notice is posted', async () => {
    apiRequest.mockResolvedValue(null);

    await expect(getPlatformNotice()).resolves.toBeNull();
  });

  it('returns null rather than throwing when the API fails or answers off-schema', async () => {
    apiRequest.mockRejectedValue(new Error('API request for /platform/notice timed out'));

    await expect(getPlatformNotice()).resolves.toBeNull();
  });
});
