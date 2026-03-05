import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { InventoryItem, Product, User, UserAndUserInOrganization } from '@equip-track/shared';
import {
  InventoryAdapter,
  OrganizationInventory,
  UsersAndOrganizationsAdapter,
} from '../db';

const BACKUP_BUCKET_NAME = 'equip-track-inventory-backup';
const UPI_FILE_NAME = 'upi-items.csv';
const NON_UPI_FILE_NAME = 'non-upi-items.csv';
const WAREHOUSE_DISPLAY_NAME = 'WAREHOUSE';
const UNKNOWN_USER_DISPLAY_NAME = 'UNKNOWN_USER';

interface BackupCsvPayload {
  upiCsv: string;
  nonUpiCsv: string;
}

interface BackupResult {
  status: boolean;
  processedOrganizations: number;
  uploadedOrganizations: number;
  skippedOrganizations: number;
}

const usersAndOrganizationsAdapter = new UsersAndOrganizationsAdapter();
const inventoryAdapter = new InventoryAdapter();
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'il-central-1',
});

export const handler = async (): Promise<BackupResult> => {
  const organizations = await usersAndOrganizationsAdapter.getAllOrganizations();
  const backupTimestamp = new Date().toISOString();

  let uploadedOrganizations = 0;
  let skippedOrganizations = 0;

  for (const organization of organizations) {
    const users = await usersAndOrganizationsAdapter.getUsersByOrganization(
      organization.id
    );
    const inventory = await inventoryAdapter.getOrganizationInventory(organization.id);
    const backupCsv = createBackupCsvPayload(inventory, users);

    const latestBackupCsv = await getLatestBackupCsv(organization.id);
    const shouldUpload =
      !latestBackupCsv ||
      latestBackupCsv.upiCsv !== backupCsv.upiCsv ||
      latestBackupCsv.nonUpiCsv !== backupCsv.nonUpiCsv;

    if (!shouldUpload) {
      skippedOrganizations += 1;
      console.log(
        `[InventoryStateBackup] Skipped upload for organization ${organization.id} because data is unchanged`
      );
      continue;
    }

    const prefix = `${organization.id}/${backupTimestamp}`;
    await Promise.all([
      uploadCsv(`${prefix}/${UPI_FILE_NAME}`, backupCsv.upiCsv),
      uploadCsv(`${prefix}/${NON_UPI_FILE_NAME}`, backupCsv.nonUpiCsv),
    ]);

    uploadedOrganizations += 1;
    console.log(
      `[InventoryStateBackup] Uploaded backup for organization ${organization.id} to ${prefix}`
    );
  }

  return {
    status: true,
    processedOrganizations: organizations.length,
    uploadedOrganizations,
    skippedOrganizations,
  };
};

function createBackupCsvPayload(
  inventory: OrganizationInventory,
  usersInOrganization: UserAndUserInOrganization[]
): BackupCsvPayload {
  const users = usersInOrganization
    .map((entry) => entry.user)
    .sort((a, b) => compareByNameThenId(a, b));

  return {
    upiCsv: createUpiCsv(inventory, users),
    nonUpiCsv: createNonUpiCsv(inventory, users),
  };
}

function createUpiCsv(inventory: OrganizationInventory, users: User[]): string {
  const userNameById = new Map<string, string>(
    users.map((user) => [user.id, normalizeUserDisplayName(user)])
  );
  const productById = new Map<string, Product>(
    inventory.products.map((product) => [product.id, product])
  );
  const rows: string[][] = [['productId', 'productName', 'upi', 'holderName']];

  const holderRows = [
    { holderId: WAREHOUSE_DISPLAY_NAME, items: inventory.warehouseItems },
    ...Array.from(inventory.usersItems.entries()).map(([holderId, items]) => ({
      holderId,
      items,
    })),
  ];

  const upiRows: Array<{
    productId: string;
    productName: string;
    upi: string;
    holderName: string;
  }> = [];

  for (const holderRow of holderRows) {
    for (const item of holderRow.items) {
      if (!item.upis || item.upis.length === 0) {
        continue;
      }

      const product = productById.get(item.productId);
      const holderName =
        holderRow.holderId === WAREHOUSE_DISPLAY_NAME
          ? WAREHOUSE_DISPLAY_NAME
          : userNameById.get(holderRow.holderId) || UNKNOWN_USER_DISPLAY_NAME;

      for (const upi of [...item.upis].sort((a, b) => a.localeCompare(b))) {
        upiRows.push({
          productId: item.productId,
          productName: product?.name || '',
          upi,
          holderName,
        });
      }
    }
  }

  upiRows
    .sort((a, b) =>
      a.productName.localeCompare(b.productName) ||
      a.productId.localeCompare(b.productId) ||
      a.upi.localeCompare(b.upi) ||
      a.holderName.localeCompare(b.holderName)
    )
    .forEach((row) => {
      rows.push([row.productId, row.productName, row.upi, row.holderName]);
    });

  return toCsv(rows);
}

