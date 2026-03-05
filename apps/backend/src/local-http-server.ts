import { IncomingMessage, ServerResponse, createServer } from 'http';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
} from 'aws-lambda';
import { endpointMetas } from '@equip-track/shared';
import { lambdaHandlers } from './api/handler-factory';
import { CORS_HEADERS } from './api/responses';

interface CompiledRoute {
  endpointKey: keyof typeof endpointMetas;
  method: string;
  pathTemplate: string;
  regex: RegExp;
  pathParamNames: string[];
}

function compilePathTemplate(pathTemplate: string): {
  regex: RegExp;
  pathParamNames: string[];
} {
  const pathParamNames: string[] = [];
  const escapedPath = pathTemplate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = escapedPath.replace(/\\\{([a-zA-Z0-9_]+)\\\}/g, (_, name) => {
    pathParamNames.push(name);
    return '([^/]+)';
  });

  return {
    regex: new RegExp(`^${pattern}$`),
    pathParamNames,
  };
}

function buildRoutes(): CompiledRoute[] {
  return Object.entries(endpointMetas).map(([endpointKey, meta]) => {
    const compiledPath = compilePathTemplate(meta.path);
    return {
      endpointKey: endpointKey as keyof typeof endpointMetas,
      method: meta.method.toUpperCase(),
      pathTemplate: meta.path,
      ...compiledPath,
    };
  });
}

const compiledRoutes = buildRoutes();

function findRoute(method: string, pathname: string): {
  route: CompiledRoute;
  pathParameters: Record<string, string>;
} | null {
  for (const route of compiledRoutes) {
    if (route.method !== method.toUpperCase()) {
      continue;
    }

    const match = pathname.match(route.regex);
    if (!match) {
      continue;
    }

    const pathParameters: Record<string, string> = {};
    route.pathParamNames.forEach((name, index) => {
      const value = match[index + 1];
      pathParameters[name] = decodeURIComponent(value);
    });

    return { route, pathParameters };
  }

  return null;
}

async function readRequestBody(req: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return null;
  }

  return Buffer.concat(chunks).toString('utf-8');
}

function normalizeHeaders(
  headers: IncomingMessage['headers']
): Record<string, string> {
  const normalizedHeaders: Record<string, string> = {};

  Object.entries(headers).forEach(([key, value]) => {
    if (typeof value === 'undefined') {
      return;
    }

    normalizedHeaders[key] = Array.isArray(value) ? value.join(',') : value;
  });

  return normalizedHeaders;
}

function createApiGatewayEvent(
  req: IncomingMessage,
  pathname: string,
  body: string | null,
  pathParameters: Record<string, string>
): APIGatewayProxyEvent {
  return {
    body,
    headers: normalizeHeaders(req.headers),
    httpMethod: req.method || 'GET',
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    path: pathname,
    pathParameters,
    queryStringParameters: null,
    requestContext: {
      accountId: 'local',
      apiId: 'local',
      authorizer: undefined,
      protocol: 'HTTP/1.1',
      httpMethod: req.method || 'GET',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: req.headers['user-agent'] || 'local-http-server',
        userArn: null,
      },
      path: pathname,
      requestId: 'local-request',
      requestTimeEpoch: Date.now(),
      resourceId: 'local-resource',
      resourcePath: pathname,
      stage: 'local',
    },
    resource: pathname,
    stageVariables: null,
  };
}

function sendJsonResponse(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {}
): void {
  res.writeHead(statusCode, {
    ...CORS_HEADERS,
    ...headers,
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function invokeLambdaHandler(
  handler: APIGatewayProxyHandler,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  return await new Promise<APIGatewayProxyResult>((resolve, reject) => {
    const callback = (
      error?: Error | string | null,
      result?: APIGatewayProxyResult
    ) => {
      if (error) {
        reject(error);
        return;
      }

      if (!result) {
        reject(new Error('Lambda handler returned no response'));
        return;
      }

      resolve(result);
    };

    Promise.resolve(handler(event, {} as never, callback))
      .then((result) => {
        if (result) {
          resolve(result);
        }
      })
      .catch(reject);
  });
}

export async function startLocalHttpServer(): Promise<void> {
  const port = Number(process.env.BACKEND_PORT || 3000);

  const server = createServer(async (req, res) => {
    const method = (req.method || 'GET').toUpperCase();
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (method === 'OPTIONS') {
      sendJsonResponse(res, 200, '');
      return;
    }

    if (method === 'GET' && pathname === '/health') {
      sendJsonResponse(res, 200, { status: 'ok' });
      return;
    }

    const match = findRoute(method, pathname);
    if (!match) {
      sendJsonResponse(res, 404, {
        status: false,
        error: 'Not Found',
        path: pathname,
        method,
      });
      return;
    }

    try {
      const handler = lambdaHandlers[match.route.endpointKey] as APIGatewayProxyHandler;
      const body = await readRequestBody(req);
      const event = createApiGatewayEvent(req, pathname, body, match.pathParameters);
      const result = await invokeLambdaHandler(handler, event);

      res.writeHead(result.statusCode, {
        ...CORS_HEADERS,
        ...(result.headers || {}),
      });
      res.end(result.body || '');
    } catch (error) {
      console.error('[local-http-server] request failed:', error);
      sendJsonResponse(res, 500, {
        status: false,
        error: 'Internal server error',
      });
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      console.log(`[local-http-server] listening on http://localhost:${port}`);
      resolve();
    });
  });
}
