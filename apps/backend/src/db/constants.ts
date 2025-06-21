export const MAIN_TABLE_NAME = 'EquipTrack';
export const REPORT_TABLE_NAME = 'EquipTrackReport';

// ===================================
// Entity Type Discriminators
// ===================================
export const UNIQUE_ITEM_TYPE = 'UNIQUE_ITEM';
export const BULK_ITEM_HOLDING_TYPE = 'BULK_ITEM_HOLDING';

// ===================================
// DynamoDB Key Prefixes
// ===================================
export const ORG_PREFIX = 'ORG#';
export const USER_PREFIX = 'USER#';
export const PRODUCT_PREFIX = 'PRODUCT#';
export const UPI_PREFIX = 'UPI#';
export const HOLDER_PREFIX = 'HOLDER#';
export const WAREHOUSE_PREFIX = 'WAREHOUSE#';
export const TRANSFER_PREFIX = 'TRANSFER#';

// ===================================
// Special / Reserved Sort Keys
// ===================================
export const METADATA_SK = 'METADATA';

// ===================================
// Index Names
// ===================================
export const ITEMS_BY_HOLDER_INDEX = 'ItemsByHolderIndex';
export const ORGANIZATION_TO_USERS_INDEX = 'OrganizationToUsersIndex';
export const TRANSACTIONS_INDEX = 'TransactionsIndex';
export const ITEM_REPORT_HISTORY_INDEX = 'ItemReportHistoryIndex';
