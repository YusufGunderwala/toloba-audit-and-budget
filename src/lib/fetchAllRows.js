import { supabase } from './supabase';

const PAGE_SIZE = 500;

export async function fetchAllRows(table, columns, sortColumn, ascending) {
  const rows = [];
  let expectedCount = null;
  const ids = new Set();
  for (let offset = 0; ; ) {
    const { data, count, error } = await supabase.from(table)
      .select(columns, offset === 0 ? { count: 'exact' } : undefined)
      .order(sortColumn, { ascending })
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (offset === 0) expectedCount = count;
    if (!data.length) {
      if (expectedCount !== null && offset < expectedCount) throw new Error(`${table} changed during refresh. Try again.`);
      return rows;
    }
    for (const row of data) {
      if (ids.has(row.id)) throw new Error(`${table} changed during refresh. Try again.`);
      ids.add(row.id);
      rows.push(row);
    }
    offset += data.length;
    if (offset === expectedCount) return rows;
  }
}
