import { useState } from 'react';

export const PAGE_SIZE = 75;

export function useVisibleRows(rows) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  return {
    visibleRows: rows.length > limit ? rows.slice(0, limit) : rows,
    showMore: () => setLimit(current => current + PAGE_SIZE),
    remaining: Math.max(0, rows.length - limit)
  };
}
