describe('cors (dev deploy localhost:4200)', () => {
  const originalStage = process.env.STAGE;

  afterEach(() => {
    process.env.STAGE = originalStage;
    jest.resetModules();
  });

  it('production keeps wildcard origin', () => {
    process.env.STAGE = 'production';
    const { resolveAccessControlAllowOrigin } = require('./cors');
    expect(resolveAccessControlAllowOrigin('http://localhost:4200')).toBe('*');
  });

  it('dev echoes localhost:4200 when Origin matches (with or without trailing slash)', () => {
    process.env.STAGE = 'dev';
    const { resolveAccessControlAllowOrigin, buildCorsHeaders } = require('./cors');
    expect(resolveAccessControlAllowOrigin('http://localhost:4200')).toBe(
      'http://localhost:4200'
    );
    expect(resolveAccessControlAllowOrigin('http://localhost:4200/')).toBe(
      'http://localhost:4200'
    );
    expect(
      buildCorsHeaders('http://localhost:4200')['Access-Control-Allow-Origin']
    ).toBe('http://localhost:4200');
  });

  it('dev uses wildcard for other origins', () => {
    process.env.STAGE = 'dev';
    const { resolveAccessControlAllowOrigin } = require('./cors');
    expect(resolveAccessControlAllowOrigin('https://dev.equip-track.com')).toBe('*');
    expect(resolveAccessControlAllowOrigin(undefined)).toBe('*');
  });
});
