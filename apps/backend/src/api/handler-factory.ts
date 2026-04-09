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
import {
  ErrorResponse,
  unauthorized,
  internalServerError,
  badRequest,
  isErrorResponse,
  CORS_HEADERS,
} from './responses';
import { authenticateAndGetJwt } from './auth';

function parseBody<T>(event: APIGatewayProxyEvent): T | undefined {
  if (!event.body) {
    return undefined;
  }
  if (typeof event.body !== 'string') {
    return event.body as T;
  }
  try {
    return JSON.parse(event.body) as T;
  } catch {
    throw badRequest('Invalid JSON in request body');
  }
}

export function createLambdaHandler<
  Req extends OptionalObject,
  Res extends OptionalObject
>(
  meta: EndpointMeta<Req, Res>,
  handler: HandlerFunction<Req, Res>
): APIGatewayProxyHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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
        headers: CORS_HEADERS,
        body: JSON.stringify(result),
      };
    } catch (error) {
      console.error(`[${meta.path}] Error occurred:`, error);

      if (isErrorResponse(error)) {
        console.log(`[${meta.path}] Returning error response:`, error);
        const errorResponse = error as ErrorResponse;
        return {
          statusCode: errorResponse.statusCode,
          headers: {
            ...CORS_HEADERS,
            ...errorResponse.headers,
          },
          body: errorResponse.body,
        };
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
