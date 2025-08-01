import { ErrorKeys } from '@equip-track/shared';

export interface ErrorResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

// CORS headers for all responses
export const CORS_HEADERS = {
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
  errorMessage = 'Server error',
  errorKey?: ErrorKeys
): ErrorResponse {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      status: false,
      error,
      errorMessage,
      errorKey: errorKey || ErrorKeys.GENERAL_ERROR,
    }),
  };
}

export function resourceNotFound(
  errorMessage = 'Resource not found'
): ErrorResponse {
  return error('Resource not found', 200, errorMessage, ErrorKeys.NOT_FOUND);
}

export function unauthorized(errorMessage = 'Unauthorized'): ErrorResponse {
  return error('Unauthorized', 401, errorMessage, ErrorKeys.UNAUTHORIZED);
}

export function badRequest(errorMessage = 'Invalid input'): ErrorResponse {
  return error('Bad request', 400, errorMessage, ErrorKeys.BAD_REQUEST);
}

export function forbidden(errorMessage = 'Forbidden'): ErrorResponse {
  return error('Forbidden', 403, errorMessage, ErrorKeys.FORBIDDEN);
}

export function emailVerificationRequired(
  errorMessage = 'Email verification required'
): ErrorResponse {
  return error(
    'Email verification required',
    422,
    errorMessage,
    ErrorKeys.EMAIL_VERIFICATION_REQUIRED
  );
}

export function notImplemented(
  errorMessage = 'Not implemented'
): ErrorResponse {
  return error('Not implemented', 501, errorMessage, ErrorKeys.NOT_IMPLEMENTED);
}

export function internalServerError(
  errorMessage = 'Internal server error'
): ErrorResponse {
  return error(
    'Internal server error',
    500,
    errorMessage,
    ErrorKeys.INTERNAL_SERVER_ERROR
  );
}

/**
 * Create a custom error response with a specific ErrorKey
 */
export function customError(
  errorKey: ErrorKeys,
  statusCode: number,
  error: string,
  errorMessage?: string
): ErrorResponse {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      status: false,
      error,
      errorMessage: errorMessage || error,
      errorKey,
    }),
  };
}

export const organizationIdRequired = customError(
  ErrorKeys.ORGANIZATION_ID_REQUIRED,
  400,
  'Organization ID is required'
)

export const formIdRequired = customError(
  ErrorKeys.FORM_ID_REQUIRED,
  400,
  'Form ID is required'
)

export const userIdRequired = customError(
  ErrorKeys.USER_ID_REQUIRED,
  400,
  'User ID is required'
)

export const jwtPayloadRequired = customError(
  ErrorKeys.JWT_PAYLOAD_REQUIRED,
  400,
  'JWT payload is required'
)