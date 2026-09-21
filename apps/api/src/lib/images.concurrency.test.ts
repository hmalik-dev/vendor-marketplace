import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ active: 0, peak: 0 }));

/*
 * A stand-in for sharp that only counts how many pipelines are in flight. The
 * real library would make the peak depend on libvips scheduling; the contract
 * under test is that `processUploadedImage` never *starts* more than the cap.
 */
vi.mock('sharp', () => {
  const pipeline = {
    metadata: async () => ({ format: 'jpeg', width: 1600, height: 1200 }),
    rotate: () => pipeline,
    resize: () => pipeline,
    webp: () => pipeline,
    toBuffer: async () => {
      state.active += 1;
      state.peak = Math.max(state.peak, state.active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      state.active -= 1;
      return Buffer.from('webp');
    },
  };
  return { default: () => pipeline };
});

const { MAX_CONCURRENT_IMAGE_JOBS, MAX_QUEUED_IMAGE_JOBS, processUploadedImage } =
  await import('./images.js');

describe('image job concurrency', () => {
  afterEach(() => {
    state.active = 0;
    state.peak = 0;
  });

  it('never runs more than the cap of sharp jobs at once across ten uploads', async () => {
    const bytes = Buffer.from('jpeg-bytes');

    const results = await Promise.all(
      Array.from({ length: 10 }, () => processUploadedImage(bytes, 'image/jpeg')),
    );

    expect(results).toHaveLength(10);
    expect(MAX_CONCURRENT_IMAGE_JOBS).toBe(2);
    expect(state.peak).toBe(2);
  });

  it('refuses uploads beyond the queue depth instead of holding their buffers', async () => {
    const bytes = Buffer.from('jpeg-bytes');
    const total = MAX_CONCURRENT_IMAGE_JOBS + MAX_QUEUED_IMAGE_JOBS + 3;

    const settled = await Promise.allSettled(
      Array.from({ length: total }, () => processUploadedImage(bytes, 'image/jpeg')),
    );

    const refused = settled.filter((result) => result.status === 'rejected');
    expect(refused).toHaveLength(3);
    expect(refused[0]).toMatchObject({ reason: { statusCode: 429 } });
    expect(state.peak).toBe(MAX_CONCURRENT_IMAGE_JOBS);
  });
});
