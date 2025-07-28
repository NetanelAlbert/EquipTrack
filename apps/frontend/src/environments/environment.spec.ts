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

  it('should have development API URL', () => {
    expect(environment.apiUrl).toBe('https://dev-api.equip-track.com');
  });

  it('should have Google Client ID configured', () => {
    expect(environment.googleClientId).toBe(
      '64930861221-3571tfrilm698f11h0p15ph8hi4klt1j.apps.googleusercontent.com'
    );
  });

  it('should warn if Google Client ID is not configured', () => {
    if (environment.googleClientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
      console.warn(
        '⚠️  Google Client ID not configured. Please follow scripts/setup-google-oauth.md'
      );
    }
  });
});
