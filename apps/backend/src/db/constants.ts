// ------------------------------
// Dynamic table names per stage
// ------------------------------
// Compute the DynamoDB table name based on the current deployment stage (e.g. "dev", "staging", "production").
// In production we use the plain base name. For every other stage we suffix the base name with "-<stage>"
// so that multiple environments can coexist in the same AWS account.

const STAGE = process.env.STAGE || 'dev';

function stageTableName(base: string): string {
  return STAGE === 'production' ? base : `${base}-${STAGE}`;
}

export const REPORT_TABLE_NAME = stageTableName('EquipTrackReport');
export const USERS_AND_ORGANIZATIONS_TABLE_NAME = stageTableName(
  'UsersAndOrganizations'
);
export const INVENTORY_TABLE_NAME = stageTableName('Inventory');
export const FORMS_TABLE_NAME = stageTableName('Forms');

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
export const WAREHOUSE_SUFFIX = 'WAREHOUSE';
export const TRANSFER_PREFIX = 'TRANSFER#';
export const FORM_PREFIX = 'FORM#';
export const DATE_PREFIX = 'DATE#';
export const ITEM_KEY_PREFIX = 'ITEM_KEY#';
export const LOCK_PREFIX = 'LOCK#';

// ===================================
// Special / Reserved Sort Keys
// ===================================
export const METADATA_SK = 'METADATA';

// ===================================
// Index Names and their attributes
// ===================================
export const ITEMS_BY_HOLDER_INDEX = 'ItemsByHolderIndex';
export const ITEMS_BY_HOLDER_INDEX_HOLDER_PK = 'holderIdQueryKey';

export const PRODUCTS_BY_ORGANIZATION_INDEX = 'ProductsByOrganizationIndex';
export const PRODUCTS_BY_ORGANIZATION_INDEX_PK = 'organizationId';

export const ORGANIZATION_TO_USERS_INDEX = 'OrganizationToUsersIndex';
export const ORGANIZATION_TO_USERS_INDEX_PK = 'organizationId';
export const ORGANIZATION_TO_USERS_INDEX_SK = 'PK';

export const TRANSACTIONS_INDEX = 'TransactionsIndex';
export const ITEM_REPORT_HISTORY_INDEX = 'ItemReportHistoryIndex';
export const FORMS_BY_ORGANIZATION_INDEX = 'FormsByOrganizationIndex';

// ===================================
// DynamoDB Limits and Configuration
// ===================================
export const BATCH_WRITE_SIZE = 25;

// ===================================
// DynamoDB Attribute Names and Expression Placeholders
// ===================================
export const ORG_DAILY_REPORT_ID_ATTR = 'orgDailyReportId';
export const ITEM_ORG_KEY_ATTR = 'itemOrgKey';
export const ORG_DAILY_REPORT_ID_PLACEHOLDER = ':orgDailyReportId';
export const ITEM_ORG_KEY_PLACEHOLDER = ':itemOrgKey';
