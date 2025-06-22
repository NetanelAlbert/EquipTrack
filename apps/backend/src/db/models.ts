import {
  InventoryItem,
  Organization,
  Product,
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
  InventoryItem = 'INVENTORY_ITEM',
  InventoryUniqueItem = 'INVENTORY_UNIQUE_ITEM',
  Form = 'FORM',
  PredefinedForm = 'PREDEFINED_FORM',
}
// ===================================
// Entity-specific Database Models
// ===================================

export interface OrganizationDb extends Organization, DbItem {}

export interface ProductDb extends Product, DbItem {}

export interface UserDb extends User, DbItem {}

/**
 * Represents the link between a User and an Organization in the database.
 */
export interface UserInOrganizationDb extends UserInOrganization, DbItem {
  organizationToUserQueryKey: string;
}

// export interface InventoryItemDb extends InventoryItem, DbItem {
//   holderId: Holder;
//   heldItemKey: string;
// }

// export interface UniqueInventoryItemDb
//   extends UniqueInventoryItem,
//     InventoryItemDb {}
// export interface BulkInventoryItemDb
//   extends BulkInventoryItem,
//     InventoryItemDb {}
