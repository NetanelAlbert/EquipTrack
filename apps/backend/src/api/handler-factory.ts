import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { Context } from 'aws-lambda/handler';
import { endpointMetas, EndpointMeta } from '@equip-track/shared';
import { HandlerFunction, handlers } from './handlers';
import { unauthorized } from './responses';
import { authenticate } from './auth';

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
      const authenticated = await authenticate(meta, event);
      if (!authenticated) {
        throw unauthorized('Unauthorized');
      }

      const req =
        meta.method === 'GET' ? (undefined as any) : parseBody<Req>(event);

      const result = await handler(req, event.pathParameters);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
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
        headers: CORS_HEADERS,
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
