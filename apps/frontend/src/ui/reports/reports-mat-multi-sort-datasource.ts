import {
  MatMultiSort,
  MatMultiSortTableDataSource,
} from 'ngx-mat-multi-sort';

/**
 * ngx-mat-multi-sort's default client-side sort uses `row[columnId]`; report rows are
 * nested (`TodayReportRow`, `HistoryDisplayRow`). This subclass delegates to
 * {@link applyMultiColumnSort} like the demo does via `MatMultiSortTableDataSource` +
 * `orderData()` on `(matSortChange)`.
 */
export class ReportsMatMultiSortTableDataSource<T> extends MatMultiSortTableDataSource<T> {
  constructor(
    sort: MatMultiSort,
    private readonly sortRows: (
      data: T[],
      actives: string[],
      directions: string[]
    ) => T[]
  ) {
    super(sort, true);
  }

  override sortData(data: T[], actives: string[], directions: string[]): T[] {
    return this.sortRows(data, actives, directions);
  }
}
