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
