import { InventoryAdapter } from '../db/tables/inventory.adapter';

/** Loads catalog product names for PDF תיאור column (one DynamoDB read per distinct id). */
export async function loadProductDisplayNamesForPdf(
  inventoryAdapter: InventoryAdapter,
  organizationId: string,
  productIds: readonly string[]
): Promise<Record<string, string>> {
  const unique = [...new Set(productIds)];
  const names: Record<string, string> = {};
  await Promise.all(
    unique.map(async (id) => {
      const p = await inventoryAdapter.getProductFromDB(id, organizationId);
      if (p) {
        names[id] = p.name;
      }
    })
  );
  return names;
}
