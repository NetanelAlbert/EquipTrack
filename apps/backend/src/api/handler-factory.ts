import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { Context } from 'aws-lambda/handler';
import {
  endpointMetas,
  EndpointMeta,
  UserRole,
  User,
  UserState,
  ORGANIZATION_ID_PATH_PARAM,
  ActiveUser,
} from '@equip-track/shared';
import { handlers } from './handlers';

function parseUser(event: unknown): User | null {
  // TODO: Replace with real authentication
  return {
    id: 'dummy',
    name: 'dummy',
    email: 'dummy',
    phone: 'dummy',
    department: 'dummy',
    departmentRole: 'dummy',
    organizations: [
      {
        organizationID: 'dummy',
        role: UserRole.Admin,
      },
    ],
    state: UserState.Active,
  };
}

function parseBody<T>(event: any): T {
  if (!event.body) return undefined as any;
  return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
}

export function createLambdaHandler<Req, Res>(
  meta: EndpointMeta<Req, Res>,
  handler: (user: User, req: Req) => Promise<Res>
): APIGatewayProxyHandler {
  return async (event: APIGatewayProxyEvent, _context: Context) => {
    const user = parseUser(event);
    if (!user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ status: false, error: 'Unauthorized' }),
      };
    }

    let activeUser: ActiveUser;

    if (meta.path.includes(`{${ORGANIZATION_ID_PATH_PARAM}}`)) {
      const organizationId = event.pathParameters?.[ORGANIZATION_ID_PATH_PARAM];
      if (!organizationId) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            status: false,
            error: 'Organization ID is required',
          }),
        };
      }
      const organization = user.organizations.find(
        (org) => org.organizationID === organizationId
      );
      if (!organization) {
        return {
          statusCode: 403,
          body: JSON.stringify({
            status: false,
            error: 'Forbidden',
            message: 'User is not a member of the organization',
          }),
        };
      }

      // Note: We assume that the user has only one organization since we just filter the user by the organizationId
      if (!meta.allowedRoles.includes(organization.role)) {
        return {
          statusCode: 403,
          body: JSON.stringify({ status: false, error: 'Forbidden' }),
        };
      }
      activeUser = {
        ...user,
        organizationID: organization.organizationID,
      };
    }

    const req =
      meta.method === 'GET' ? (undefined as any) : parseBody<Req>(event);
    try {
      const result = await handler(activeUser ?? user, req);
      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    } catch (error) {
      // TODO: Log error to cloudwatch
      return {
        statusCode: 500,
        body: JSON.stringify({
          status: false,
          error: error.message || 'Internal server error',
        }),
      };
    }
  };
}

// Export all lambda handlers
export const lambdaHandlers = Object.fromEntries(
  Object.entries(endpointMetas).map(([key, meta]) => [
    key,
    createLambdaHandler<typeof meta.requestType, typeof meta.responseType>(
      meta,
      handlers[key]
    ),
  ])
) as Record<keyof typeof endpointMetas, APIGatewayProxyHandler>;
