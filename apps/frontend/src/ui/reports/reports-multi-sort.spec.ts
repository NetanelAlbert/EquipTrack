import { applyMultiColumnSort } from './reports-multi-sort';

describe('applyMultiColumnSort', () => {
  it('applies secondary sort when first column ties', () => {
    const rows = [
      { a: 1, b: 'z' },
      { a: 1, b: 'a' },
      { a: 2, b: 'm' },
    ];
    const out = applyMultiColumnSort(
      rows,
      ['a', 'b'],
      ['asc', 'asc'],
      (x, y, col, dir) => {
        const inv = dir === 'asc' ? 1 : -1;
        const vx = (x as { a: number; b: string })[col as 'a' | 'b'];
        const vy = (y as { a: number; b: string })[col as 'a' | 'b'];
        if (vx < vy) {
          return -1 * inv;
        }
        if (vx > vy) {
          return 1 * inv;
        }
        return 0;
      }
    );
    expect(out.map((r) => r.b)).toEqual(['a', 'z', 'm']);
  });
});
