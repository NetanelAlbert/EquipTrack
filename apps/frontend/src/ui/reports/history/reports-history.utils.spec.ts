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
        productId: 'p_a',
        quantity: 1,
        upis: ['u_x'],
      },
    ],
  };

  it('flattenExpectedInventoryKeys collects keys', () => {
    const keys = flattenExpectedInventoryKeys(inv);
    expect(keys.has('p_a\u001fu_x')).toBe(true);
  });

  it('mergeReportedAndNotReported adds missing rows with holder', () => {
    const reported: ItemReport[] = [
      {
        productId: 'p_a',
        upi: 'u_x',
        location: 'A',
        reportedBy: 'rep',
      },
    ];
    const invMulti: Record<string, InventoryItem[]> = {
      u1: [
        {
          productId: 'p_a',
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
    expect(notReported?.productId).toBe('p_a');
    expect(notReported?.upi).toBe('u_y');
    expect(notReported?.ownerUserId).toBe('u1');
  });
});
