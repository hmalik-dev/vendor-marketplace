import { beforeEach, describe, expect, it, vi } from 'vitest';

const order: string[] = [];
const requireRole = vi.fn(async (role: string) => {
  order.push(`requireRole:${role}`);
});
const revalidateTag = vi.fn((tag: string) => {
  order.push(`revalidateTag:${tag}`);
});

vi.mock('@/lib/current-user', () => ({ requireRole }));
vi.mock('next/cache', () => ({ revalidateTag }));

const { expirePublicCategories } = await import('./actions');

beforeEach(() => {
  order.length = 0;
  requireRole.mockClear();
  revalidateTag.mockClear();
});

describe('expirePublicCategories', () => {
  it('checks the admin role before expiring the taxonomy cache tag', async () => {
    await expirePublicCategories();

    expect(order).toEqual(['requireRole:admin', 'revalidateTag:categories']);
  });

  it('expires nothing when the role check refuses the caller', async () => {
    requireRole.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));

    await expect(expirePublicCategories()).rejects.toThrow('NEXT_REDIRECT');
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
