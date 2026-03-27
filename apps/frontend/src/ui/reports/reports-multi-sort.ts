type SortDir = 'asc' | 'desc';

/**
 * Stable multi-column sort. `actives` / `directions` come from ngx-mat-multi-sort's MatMultiSort.
 */
export function applyMultiColumnSort<T>(
  rows: T[],
  actives: string[],
  directions: string[],
  compare: (a: T, b: T, columnId: string, dir: SortDir) => number
): T[] {
  if (!actives.length) {
    return [...rows];
  }
  const copy = [...rows];
  copy.sort((a, b) => {
    for (let i = 0; i < actives.length; i++) {
      const col = actives[i];
      const dir = (directions[i] === 'desc' ? 'desc' : 'asc') as SortDir;
      const c = compare(a, b, col, dir);
      if (c !== 0) {
        return c;
      }
    }
    return 0;
  });
  return copy;
}
