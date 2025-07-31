import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { Context } from 'aws-lambda/handler';
import { endpointMetas, EndpointMeta, JwtPayload } from '@equip-track/shared';
import { HandlerFunction, handlers } from './handlers';
import { unauthorized, internalServerError, CORS_HEADERS } from './responses';
import { authenticateAndGetJwt } from './auth';

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

      const req =
        meta.method === 'GET' ? (undefined as any) : parseBody<Req>(event);

      let jwtPayload: JwtPayload | undefined;
      // Only authenticate if the endpoint requires roles (has allowedRoles)
      if ((meta.allowedRoles?.length || 0) > 0) {
        console.log(`[${meta.path}] Authentication required, validating...`);
        jwtPayload = await authenticateAndGetJwt(meta, event, req);
        if (!jwtPayload) {
          throw unauthorized('Unauthorized');
        }
        console.log(`[${meta.path}] Authentication successful`);
      } else {
        console.log(
          `[${meta.path}] No authentication required (public endpoint)`
        );
      }

      console.log(`[${meta.path}] Calling handler...`);
      const result = await handler(req, event.pathParameters, jwtPayload);
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
      return internalServerError(error?.message || 'Internal server error');
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
