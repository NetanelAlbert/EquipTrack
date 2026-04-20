import { UserRole, UserState } from '@equip-track/shared';
import { handler } from './feature-preview-password';
import { UsersAndOrganizationsAdapter } from '../../db/tables/users-and-organizations.adapter';
import { JwtService } from '../../services/jwt.service';
import { hashPreviewPasswordForTests } from './preview-password-crypto';

describe('feature-preview-password handler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.FEATURE_PREVIEW_AUTH_ENABLED = 'true';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 403 when feature preview auth is disabled', async () => {
    process.env.FEATURE_PREVIEW_AUTH_ENABLED = 'false';

    await expect(
      handler({ email: 'a@b.com', password: 'x' }, {})
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('returns jwt when credentials match', async () => {
    const hash = hashPreviewPasswordForTests('secret');
    jest
      .spyOn(
        UsersAndOrganizationsAdapter.prototype,
        'getUserByEmailForFeaturePreview'
      )
      .mockResolvedValue({
        user: {
          id: 'user-1',
          email: 'e@x.com',
          name: 'T',
          state: UserState.Active,
        },
        userInOrganizations: [
          {
            organizationId: 'org-1',
            role: UserRole.Admin,
            userId: 'user-1',
          },
        ],
        featurePreviewPasswordHash: hash,
      });

    jest
      .spyOn(JwtService.prototype, 'generateToken')
      .mockResolvedValue('jwt-token');

    const res = await handler({ email: 'e@x.com', password: 'secret' }, {});

    expect(res.status).toBe(true);
    expect(res.jwt).toBe('jwt-token');
  });
});
