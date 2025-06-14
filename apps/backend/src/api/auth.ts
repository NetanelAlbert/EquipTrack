export function authenticate(event: any) {
  // Dummy authenticator: always returns a fixed user
  return { userID: 'dummy', role: 'admin' };
}
