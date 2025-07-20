import { environment } from './environment';

describe('Environment Configuration', () => {
  it('should have required properties for Google OAuth', () => {
    expect(environment).toBeDefined();
    expect(environment.production).toBeDefined();
    expect(environment.apiUrl).toBeDefined();
    expect(environment.googleClientId).toBeDefined();
  });

  it('should be development environment', () => {
    expect(environment.production).toBe(false);
  });

  it('should have localhost API URL for development', () => {
    expect(environment.apiUrl).toBe('http://localhost:3000');
  });

  it('should have Google Client ID placeholder', () => {
    expect(environment.googleClientId).toBe('YOUR_GOOGLE_CLIENT_ID_HERE');
  });

  it('should warn if Google Client ID is not configured', () => {
    if (environment.googleClientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
      console.warn(
        '⚠️  Google Client ID not configured. Please follow scripts/setup-google-oauth.md'
      );
    }
  });
});
