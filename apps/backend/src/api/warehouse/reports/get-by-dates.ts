import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import {
  GetReportsByDatesRequest,
  GetReportsByDatesResponse,
  getUserIDsOfSameSubDepartment,
  isValidDate,
  JwtPayload,
  UserRole,
} from '@equip-track/shared';
import { ReportItem, ReportsAdapter } from '../../../db/tables/reports.adapter';
import { UsersAndOrganizationsAdapter } from '../../../db';

export async function handler(
  req: GetReportsByDatesRequest,
  pathParams?: APIGatewayProxyEventPathParameters,
  jwtPayload?: JwtPayload
): Promise<GetReportsByDatesResponse> {
  const organizationId = pathParams?.organizationId;
  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  if (!req.dates || !Array.isArray(req.dates) || req.dates.length === 0) {
    throw new Error('Dates array is required and must not be empty');
  }

  const invalidDates = req.dates.filter((date) => !isValidDate(date));
  if (invalidDates.length > 0) {
    throw new Error(`Invalid dates: ${invalidDates.join(', ')}`);
  }

  const reportsAdapter = new ReportsAdapter();

  try {
    const reportsByDate: Record<string, ReportItem[]> =
      await reportsAdapter.getReportsByDates(organizationId, req.dates);

    const userRole = jwtPayload?.orgIdToRole[organizationId];
    if (userRole === UserRole.Customer && jwtPayload?.sub) {
      const allowedOwners = await getAllowedOwnersForCustomer(
        jwtPayload.sub,
        organizationId
      );
      for (const date of Object.keys(reportsByDate)) {
        reportsByDate[date] = reportsByDate[date].filter(
          (r) => !r.ownerUserId || allowedOwners.has(r.ownerUserId)
        );
      }
    }

    return {
      status: true,
      reportsByDate,
    };
  } catch (error) {
    console.error('Error getting reports by dates:', error);
    throw new Error('Failed to get reports by dates');
  }
}

async function getAllowedOwnersForCustomer(
  userId: string,
  organizationId: string
): Promise<Set<string>> {
  const usersAdapter = new UsersAndOrganizationsAdapter();
  const users = await usersAdapter.getUsersByOrganization(organizationId);

  const currentUser = users.find((u) => u.user.id === userId);
  if (!currentUser) {
    return new Set([userId]);
  }

  const departmentUserIds = getUserIDsOfSameSubDepartment(users, currentUser);
  const allowed = new Set(departmentUserIds);
  allowed.add(userId);
  return allowed;
}
