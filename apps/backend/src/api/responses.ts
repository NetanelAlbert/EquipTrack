export interface ErrorResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

// CORS headers for all responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Accept,Origin,X-Requested-With',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Credentials': 'false',
  'Content-Type': 'application/json',
};



export function ok(body: unknown) {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export function error(
  error: string,
  statusCode = 500,
  errorMessage = 'Server error'
): ErrorResponse {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ status: false, error, errorMessage }),
  };
}

export function resourceNotFound(
  errorMessage = 'Resource not found'
): ErrorResponse {
  return error('Resource not found', 200, errorMessage);
}

export function unauthorized(errorMessage = 'Unauthorized'): ErrorResponse {
  return error('Unauthorized', 401, errorMessage);
}

export function badRequest(errorMessage = 'Invalid input'): ErrorResponse {
  return error('Bad request', 400, errorMessage);
}

export function forbidden(errorMessage = 'Forbidden'): ErrorResponse {
  return error('Forbidden', 403, errorMessage);
}

export function emailVerificationRequired(
  errorMessage = 'Email verification required'
): ErrorResponse {
  return error('Email verification required', 422, errorMessage);
}

export function notImplemented(
  errorMessage = 'Not implemented'
): ErrorResponse {
  return error('Not implemented', 501, errorMessage);
}

export function internalServerError(
  errorMessage = 'Internal server error'
): ErrorResponse {
  return error('Internal server error', 500, errorMessage);
}
