import {
  Organization,
  User,
  UserInOrganization,
} from '@equip-track/shared';

/**
 * Base interface for all items stored in the main EquipTrack DynamoDB table.
 */
export interface DbKey {
  PK: string;
  SK: string;
}

export interface DbItem extends DbKey {
  dbItemType: DbItemType;
}

export enum DbItemType {
  Organization = 'ORG',
  User = 'USER',
  UserInOrganization = 'UIO',
  Product = 'PRODUCT',
  InventoryBulkItem = 'INVENTORY_BULK_ITEM',
  InventoryUniqueItem = 'INVENTORY_UNIQUE_ITEM',
  Form = 'FORM',
  PredefinedForm = 'PREDEFINED_FORM',
}
// ===================================
// Entity-specific Database Models
// ===================================

export interface OrganizationDb extends Organization, DbItem {}

/**
 * Product stored in DynamoDB with flattened fields for better query performance
 */
export interface ProductDb extends DbItem {
  // Flattened Product fields
  id: string;
  name: string;
  hasUpi: boolean;
  // Additional DB-specific fields
  organizationId: string;
}

export interface UserDb extends User, DbItem {}

/**
 * Represents the link between a User and an Organization in the database.
 */
export interface UserInOrganizationDb extends UserInOrganization, DbItem {
  organizationToUserQueryKey: string;
}

/**
 * Base interface for inventory items in DynamoDB
 */
export interface InventoryItemDb extends DbItem {
  // Flattened InventoryItem fields
  productId: string;
  // Additional DB-specific fields
  organizationId: string;
  holderId: string; // USER#123 or WAREHOUSE
  holderIdQueryKey: string; // For GSI queries
}

/**
 * Unique inventory item (has UPI) stored in DynamoDB
 */
export interface UniqueInventoryItemDb extends InventoryItemDb {
  upi: string;
}

/**
 * Bulk inventory item (no UPI) stored in DynamoDB
 */
export interface BulkInventoryItemDb extends InventoryItemDb {
  // Quantity is more meaningful for bulk items
  quantity: number;
}
