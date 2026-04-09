import { handler } from './feature-preview-password';
import { UsersAndOrganizationsAdapter } from '../../db/tables/users-and-organizations.adapter';
import { UserState } from '@equip-track/shared';
import { verifyFeaturePreviewPassword } from './feature-preview-password-crypto';

jest.mock('./feature-preview-password-crypto', () => ({
  verifyFeaturePreviewPassword: jest.fn(),
}));

jest.mock('../../services/jwt.service', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    generateToken: jest.fn().mockResolvedValue('test-jwt'),
  })),
}));

jest.mock('../../db/tables/users-and-organizations.adapter');

const mockVerify = verifyFeaturePreviewPassword as jest.MockedFunction<
  typeof verifyFeaturePreviewPassword
>;

const mockAdapter = {
  getUserByEmail: jest.fn(),
  getUserDbRecord: jest.fn(),
};

describe('feature-preview-password handler', () => {
  const origStage = process.env.STAGE;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STAGE = 'pr-999';
    mockVerify.mockResolvedValue(true);
    (UsersAndOrganizationsAdapter as jest.Mock).mockImplementation(
      () => mockAdapter
    );
  });

  afterAll(() => {
    process.env.STAGE = origStage;
  });

  it('rejects when stage is not a PR preview', async () => {
    process.env.STAGE = 'dev';
    await expect(
      handler({ email: 'a@b.com', password: 'x' }, {})
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('returns JWT when password verifies', async () => {
    mockAdapter.getUserByEmail.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'a@b.com',
        name: 'A',
        state: UserState.Active,
      },
      userInOrganizations: [
        { organizationId: 'org-1', userId: 'user-1', role: 'admin' },
      ],
    });
    mockAdapter.getUserDbRecord.mockResolvedValue({
      PK: 'USER#user-1',
      SK: 'METADATA',
      dbItemType: 'USER',
      id: 'user-1',
      email: 'a@b.com',
      name: 'A',
      state: UserState.Active,
      featurePreviewPasswordHash: 'scrypt1.x.y',
    });

    const res = await handler(
      { email: 'a@b.com', password: 'secret' },
      {}
    );
    expect(res.status).toBe(true);
    expect(res.jwt).toBe('test-jwt');
    expect(mockVerify).toHaveBeenCalledWith('secret', 'scrypt1.x.y');
  });

  it('rejects when user has no preview password hash', async () => {
    mockAdapter.getUserByEmail.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'a@b.com',
        name: 'A',
        state: UserState.Active,
      },
      userInOrganizations: [],
    });
    mockAdapter.getUserDbRecord.mockResolvedValue({
      PK: 'USER#user-1',
      SK: 'METADATA',
      dbItemType: 'USER',
      id: 'user-1',
      email: 'a@b.com',
      name: 'A',
      state: UserState.Active,
    });

    await expect(
      handler({ email: 'a@b.com', password: 'secret' }, {})
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(mockVerify).not.toHaveBeenCalled();
  });
});
