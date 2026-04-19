import { InventoryItem, ItemReport } from '@equip-track/shared';
import {
  buildHolderByInventoryKey,
  flattenExpectedInventoryKeys,
  mergeReportedAndNotReported,
} from './reports-history.utils';

describe('reports-history.utils', () => {
  const inv: Record<string, InventoryItem[]> = {
    u1: [
      {
        productId: '550e8400-e29b-41d4-a716-446655440000',
        quantity: 1,
        upis: ['u_x'],
      },
    ],
  };

  it('flattenExpectedInventoryKeys collects keys', () => {
    const keys = flattenExpectedInventoryKeys(inv);
    expect(
      keys.has(
        `550e8400-e29b-41d4-a716-446655440000\u001fu_x`
      )
    ).toBe(true);
  });

  it('mergeReportedAndNotReported adds missing rows with holder', () => {
    const reported: ItemReport[] = [
      {
        productId: '550e8400-e29b-41d4-a716-446655440001',
        upi: 'u_x',
        location: 'A',
        reportedBy: 'rep',
        reportTimestamp: '2026-04-07T08:15:30.000Z',
      },
    ];
    const invMulti: Record<string, InventoryItem[]> = {
      u1: [
        {
          productId: '550e8400-e29b-41d4-a716-446655440001',
          quantity: 2,
          upis: ['u_x', 'u_y'],
        },
      ],
    };
    const holderMap = buildHolderByInventoryKey(invMulti);
    const keys = flattenExpectedInventoryKeys(invMulti);
    const merged = mergeReportedAndNotReported(
      reported,
      keys,
      holderMap
    );
    expect(merged).toHaveLength(2);
    const notReported = merged.find((r) => r.isNotReported);
    expect(notReported?.productId).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(notReported?.upi).toBe('u_y');
    expect(notReported?.ownerUserId).toBe('u1');
    const reportedRow = merged.find((r) => !r.isNotReported);
    expect(reportedRow?.reportTimestamp).toBe('2026-04-07T08:15:30.000Z');
  });
});
