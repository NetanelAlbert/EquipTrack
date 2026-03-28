import { MatMultiSort } from 'ngx-mat-multi-sort';
import { applyMultiColumnSort } from './reports-multi-sort';
import { ReportsMatMultiSortTableDataSource } from './reports-mat-multi-sort-datasource';

interface DemoRow {
  product: string;
  upi: string;
}

describe('ReportsMatMultiSortTableDataSource', () => {
  it('orderData applies secondary column when primary ties (library demo pattern)', () => {
    const sort = new MatMultiSort();
    sort.actives = ['product', 'upi'];
    sort.directions = ['asc', 'asc'];

    const rows: DemoRow[] = [
      { product: 'A', upi: 'z' },
      { product: 'A', upi: 'a' },
      { product: 'B', upi: 'm' },
    ];

    const ds = new ReportsMatMultiSortTableDataSource<DemoRow>(
      sort,
      (data, actives, directions) =>
        applyMultiColumnSort(
          data,
          actives,
          directions,
          (a, b, col, dir) => {
            const inv = dir === 'asc' ? 1 : -1;
            let cmp = 0;
            if (col === 'product') {
              cmp = a.product.localeCompare(b.product);
            } else if (col === 'upi') {
              cmp = a.upi.localeCompare(b.upi);
            }
            if (cmp !== 0) {
              return cmp * inv;
            }
            return 0;
          }
        )
    );

    ds.data = rows;
    ds.orderData();

    expect(ds.data.map((r) => r.upi)).toEqual(['a', 'z', 'm']);
  });

  it('exposes row updates via connect() (what mat-table must subscribe to)', () => {
    const sort = new MatMultiSort();
    sort.actives = ['upi'];
    sort.directions = ['asc'];

    const ds = new ReportsMatMultiSortTableDataSource<DemoRow>(
      sort,
      (data, actives, directions) =>
        applyMultiColumnSort(data, actives, directions, (a, b, col, dir) => {
          const inv = dir === 'asc' ? 1 : -1;
          if (col !== 'upi') {
            return 0;
          }
          const cmp = a.upi.localeCompare(b.upi);
          return cmp === 0 ? 0 : cmp * inv;
        })
    );

    const seen: DemoRow[][] = [];
    ds.connect().subscribe((rows) => seen.push([...rows]));

    ds.data = [
      { product: 'x', upi: 'b' },
      { product: 'x', upi: 'a' },
    ];
    ds.orderData();

    expect(seen.at(-1)?.map((r) => r.upi)).toEqual(['a', 'b']);
  });
});
