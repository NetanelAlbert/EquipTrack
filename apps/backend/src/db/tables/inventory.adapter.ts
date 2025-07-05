/**
 * This adapter is used to access the Inventory table
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DbKey,
  ProductDb,
  InventoryItemDb,
  UniqueInventoryItemDb,
  BulkInventoryItemDb,
  DbItemType,
  DbItem,
} from '../models';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  INVENTORY_TABLE_NAME,
  ORG_PREFIX,
  PRODUCT_PREFIX,
  UPI_PREFIX,
  HOLDER_PREFIX,
  ITEMS_BY_HOLDER_INDEX,
  ITEMS_BY_HOLDER_INDEX_HOLDER_PK,
  PRODUCTS_BY_ORGANIZATION_INDEX,
  PRODUCTS_BY_ORGANIZATION_INDEX_PK,
  WAREHOUSE_SUFFIX,
} from '../constants';
import { InventoryItem, Product } from '@equip-track/shared';

export interface OrganizationInventory {
  products: Product[];
  warehouseItems: InventoryItem[];
  usersItems: Map<string, InventoryItem[]>;
}

export class InventoryAdapter {
  private readonly client = new DynamoDBClient({});
  private readonly docClient = DynamoDBDocumentClient.from(this.client);
  private readonly tableName = INVENTORY_TABLE_NAME;

  async getUserInventory(
    organizationId: string,
    userId: string
  ): Promise<InventoryItem[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: ITEMS_BY_HOLDER_INDEX,
      KeyConditionExpression: `${ITEMS_BY_HOLDER_INDEX_HOLDER_PK} = :pk`,
      ExpressionAttributeValues: {
        ':pk': `${HOLDER_PREFIX}${organizationId}#${userId}`,
      },
    });

    const result = await this.docClient.send(command);
    const items = (result.Items as InventoryItemDb[]) ?? [];
    return this.getUserInventoryItems(items);
  }

  private getUserInventoryItems(items: InventoryItemDb[]): InventoryItem[] {
    const inventoryItems: InventoryItem[] = [];
    // Map of productId to upis
    const uniqueMap = new Map<string, string[]>();

    items.forEach((item: InventoryItemDb) => {
      if (item.dbItemType === DbItemType.InventoryUniqueItem) {
        const uniqueItem = item as UniqueInventoryItemDb;
        const productId = uniqueItem.productId;
        const upi = uniqueItem.upi;
        if (upi) {
          const existingUpis = uniqueMap.get(productId) || [];
          uniqueMap.set(productId, [...existingUpis, upi]);
        }
      } else if (item.dbItemType === DbItemType.InventoryBulkItem) {
        const bulkItem = item as BulkInventoryItemDb;
        inventoryItems.push({
          productId: bulkItem.productId,
          quantity: bulkItem.quantity,
        });
      } else {
        throw new Error(`Invalid item type: ${item.dbItemType}`);
      }
    });

    uniqueMap.forEach((upis, productId) => {
      inventoryItems.push({
        productId,
        quantity: upis.length,
        upis,
      });
    });

    return inventoryItems;
  }

  async getAllProductsByOrganization(
    organizationId: string
  ): Promise<Product[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: PRODUCTS_BY_ORGANIZATION_INDEX,
      KeyConditionExpression: `${PRODUCTS_BY_ORGANIZATION_INDEX_PK} = :pk`,
      ExpressionAttributeValues: {
        ':pk': `${ORG_PREFIX}${organizationId}`,
      },
    });

    const result = await this.docClient.send(command);
    const productsDB = (result.Items as ProductDb[]) ?? [];
    return productsDB.map(this.getProduct);
  }

  async getOrganizationInventory(
    organizationId: string
  ): Promise<OrganizationInventory> {
    const command = new QueryCommand({
      TableName: this.tableName,
      ExpressionAttributeValues: {
        ':pk': `${ORG_PREFIX}${organizationId}`,
      },
    });

    const result = await this.docClient.send(command);
    const items = result.Items ?? [];
    const products: Product[] = [];
    const warehouseItems: InventoryItem[] = [];
    const usersItems: Map<string, InventoryItem[]> = new Map();

    const dbItemsByHolder: Map<string, InventoryItemDb[]> = new Map();

    items.forEach((item: DbItem) => {
      switch (item.dbItemType) {
        case DbItemType.Product: {
          const productDb = item as ProductDb;
          products.push({
            id: productDb.id,
            name: productDb.name,
            hasUpi: productDb.hasUpi,
          });
          break;
        }
        case DbItemType.InventoryUniqueItem:
        case DbItemType.InventoryBulkItem: { 
          const bulkItemDb = item as BulkInventoryItemDb;
          const existingItems = dbItemsByHolder.get(bulkItemDb.holderId) || [];
          existingItems.push(bulkItemDb);
          dbItemsByHolder.set(bulkItemDb.holderId, existingItems);
          break;}
        default:
          throw new Error(`Invalid item type: ${item.dbItemType}`);
      }
    });

    dbItemsByHolder.forEach((items, holderId) => {
      const inventoryItems = this.getUserInventoryItems(items);
      if (holderId.endsWith(WAREHOUSE_SUFFIX)) {
        warehouseItems.push(...inventoryItems);
      } else {
        usersItems.set(holderId, inventoryItems);
      }
    });

    return {
      products,
      warehouseItems,
      usersItems,
    };
  }

  /**
   * Creates a new product definition with flattened fields
   */
  async createProduct(product: Product, organizationId: string): Promise<void> {
    const productDb: ProductDb = {
      ...this.getProductKey(product.id, organizationId),
      dbItemType: DbItemType.Product,
      // Flattened Product fields
      id: product.id,
      name: product.name,
      hasUpi: product.hasUpi,
      // Additional DB-specific fields
      organizationId,
    };

    const command = new PutCommand({
      TableName: this.tableName,
      Item: productDb,
    });

    await this.docClient.send(command);
  }

  /**
   * Creates a unique inventory item with flattened fields
   */
  async createUniqueInventoryItem(
    productId: string,
    upi: string,
    organizationId: string,
    holderId: string
  ): Promise<void> {
    const inventoryItem: UniqueInventoryItemDb = {
      ...this.getUniqueProductKey(productId, upi, organizationId),
      dbItemType: DbItemType.InventoryUniqueItem,
      // Flattened InventoryItem fields
      productId,
      upi,
      // Additional DB-specific fields
      organizationId,
      holderId,
      holderIdQueryKey: `${HOLDER_PREFIX}${organizationId}#${holderId}`,
    };

    const command = new PutCommand({
      TableName: this.tableName,
      Item: inventoryItem,
    });

    await this.docClient.send(command);
  }

  /**
   * Updates inventory item quantity using flattened fields
   */
  async updateInventoryItemQuantity(
    productId: string,
    organizationId: string,
    holderId: string,
    quantity: number
  ): Promise<void> {
    const key = this.getBulkProductKey(productId, organizationId, holderId);

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: key,
      UpdateExpression: 'SET quantity = :quantity',
      ExpressionAttributeValues: {
        ':quantity': quantity,
      },
    });

    await this.docClient.send(command);
  }

  private getProductKey(productId: string, organizationId: string): DbKey {
    return {
      PK: `${ORG_PREFIX}${organizationId}`,
      SK: `${PRODUCT_PREFIX}${productId}`,
    };
  }

  private getUniqueProductKey(
    productId: string,
    upi: string,
    organizationId: string
  ): DbKey {
    return {
      PK: `${ORG_PREFIX}${organizationId}`,
      SK: `${PRODUCT_PREFIX}${productId}#${UPI_PREFIX}#${upi}`,
    };
  }

  private getBulkProductKey(
    productId: string,
    organizationId: string,
    holderId: string
  ): DbKey {
    return {
      PK: `${ORG_PREFIX}${organizationId}`,
      SK: `${PRODUCT_PREFIX}${productId}#${HOLDER_PREFIX}#${holderId}`,
    };
  }

  private getProduct(productDB: ProductDb): Product {
    return {
      id: productDB.id, // Direct access to flattened field
      name: productDB.name, // Direct access to flattened field
      hasUpi: productDB.hasUpi, // Direct access to flattened field
    };
  }
}
