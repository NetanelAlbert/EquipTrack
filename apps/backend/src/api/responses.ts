export function unauthorized() {
  return {
    statusCode: 401,
    body: JSON.stringify({ error: 'Unauthorized' }),
  };
}

export function badRequest(message = 'Invalid input') {
  return {
    statusCode: 400,
    body: JSON.stringify({ error: message }),
  };
}

export function ok(body: any) {
  return {
    statusCode: 200,
    body: JSON.stringify(body),
  };
}
