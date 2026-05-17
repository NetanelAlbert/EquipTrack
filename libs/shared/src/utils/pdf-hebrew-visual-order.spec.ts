import {
  splitLogicalBidiRuns,
  toVisualOrder,
} from './pdf-hebrew-visual-order';

describe('splitLogicalBidiRuns', () => {
  it('returns a single LTR run when no RTL characters appear', () => {
    expect(splitLogicalBidiRuns('Hello')).toEqual([{ text: 'Hello', dir: 'L' }]);
  });

  it('returns a single RTL run for pure Hebrew', () => {
    expect(splitLogicalBidiRuns('שלום')).toEqual([{ text: 'שלום', dir: 'R' }]);
  });

  it('keeps Hebrew first then digits as R run then L run', () => {
    const runs = splitLogicalBidiRuns('מס טופס מקור: abc-123');
    expect(runs.length).toBeGreaterThanOrEqual(2);
    expect(runs.some((r) => r.dir === 'R')).toBe(true);
    expect(runs.some((r) => r.dir === 'L')).toBe(true);
  });
});

describe('toVisualOrder', () => {
  it('returns empty string unchanged', () => {
    expect(toVisualOrder('')).toBe('');
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

  it('matches legacy behaviour via splitLogicalBidiRuns composition', () => {
    const s = 'מאושר על ידי: user-uuid-1';
    const runs = splitLogicalBidiRuns(s);
    const composed = runs
      .slice()
      .reverse()
      .map((r) =>
        r.dir === 'R' ? r.text.split('').reverse().join('') : r.text
      )
      .join('');
    expect(composed).toBe(toVisualOrder(s));
  });
});
