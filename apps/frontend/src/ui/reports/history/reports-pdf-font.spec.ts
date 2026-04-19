import { toVisualOrder } from './reports-pdf-font';

describe('toVisualOrder', () => {
  it('returns empty/falsy text unchanged', () => {
    expect(toVisualOrder('')).toBe('');
    expect(toVisualOrder(null as unknown as string)).toBeNull();
  });

  it('returns pure-Latin text unchanged', () => {
    expect(toVisualOrder('Hello World')).toBe('Hello World');
  });

  it('reverses pure-Hebrew text', () => {
    expect(toVisualOrder('שלום')).toBe('םולש');
  });

  it('handles mixed Hebrew + Latin (digits)', () => {
    const result = toVisualOrder('שלום 123');
    expect(result).toContain('123');
    expect(result).toContain('םולש');
  });
});

describe('PDF RTL column reversal', () => {
  const maybeReverse = (arr: string[], isRtl: boolean) =>
    isRtl ? [...arr].reverse() : arr;

  const columns = [
    'Product',
    'UPI',
    'Status',
    'Location',
    'Holder',
    'Department',
    'Reporter',
    'Report Time',
  ];

  it('does not reverse columns in LTR mode', () => {
    expect(maybeReverse(columns, false)).toEqual(columns);
  });

  it('reverses columns in RTL mode so first web column becomes last PDF column', () => {
    const reversed = maybeReverse(columns, true);
    expect(reversed[0]).toBe('Report Time');
    expect(reversed[reversed.length - 1]).toBe('Product');
    expect(reversed.length).toBe(columns.length);
  });

  it('does not mutate the original array', () => {
    const original = [...columns];
    maybeReverse(columns, true);
    expect(columns).toEqual(original);
  });
});
