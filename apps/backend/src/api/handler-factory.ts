import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { Context } from 'aws-lambda/handler';
import { endpointMetas, EndpointMeta } from '@equip-track/shared';
import { HandlerFunction, handlers } from './handlers';
import { unauthorized } from './responses';
import { authenticateAndGetUserId } from './auth';

// CORS headers for all responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Accept,Origin,X-Requested-With',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Credentials': 'false',
  'Content-Type': 'application/json',
};

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
      console.log(`[${meta.path}] Processing request`, {
        method: meta.method,
        requiresAuth: (meta.allowedRoles?.length || 0) > 0,
        allowedRoles: meta.allowedRoles || [],
        pathParameters: event.pathParameters,
        hasAuthHeader: !!(
          event.headers?.['Authorization'] || event.headers?.['authorization']
        ),
      });

      let userId: string | undefined;
      // Only authenticate if the endpoint requires roles (has allowedRoles)
      if ((meta.allowedRoles?.length || 0) > 0) {
        console.log(`[${meta.path}] Authentication required, validating...`);
        userId = await authenticateAndGetUserId(meta, event);
        if (!userId) {
          throw unauthorized('Unauthorized');
        }
        console.log(`[${meta.path}] Authentication successful`);
      } else {
        console.log(
          `[${meta.path}] No authentication required (public endpoint)`
        );
      }

      const req =
        meta.method === 'GET' ? (undefined as any) : parseBody<Req>(event);

      console.log(`[${meta.path}] Calling handler...`);
      const result = await handler(req, event.pathParameters, userId);
      console.log(`[${meta.path}] Handler completed successfully`);

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(result),
      };
    } catch (error) {
      console.error(`[${meta.path}] Error occurred:`, error);

      // If the error is an ErrorResponse, return it
      if (error && typeof error === 'object' && 'statusCode' in error) {
        console.log(`[${meta.path}] Returning error response:`, error);
        return error;
      }

      console.log(`[${meta.path}] Creating generic error response for:`, error);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          status: false,
          error: error?.message || 'Internal server error',
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
