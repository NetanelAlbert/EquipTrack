import { APIGatewayProxyHandler } from 'aws-lambda';
import { endpointMetas, EndpointMeta, UserRole, User, UserState } from '@equip-track/shared';
import { handlers } from './handlers';

function parseUser(event: unknown): User | null {
  // TODO: Replace with real authentication
  return { id: 'dummy', name: 'dummy', email: 'dummy', phone: 'dummy', department: 'dummy', departmentRole: 'dummy', organizations: [], state: UserState.Active };
}

function parseBody<T>(event: any): T {
  if (!event.body) return undefined as any;
  return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
}

export function createLambdaHandler<Req, Res>(
  meta: EndpointMeta<Req, Res>,
  handler: (req: Req, user: User) => Promise<Res>
): APIGatewayProxyHandler {
  return async (event, _context) => {
    const user = parseUser(event);
    if (!user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ status: false, error: 'Unauthorized' }),
      };
    }
    // TODO: Check rellevant organization by request
    if (!meta.allowedRoles.includes(user.organizations[0].role)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ status: false, error: 'Forbidden' }),
      };
    }
    const req =
      meta.method === 'GET' ? (undefined as any) : parseBody<Req>(event);
    try {
      const result = await handler(req, user);
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
    createLambdaHandler(meta as any, handlers[key]),
  ])
) as Record<keyof typeof endpointMetas, APIGatewayProxyHandler>;
