import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchPagination } from './search-pagination';

afterEach(cleanup);

describe('SearchPagination', () => {
  it('draws nothing while every match fits on one page', () => {
    const { container } = render(
      <SearchPagination page={1} pageSize={20} total={20} onPageChange={vi.fn()} />,
    );

    expect(container.textContent).toBe('');
  });

  it('reaches page 2 when there are 21 matches', () => {
    const onPageChange = vi.fn();
    render(<SearchPagination page={1} pageSize={20} total={21} onPageChange={onPageChange} />);

    expect(screen.getByText('Page 1 of 2')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('disables Previous on the first page and Next on the last', () => {
    const { rerender } = render(
      <SearchPagination page={1} pageSize={20} total={45} onPageChange={vi.fn()} />,
    );
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(
      false,
    );

    rerender(<SearchPagination page={3} pageSize={20} total={45} onPageChange={vi.fn()} />);

    expect(screen.getByText('Page 3 of 3')).toBeDefined();
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('steps back one page', () => {
    const onPageChange = vi.fn();
    render(<SearchPagination page={3} pageSize={20} total={45} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(2);
  });
});
