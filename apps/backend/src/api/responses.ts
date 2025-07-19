export interface ErrorResponse {
  statusCode: number;
  body: string;
}

export function error(
  error: string,
  statusCode = 500,
  errorMessage = 'Server error'
): ErrorResponse {
  return {
    statusCode,
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

export function notImplemented(
  errorMessage = 'Not implemented'
): ErrorResponse {
  return error('Not implemented', 501, errorMessage);
}

export function ok(body: any) {
  return {
    statusCode: 200,
    body: JSON.stringify(body),
  };
}
