import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { Context } from 'aws-lambda/handler';
import {
  endpointMetas,
  EndpointMeta,
  ORGANIZATION_ID_PATH_PARAM,
} from '@equip-track/shared';
import { HandlerFunction, handlers } from './handlers';
import {
  MainAdapter,
  UserAndAllOrganizations,
} from '../db';
import { badRequest, forbidden, unauthorized } from './responses';

const mainAdapter = new MainAdapter();

async function parseUser(event: unknown): Promise<UserAndAllOrganizations> {
  // TODO: Replace with real authentication
  const userId = 'dummy';
  try {
    return await mainAdapter.getUserAndAllOrganizations(userId);
  } catch (error) {
    console.error('Error parsing user', error);
    throw unauthorized('User not found');
  }
}

function parseBody<T>(event: any): T {
  if (!event.body) return undefined as any;
  return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
}

export function createLambdaHandler<Req, Res>(
  meta: EndpointMeta<Req, Res>,
  handler: HandlerFunction<Req, Res>
): APIGatewayProxyHandler {
  return async (event: APIGatewayProxyEvent, _context: Context) => {
    try {
      const { user, userInOrganizations } = await parseUser(event);

      let organizationId: string | undefined;
      if (meta.path.includes(`{${ORGANIZATION_ID_PATH_PARAM}}`)) {
        organizationId = event.pathParameters?.[ORGANIZATION_ID_PATH_PARAM];
        if (!organizationId) {
          throw badRequest('Organization ID is required');
        }
        const organization = userInOrganizations.find(
          (org) => org.organizationId === organizationId
        );
        if (!organization) {
          throw forbidden('User is not a member of the organization');
        }

        // Note: We assume that the user has only one organization since we just filter the user by the organizationId
        if (!meta.allowedRoles.includes(organization.role)) {
          throw forbidden(
            `User Role ${organization.role} is not allowed to access this endpoint`
          );
        }
      }

      const req =
        meta.method === 'GET' ? (undefined as any) : parseBody<Req>(event);

      const result = await handler(user, organizationId, req);
      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    } catch (error) {
      // If the error is an ErrorResponse, return it
      if ('statusCode' in error) {
        return error;
      }
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