function createNonUpiCsv(inventory: OrganizationInventory, users: User[]): string {
  const productById = new Map<string, Product>(
    inventory.products.map((product) => [product.id, product])
  );

  const bulkProductIds = new Set<string>();
  for (const item of inventory.warehouseItems) {
    if (!item.upis || item.upis.length === 0) {
      bulkProductIds.add(item.productId);
    }
  }
  for (const items of inventory.usersItems.values()) {
    for (const item of items) {
      if (!item.upis || item.upis.length === 0) {
        bulkProductIds.add(item.productId);
      }
    }
  }

  for (const product of inventory.products) {
    if (!product.hasUpi) {
      bulkProductIds.add(product.id);
    }
  }

  const sortedUsers = [...users].sort((a, b) => compareByNameThenId(a, b));
  const userDisplayNameById = buildStableUserDisplayNames(sortedUsers);
  const orderedUserIds = sortedUsers.map((user) => user.id);

  const header = [
    'productId',
    'productName',
    WAREHOUSE_DISPLAY_NAME,
    ...orderedUserIds.map((userId) => userDisplayNameById.get(userId) || userId),
  ];
  const rows: string[][] = [header];

  const warehouseQuantityByProduct = buildBulkQuantityByProduct(
    inventory.warehouseItems
  );
  const userQuantityByHolderAndProduct = new Map<string, Map<string, number>>();

  for (const [holderId, items] of inventory.usersItems.entries()) {
    userQuantityByHolderAndProduct.set(holderId, buildBulkQuantityByProduct(items));
  }

  const orderedProductIds = [...bulkProductIds].sort((a, b) => {
    const leftName = productById.get(a)?.name || '';
    const rightName = productById.get(b)?.name || '';
    return leftName.localeCompare(rightName) || a.localeCompare(b);
  });

  for (const productId of orderedProductIds) {
    const productName = productById.get(productId)?.name || '';
    const row = [
      productId,
      productName,
      String(warehouseQuantityByProduct.get(productId) || 0),
      ...orderedUserIds.map((userId) =>
        String(userQuantityByHolderAndProduct.get(userId)?.get(productId) || 0)
      ),
    ];

    rows.push(row);
  }

  return toCsv(rows);
}

function buildBulkQuantityByProduct(items: InventoryItem[]): Map<string, number> {
  const quantityByProduct = new Map<string, number>();

  for (const item of items) {
    if (item.upis && item.upis.length > 0) {
      continue;
    }

    quantityByProduct.set(
      item.productId,
      (quantityByProduct.get(item.productId) || 0) + item.quantity
    );
  }

  return quantityByProduct;
}

function buildStableUserDisplayNames(users: User[]): Map<string, string> {
  const countByName = new Map<string, number>();
  for (const user of users) {
    const baseName = normalizeUserDisplayName(user);
    countByName.set(baseName, (countByName.get(baseName) || 0) + 1);
  }

  const seenByName = new Map<string, number>();
  const displayNameById = new Map<string, string>();

  for (const user of users) {
    const baseName = normalizeUserDisplayName(user);
    const total = countByName.get(baseName) || 0;
    if (total <= 1) {
      displayNameById.set(user.id, baseName);
      continue;
    }

    const currentIndex = (seenByName.get(baseName) || 0) + 1;
    seenByName.set(baseName, currentIndex);
    displayNameById.set(user.id, `${baseName} (${currentIndex})`);
  }

  return displayNameById;
}

function normalizeUserDisplayName(user: User): string {
  return user.name.trim() || UNKNOWN_USER_DISPLAY_NAME;
}

function toCsv(rows: string[][]): string {
  return `${rows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(','))
    .join('\n')}\n`;
}

function escapeCsvValue(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function compareByNameThenId(left: User, right: User): number {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

async function uploadCsv(key: string, csvContent: string): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BACKUP_BUCKET_NAME,
      Key: key,
      Body: csvContent,
      ContentType: 'text/csv; charset=utf-8',
    })
  );
}

async function getLatestBackupCsv(
  organizationId: string
): Promise<BackupCsvPayload | undefined> {
  const latestKeys = await getLatestBackupKeys(organizationId);
  if (!latestKeys?.upiKey || !latestKeys.nonUpiKey) {
    return undefined;
  }

  const [upiCsv, nonUpiCsv] = await Promise.all([
    getObjectText(latestKeys.upiKey),
    getObjectText(latestKeys.nonUpiKey),
  ]);

  if (!upiCsv || !nonUpiCsv) {
    return undefined;
  }

  return {
    upiCsv,
    nonUpiCsv,
  };
}

async function getLatestBackupKeys(organizationId: string): Promise<
  | {
      upiKey?: string;
      nonUpiKey?: string;
    }
  | undefined
> {
  const backupByTimestamp = new Map<
    string,
    {
      upiKey?: string;
      nonUpiKey?: string;
    }
  >();

  let continuationToken: string | undefined;
  do {
    const result = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: BACKUP_BUCKET_NAME,
        Prefix: `${organizationId}/`,
        ContinuationToken: continuationToken,
      })
    );

    for (const object of result.Contents || []) {
      if (!object.Key) {
        continue;
      }

      const [orgId, timestamp, fileName] = object.Key.split('/');
      if (orgId !== organizationId || !timestamp || !fileName) {
        continue;
      }
      if (fileName !== UPI_FILE_NAME && fileName !== NON_UPI_FILE_NAME) {
        continue;
      }

      const backupEntry = backupByTimestamp.get(timestamp) || {};
      if (fileName === UPI_FILE_NAME) {
        backupEntry.upiKey = object.Key;
      } else {
        backupEntry.nonUpiKey = object.Key;
      }
      backupByTimestamp.set(timestamp, backupEntry);
    }

    continuationToken = result.NextContinuationToken;
  } while (continuationToken);

  const orderedTimestamps = [...backupByTimestamp.keys()].sort((a, b) =>
    b.localeCompare(a)
  );

  for (const timestamp of orderedTimestamps) {
    const backupEntry = backupByTimestamp.get(timestamp);
    if (backupEntry?.upiKey && backupEntry.nonUpiKey) {
      return backupEntry;
    }
  }

  return undefined;
}

async function getObjectText(key: string): Promise<string | undefined> {
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: BACKUP_BUCKET_NAME,
        Key: key,
      })
    );
    if (!response.Body) {
      return undefined;
    }

    return response.Body.transformToString();
  } catch (error) {
    console.warn(
      `[InventoryStateBackup] Failed reading S3 object ${key}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
    return undefined;
  }
}
