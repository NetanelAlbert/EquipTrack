import {
  InventoryItem,
  ItemReport,
  itemReportCompositeKey,
  parseItemReportCompositeKey,
} from '@equip-track/shared';

export interface HistoryDisplayRow extends ItemReport {
  isNotReported: boolean;
}

export function flattenExpectedInventoryKeys(
  itemsByHolder: Record<string, InventoryItem[]>
): Set<string> {
  const keys = new Set<string>();
  for (const items of Object.values(itemsByHolder)) {
    for (const inv of items) {
      for (const upi of inv.upis ?? []) {
        keys.add(itemReportCompositeKey(inv.productId, upi));
      }
    }
  }
  return keys;
}

export function buildHolderByInventoryKey(
  itemsByHolder: Record<string, InventoryItem[]>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [holderId, items] of Object.entries(itemsByHolder)) {
    for (const inv of items) {
      for (const upi of inv.upis ?? []) {
        map.set(itemReportCompositeKey(inv.productId, upi), holderId);
      }
    }
  }
  return map;
}

export function mergeReportedAndNotReported(
  reported: ItemReport[],
  expectedKeys: Set<string>,
  holderByKey: Map<string, string>
): HistoryDisplayRow[] {
  const reportedKeys = new Set(
    reported.map((r) => itemReportCompositeKey(r.productId, r.upi))
  );
  const rows: HistoryDisplayRow[] = reported.map((r) => ({
    ...r,
    isNotReported: false,
  }));
  for (const key of expectedKeys) {
    if (reportedKeys.has(key)) {
      continue;
    }
    const parsed = parseItemReportCompositeKey(key);
    const productId = parsed?.productId ?? key;
    const upi = parsed?.upi ?? '';
    const holderId = holderByKey.get(key);
    rows.push({
      productId,
      upi,
      location: '',
      reportedBy: '',
      isNotReported: true,
      ...(holderId !== undefined && { ownerUserId: holderId }),
    });
  }
  return rows;
}
