import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import {
  ItemReport,
  JwtPayload,
  PublishPartialReportRequest,
  PublishPartialReportResponse,
  formatJerusalemDBDate,
  itemReportCompositeKey,
} from '@equip-track/shared';
import { ReportsAdapter } from '../../../db/tables/reports.adapter';
import { InventoryAdapter } from '../../../db/tables/inventory.adapter';
import { UsersAndOrganizationsAdapter } from '../../../db/tables/users-and-organizations.adapter';
import { buildOwnerAndDepartmentFields } from './report-item-metadata';

export async function handler(
  req: PublishPartialReportRequest,
  pathParams?: APIGatewayProxyEventPathParameters,
  jwtPayload?: JwtPayload
): Promise<PublishPartialReportResponse> {
  const organizationId = pathParams?.organizationId;
  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  if (!req.items || !Array.isArray(req.items) || req.items.length === 0) {
    throw new Error('Items array is required and must not be empty');
  }

  // Validate items
  for (const item of req.items) {
    if (!item.productId || !item.upi || !item.location) {
      throw new Error(
        'All item fields (productId, upi, location) are required'
      );
    }
  }

  if (!jwtPayload) {
    throw new Error('JWT payload is required');
  }

  const userId = jwtPayload.sub;
  const date = formatJerusalemDBDate(new Date());
  const reportTimestamp = new Date().toISOString();

  const inventoryAdapter = new InventoryAdapter();
  const usersAdapter = new UsersAndOrganizationsAdapter();
  const holderByKey = await inventoryAdapter.getHolderIdByProductUpi(
    organizationId
  );

  const items: ItemReport[] = await Promise.all(
    req.items.map(async (item) => {
      const holderId = holderByKey.get(
        itemReportCompositeKey(item.productId, item.upi)
      );
      const meta = await buildOwnerAndDepartmentFields(
        holderId,
        organizationId,
        (uid, oid) => usersAdapter.getUserInOrganization(uid, oid)
      );

      return {
        ...item,
        reportedBy: userId,
        reportDate: date,
        reportTimestamp,
        ...meta,
      };
    })
  );

  const reportsAdapter = new ReportsAdapter();

  try {
    await reportsAdapter.publishPartialReport(organizationId, date, items);

    return {
      status: true,
      items,
    };
  } catch (error) {
    console.error('Error publishing partial report:', error);
    throw new Error('Failed to publish partial report');
  }
}
