import {
  InventoryItem,
  ItemReport,
  itemReportCompositeKey,
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
    const sep = key.indexOf('\u001f');
    const productId = sep === -1 ? key : key.slice(0, sep);
    const upi = sep === -1 ? '' : key.slice(sep + 1);
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
