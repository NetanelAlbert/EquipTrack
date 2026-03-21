import { APIGatewayProxyEvent } from 'aws-lambda';
import { UserRole } from '@equip-track/shared';
import { handler } from './e2e-login';

const mockGenerateToken = jest.fn();

jest.mock('../../services/jwt.service', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    generateToken: mockGenerateToken,
  })),
}));

function buildEvent(headers: Record<string, string> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers,
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/api/auth/e2e-login',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '/api/auth/e2e-login',
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
      path: '/api/auth/e2e-login',
      requestId: 'request-id',
      requestTimeEpoch: 0,
      resourceId: 'resource-id',
      resourcePath: '/api/auth/e2e-login',
      stage: 'dev',
    },
  } as APIGatewayProxyEvent;
}

describe('e2e-login handler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects when E2E auth is disabled', async () => {
    process.env.E2E_AUTH_ENABLED = 'false';
    process.env.E2E_AUTH_SECRET = 'secret';

    await expect(
      handler(
        { userId: 'user-1', orgIdToRole: { 'org-1': UserRole.Admin } },
        {},
        undefined,
        buildEvent({ 'x-e2e-secret': 'secret' })
      )
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects when secret header is missing or invalid', async () => {
    process.env.E2E_AUTH_ENABLED = 'true';
    process.env.E2E_AUTH_SECRET = 'expected-secret';

    await expect(
      handler(
        { userId: 'user-1', orgIdToRole: { 'org-1': UserRole.Admin } },
        {},
        undefined,
        buildEvent()
      )
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects invalid roles in orgIdToRole', async () => {
    process.env.E2E_AUTH_ENABLED = 'true';
    process.env.E2E_AUTH_SECRET = 'expected-secret';

    await expect(
      handler(
        {
          userId: 'user-1',
          orgIdToRole: { 'org-1': 'not-a-valid-role' as UserRole },
        },
        {},
        undefined,
        buildEvent({ 'x-e2e-secret': 'expected-secret' })
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns jwt when request is valid', async () => {
    process.env.E2E_AUTH_ENABLED = 'true';
    process.env.E2E_AUTH_SECRET = 'expected-secret';
    mockGenerateToken.mockResolvedValueOnce('mock-jwt-token');

    const response = await handler(
      {
        userId: 'user-1',
        orgIdToRole: { 'org-1': UserRole.Admin, 'org-2': UserRole.Customer },
      },
      {},
      undefined,
      buildEvent({ 'x-e2e-secret': 'expected-secret' })
    );

    expect(mockGenerateToken).toHaveBeenCalledWith('user-1', {
      'org-1': UserRole.Admin,
      'org-2': UserRole.Customer,
    });
    expect(response).toEqual({
      status: true,
      jwt: 'mock-jwt-token',
    });
  });
});
