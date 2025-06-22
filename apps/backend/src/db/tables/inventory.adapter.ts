/**
 * This adapter is used to access the Inventory table
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DbKey, ProductDb, DbItemType } from '../models';
import {
  DynamoDBDocumentClient,
  BatchGetCommand,
  QueryCommand,
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
} from '../constants';
import { InventoryItem, Product } from '@equip-track/shared';

export interface InventoryItemWithProduct extends InventoryItem {
  product?: Product;
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
    const items = result.Items ?? [];

    // Group items by productId and merge quantities
    const inventoryMap = new Map<string, InventoryItem>();

    items.forEach((item: any) => {
      const productId = item.SK.split('#')[1]; // Extract productId from SK
      const existingItem = inventoryMap.get(productId);

      if (existingItem) {
        existingItem.quantity += item.quantity || 1;
        if (item.upi) {
          existingItem.upis = existingItem.upis || [];
          existingItem.upis.push(item.upi);
        }
      } else {
        inventoryMap.set(productId, {
          productId,
          quantity: item.quantity || 1,
          upis: item.upi ? [item.upi] : undefined,
        });
      }
    });

    return Array.from(inventoryMap.values());
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
    const productsDB = (result.Items as Array<ProductDb>) ?? [];
    return productsDB.map(this.getProduct);
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

  private getProduct(productDB: ProductDb): Product {
    return {
      id: productDB.id,
      name: productDB.name,
      hasUpi: productDB.hasUpi,
    };
  }
}
