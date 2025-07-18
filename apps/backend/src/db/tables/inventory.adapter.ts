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
  LockDb,
} from '../models';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  GetCommand,
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
  LOCK_PREFIX,
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
          break;
        }
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
   * Creates a bulk inventory item with flattened fields
   */
  async createBulkInventoryItem(
    productId: string,
    organizationId: string,
    holderId: string,
    quantity: number
  ): Promise<void> {
    const inventoryItem: BulkInventoryItemDb = {
      ...this.getBulkProductKey(productId, organizationId, holderId),
      dbItemType: DbItemType.InventoryBulkItem,
      // Flattened InventoryItem fields
      productId,
      quantity,
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

  /**
   * Deletes a unique inventory item
   */
  async deleteUniqueInventoryItem(
    productId: string,
    upi: string,
    organizationId: string
  ): Promise<void> {
    const key = this.getUniqueProductKey(productId, upi, organizationId);

    const command = new DeleteCommand({
      TableName: this.tableName,
      Key: key,
    });

    await this.docClient.send(command);
  }

  /**
   * Deletes a bulk inventory item
   */
  async deleteBulkInventoryItem(
    productId: string,
    organizationId: string,
    holderId: string
  ): Promise<void> {
    const key = this.getBulkProductKey(productId, organizationId, holderId);

    const command = new DeleteCommand({
      TableName: this.tableName,
      Key: key,
    });

    await this.docClient.send(command);
  }

  /**
   * Checks if a product is used in any inventory items
   */
  async isProductUsedInInventory(
    productId: string,
    organizationId: string
  ): Promise<boolean> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `${ORG_PREFIX}${organizationId}`,
        ':sk': `${PRODUCT_PREFIX}${productId}#`,
      },
      Limit: 1, // We only need to know if any exist
    });

    const result = await this.docClient.send(command);
    return (result.Items?.length ?? 0) > 0;
  }

  /**
   * Deletes a product definition
   */
  async deleteProduct(
    productId: string,
    organizationId: string
  ): Promise<void> {
    const key = this.getProductKey(productId, organizationId);

    const command = new DeleteCommand({
      TableName: this.tableName,
      Key: key,
    });

    await this.docClient.send(command);
  }

  /**
   * Acquires a lock for inventory operations on an organization
   * @param organizationId The organization to lock
   * @param lockTimeoutMs Lock timeout in milliseconds (default: 3000ms)
   * @returns true if lock was acquired, false if already locked
   */
  async acquireInventoryLock(
    organizationId: string,
    lockTimeoutMs = 3000
  ): Promise<number | false> {
    const lockKey = this.getLockKey(organizationId);
    const currentTimestamp = Date.now();

    try {
      // First, check if a lock exists
      const getCommand = new GetCommand({
        TableName: this.tableName,
        Key: lockKey,
      });

      const existingLock = await this.docClient.send(getCommand);

      if (existingLock.Item) {
        const lockDb = existingLock.Item as LockDb;
        const lockAge = currentTimestamp - lockDb.lockTimestamp;

        if (lockAge < lockTimeoutMs) {
          // Lock is still valid, cannot acquire
          return false;
        }

        // Lock is expired, delete it first
        await this.docClient.send(
          new DeleteCommand({
            TableName: this.tableName,
            Key: lockKey,
            ConditionExpression: 'lockTimestamp = :lockTimestamp',
            ExpressionAttributeValues: {
              ':lockTimestamp': lockDb.lockTimestamp,
            },
          })
        );
      }

      // Try to acquire the lock
      const lockDb: LockDb = {
        ...lockKey,
        dbItemType: DbItemType.Lock,
        organizationId,
        lockTimestamp: currentTimestamp,
        lockType: 'INVENTORY',
      };

      const putCommand = new PutCommand({
        TableName: this.tableName,
        Item: lockDb,
        ConditionExpression: 'attribute_not_exists(PK)',
      });

      await this.docClient.send(putCommand);
      return currentTimestamp;
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        // Another process acquired the lock between our check and put
        return false;
      }
      throw error;
    }
  }

  /**
   * Releases the inventory lock for an organization
   * @param organizationId The organization to unlock
   */
  async releaseInventoryLock(
    organizationId: string,
    lockTimestamp: number
  ): Promise<void> {
    const lockKey = this.getLockKey(organizationId);

    const command = new DeleteCommand({
      TableName: this.tableName,
      Key: lockKey,
      ConditionExpression: 'lockTimestamp = :lockTimestamp',
      ExpressionAttributeValues: {
        ':lockTimestamp': lockTimestamp,
      },
    });

    try {
      await this.docClient.send(command);
    } catch (error) {
      // Ignore errors when releasing lock (it might already be expired/deleted)
      console.warn(
        `Failed to release lock for organization ${organizationId}:`,
        error
      );
    }
  }

  /**
   * Executes a function with an inventory lock
   * @param organizationId The organization to lock
   * @param fn The function to execute while holding the lock
   * @param lockTimeoutMs Lock timeout in milliseconds (default: 3000ms)
   * @param maxRetries Maximum number of retry attempts (default: 3)
   * @param retryDelayMs Delay between retries in milliseconds (default: 100ms)
   */
  async withInventoryLock<T>(
    organizationId: string,
    fn: () => Promise<T>,
    lockTimeoutMs = 3000,
    maxRetries = 3,
    retryDelayMs = 100
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const lockAcquired: number | false = await this.acquireInventoryLock(
          organizationId,
          lockTimeoutMs
        );

        if (!lockAcquired) {
          lastError = new Error(
            `Failed to acquire inventory lock for organization ${organizationId} after ${
              attempt + 1
            } attempts`
          );
          if (attempt < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
            continue;
          }
          throw lastError;
        }

        try {
          return await fn();
        } finally {
          await this.releaseInventoryLock(organizationId, lockAcquired);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }
    }

    throw lastError || new Error('Unknown error occurred');
  }

  private getLockKey(organizationId: string): DbKey {
    return {
      PK: `${ORG_PREFIX}${organizationId}`,
      SK: `${LOCK_PREFIX}INVENTORY`,
    };
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
