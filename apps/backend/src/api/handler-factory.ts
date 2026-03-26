import {
  APIGatewayProxyEvent,
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
} from 'aws-lambda';
import {
  endpointMetas,
  EndpointMeta,
  JwtPayload,
  OptionalObject,
} from '@equip-track/shared';
import { HandlerFunction, handlers } from './handlers';
import { buildCorsHeaders, getRequestOrigin } from './cors';
import {
  ErrorResponse,
  unauthorized,
  internalServerError,
} from './responses';
import { authenticateAndGetJwt } from './auth';

function parseBody<T>(event: APIGatewayProxyEvent): T | undefined {
  if (!event.body) {
    return undefined;
  }
  return (
    typeof event.body === 'string' ? JSON.parse(event.body) : event.body
  ) as T;
}

export function createLambdaHandler<
  Req extends OptionalObject,
  Res extends OptionalObject
>(
  meta: EndpointMeta<Req, Res>,
  handler: HandlerFunction<Req, Res>
): APIGatewayProxyHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const corsHeaders = buildCorsHeaders(getRequestOrigin(event.headers));
    try {
      console.log(`[${meta.path}] Processing request`, {
        method: meta.method,
        requiresAuth: (meta.allowedRoles?.length || 0) > 0,
        allowedRoles: meta.allowedRoles || [],
        pathParameters: event.pathParameters,
        hasAuthHeader: !!(
          event.headers?.['Authorization'] || event.headers?.['authorization']
        ),
        user: event.requestContext.authorizer?.jwtPayload,
        body: event.body,
      });

      const req: Req | undefined =
        meta.method === 'GET' ? undefined : parseBody<Req>(event);

      let jwtPayload: JwtPayload | undefined;
      // Only authenticate if the endpoint requires roles (has allowedRoles)
      if ((meta.allowedRoles?.length || 0) > 0) {
        console.log(`[${meta.path}] Authentication required, validating...`);
        jwtPayload = await authenticateAndGetJwt<Req>(meta, event, req);
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
      const result = await handler(req, event.pathParameters, jwtPayload, event);
      console.log(`[${meta.path}] Handler completed successfully`);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result),
      };
    } catch (error) {
      console.error(`[${meta.path}] Error occurred:`, error);

      // If the error is an ErrorResponse, ensure it has CORS headers
      if (error && typeof error === 'object' && 'statusCode' in error) {
        console.log(`[${meta.path}] Returning error response:`, error);
        const errorResponse = error as ErrorResponse;
        return {
          statusCode: errorResponse.statusCode,
          headers: {
            ...errorResponse.headers,
            ...corsHeaders,
          },
          body: errorResponse.body,
        };
      }

      console.log(`[${meta.path}] Creating generic error response for:`, error);
      const err = internalServerError(error?.message || 'Internal server error');
      return {
        ...err,
        headers: { ...err.headers, ...corsHeaders },
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
