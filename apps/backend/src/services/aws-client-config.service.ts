import { DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { S3ClientConfig } from '@aws-sdk/client-s3';
import { SecretsManagerClientConfig } from '@aws-sdk/client-secrets-manager';

function getAwsRegion(): string {
  return process.env.AWS_REGION || 'us-east-1';
}

function resolveEndpoint(envKeys: string[]): string | undefined {
  for (const key of envKeys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

function isLocalEndpoint(endpoint: string | undefined): boolean {
  if (!endpoint) {
    return false;
  }

  try {
    const hostname = new URL(endpoint).hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.includes('localstack') ||
      hostname.endsWith('.local')
    );
  } catch {
    const normalizedEndpoint = endpoint.toLowerCase();
    return (
      normalizedEndpoint.includes('localhost') ||
      normalizedEndpoint.includes('127.0.0.1') ||
      normalizedEndpoint.includes('localstack')
    );
  }
}

function getLocalCredentials() {
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  };
}

export function getDynamoDbClientConfig(): DynamoDBClientConfig {
  const endpoint = resolveEndpoint(['AWS_ENDPOINT_URL_DYNAMODB', 'AWS_ENDPOINT_URL']);
  const useLocalCredentials = isLocalEndpoint(endpoint);

  return {
    region: getAwsRegion(),
    ...(endpoint ? { endpoint } : {}),
    ...(useLocalCredentials ? { credentials: getLocalCredentials() } : {}),
  };
}

export function getS3ClientConfig(): S3ClientConfig {
  const endpoint = resolveEndpoint(['AWS_ENDPOINT_URL_S3', 'AWS_ENDPOINT_URL']);
  const useLocalCredentials = isLocalEndpoint(endpoint);

  return {
    region: getAwsRegion(),
    ...(endpoint ? { endpoint } : {}),
    ...(useLocalCredentials
      ? {
          credentials: getLocalCredentials(),
          forcePathStyle: true,
        }
      : {}),
  };
}

export function getSecretsManagerClientConfig(): SecretsManagerClientConfig {
  const endpoint = resolveEndpoint([
    'AWS_ENDPOINT_URL_SECRETSMANAGER',
    'AWS_ENDPOINT_URL_SECRETS_MANAGER',
    'AWS_ENDPOINT_URL',
  ]);
  const useLocalCredentials = isLocalEndpoint(endpoint);

  return {
    region: getAwsRegion(),
    ...(endpoint ? { endpoint } : {}),
    ...(useLocalCredentials ? { credentials: getLocalCredentials() } : {}),
  };
}
