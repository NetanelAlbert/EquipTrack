/**
 * Dev deploy (STAGE !== production): echo http://localhost:4200 when the browser
 * sends that Origin so CORS stays valid alongside API Gateway / strict clients.
 * Production and other origins continue to use '*'.
 */
const STAGE = process.env.STAGE || 'dev';
const IS_PRODUCTION = STAGE === 'production';

const LOCAL_ANGULAR_DEV_ORIGIN = 'http://localhost:4200';

const CORS_ALLOW_HEADERS =
  'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Accept,Origin,X-Requested-With';

function normalizeOriginForCompare(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

export function getRequestOrigin(
  headers: Record<string, string | undefined> | null | undefined
): string | undefined {
  if (!headers) return undefined;
  const raw = headers['Origin'] ?? headers['origin'];
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  return raw;
}

export function resolveAccessControlAllowOrigin(
  requestOrigin: string | undefined
): string {
  if (IS_PRODUCTION || !requestOrigin) {
    return '*';
  }
  if (normalizeOriginForCompare(requestOrigin) === LOCAL_ANGULAR_DEV_ORIGIN) {
    return LOCAL_ANGULAR_DEV_ORIGIN;
  }
  return '*';
}

export function buildCorsHeaders(
  requestOrigin: string | undefined
): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolveAccessControlAllowOrigin(requestOrigin),
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Credentials': 'false',
    'Content-Type': 'application/json',
  };
}
