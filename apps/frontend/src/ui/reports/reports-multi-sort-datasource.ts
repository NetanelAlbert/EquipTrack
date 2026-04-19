import {
  MatMultiSort,
  MatMultiSortTableDataSource,
} from 'ngx-mat-multi-sort';

type SortDir = 'asc' | 'desc';

/**
 * Client-side multi-sort with locale-aware string compare.
 * The stock MatMultiSortTableDataSource uses numeric >/< on d[columnId], which fails for nested rows.
 */
export class ReportsMultiSortDataSource<T> extends MatMultiSortTableDataSource<T> {
  constructor(
    sort: MatMultiSort,
    private readonly compareRow: (
      a: T,
      b: T,
      columnId: string,
      direction: SortDir
    ) => number,
    private readonly tiebreaker?: (a: T, b: T) => number
  ) {
    super(sort, true);
  }

  override sortData(data: T[], actives: string[], directions: string[]): T[] {
    const copy = [...data];
    copy.sort((a, b) => {
      for (let i = 0; i < actives.length; i++) {
        const col = actives[i];
        const dir = (directions[i] === 'desc' ? 'desc' : 'asc') as SortDir;
        const c = this.compareRow(a, b, col, dir);
        if (c !== 0) {
          return c;
        }
      }
      return this.tiebreaker ? this.tiebreaker(a, b) : 0;
    });
    return copy;
  }
}
