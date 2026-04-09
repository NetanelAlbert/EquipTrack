import { createLambdaHandler } from './handler-factory';
import { EndpointMeta } from '@equip-track/shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

jest.mock('./auth', () => ({
  authenticateAndGetJwt: jest.fn().mockResolvedValue({
    sub: 'user-1',
    orgIdToRole: { 'org-1': 'admin' },
    iat: 1,
    exp: 2,
  }),
}));

function buildEvent(
  overrides: Partial<APIGatewayProxyEvent> = {}
): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/test',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '/test',
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      authorizer: undefined,
      protocol: 'HTTP/1.1',
      httpMethod: 'POST',
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
        userAgent: 'jest',
        userArn: null,
      },
      path: '/test',
      requestId: 'request-id',
      requestTimeEpoch: 0,
      resourceId: 'resource-id',
      resourcePath: '/test',
      stage: 'dev',
    },
    ...overrides,
  } as APIGatewayProxyEvent;
}

describe('handler-factory', () => {
  const publicMeta: EndpointMeta<{ data: string }, { status: boolean }> = {
    path: '/test',
    method: 'POST',
    allowedRoles: [],
    requestType: {} as { data: string },
    responseType: {} as { status: boolean },
  };

  it('returns 400 for malformed JSON body', async () => {
    const mockHandler = jest.fn();
    const lambdaHandler = createLambdaHandler(publicMeta, mockHandler);

    const event = buildEvent({ body: '{invalid json' });
    const result = (await lambdaHandler(
      event,
      {} as never,
      jest.fn()
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.status).toBe(false);
    expect(body.errorMessage).toContain('Invalid JSON');
  });

  it('passes parsed body to handler for valid JSON', async () => {
    const mockHandler = jest.fn().mockResolvedValue({ status: true });
    const lambdaHandler = createLambdaHandler(publicMeta, mockHandler);

    const event = buildEvent({ body: '{"data":"test"}' });
    const result = (await lambdaHandler(
      event,
      {} as never,
      jest.fn()
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(200);
    expect(mockHandler).toHaveBeenCalledWith(
      { data: 'test' },
      null,
      undefined,
      expect.anything()
    );
  });

  it('passes undefined body for GET requests', async () => {
    const getMeta = { ...publicMeta, method: 'GET' as const };
    const mockHandler = jest.fn().mockResolvedValue({ status: true });
    const lambdaHandler = createLambdaHandler(getMeta, mockHandler);

    const event = buildEvent({ httpMethod: 'GET' });
    const result = (await lambdaHandler(
      event,
      {} as never,
      jest.fn()
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(200);
    expect(mockHandler).toHaveBeenCalledWith(
      undefined,
      null,
      undefined,
      expect.anything()
    );
  });

  it('preserves ErrorResponse status codes from handlers', async () => {
    const mockHandler = jest.fn().mockRejectedValue({
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: false, error: 'Forbidden' }),
    });
    const lambdaHandler = createLambdaHandler(publicMeta, mockHandler);

    const event = buildEvent({ body: '{}' });
    const result = (await lambdaHandler(
      event,
      {} as never,
      jest.fn()
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(403);
  });

  it('returns 500 for non-ErrorResponse errors', async () => {
    const mockHandler = jest
      .fn()
      .mockRejectedValue(new Error('Unexpected error'));
    const lambdaHandler = createLambdaHandler(publicMeta, mockHandler);

    const event = buildEvent({ body: '{}' });
    const result = (await lambdaHandler(
      event,
      {} as never,
      jest.fn()
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(500);
  });
});
