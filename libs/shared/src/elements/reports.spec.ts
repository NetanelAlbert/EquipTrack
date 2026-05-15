import {
  itemReportCompositeKey,
  parseItemReportCompositeKey,
} from './reports';

describe('itemReportCompositeKey / parseItemReportCompositeKey', () => {
  it('round-trips UUID product id and upi with underscores', () => {
    const productId = '550e8400-e29b-41d4-a716-446655440000';
    const upi = 'LAP_a_b_001';
    const key = itemReportCompositeKey(productId, upi);
    expect(key).toContain('\u001f');
    expect(parseItemReportCompositeKey(key)).toEqual({ productId, upi });
  });

  it('returns null for legacy underscore-only keys', () => {
    expect(
      parseItemReportCompositeKey('prod-1_upi-2')
    ).toBeNull();
  });
});
