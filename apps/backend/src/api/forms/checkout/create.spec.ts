import { FormType, UserRole } from '@equip-track/shared';
import { handler } from './create';

const mockCreateForm = jest.fn();

jest.mock('../../../db/tables/forms.adapter', () => ({
  FormsAdapter: jest.fn().mockImplementation(() => ({
    createForm: mockCreateForm,
  })),
}));

const validRequest = {
  userId: 'user-1',
  formType: FormType.CheckOut,
  description: 'Test checkout',
  items: [{ productId: 'prod-1', quantity: 2 }],
};

const validJwt = {
  sub: 'user-1',
  orgIdToRole: { 'org-1': UserRole.Admin },
  iat: 1,
  exp: 2,
};

describe('create form handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateForm.mockResolvedValue(undefined);
  });

  it('returns 400 when organizationId is missing', async () => {
    await expect(handler(validRequest, {}, validJwt)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('returns 400 when userId is missing', async () => {
    await expect(
      handler(
        { ...validRequest, userId: '' },
        { organizationId: 'org-1' },
        validJwt
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns 400 when jwtPayload is missing', async () => {
    await expect(
      handler(validRequest, { organizationId: 'org-1' }, undefined)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns 400 when description is missing', async () => {
    await expect(
      handler(
        { ...validRequest, description: '' },
        { organizationId: 'org-1' },
        validJwt
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns 400 for invalid form type', async () => {
    await expect(
      handler(
        { ...validRequest, formType: 'invalid' as FormType },
        { organizationId: 'org-1' },
        validJwt
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns 400 when items array is empty', async () => {
    await expect(
      handler(
        { ...validRequest, items: [] },
        { organizationId: 'org-1' },
        validJwt
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns success for valid checkout request', async () => {
    const result = await handler(
      validRequest,
      { organizationId: 'org-1' },
      validJwt
    );

    expect(result.status).toBe(true);
    expect(result.form).toBeDefined();
    expect(result.form.type).toBe(FormType.CheckOut);
    expect(mockCreateForm).toHaveBeenCalledTimes(1);
  });

  it('returns success for valid check-in request', async () => {
    const result = await handler(
      { ...validRequest, formType: FormType.CheckIn },
      { organizationId: 'org-1' },
      validJwt
    );

    expect(result.status).toBe(true);
    expect(result.form.type).toBe(FormType.CheckIn);
  });

  it('returns 500 when database fails', async () => {
    mockCreateForm.mockRejectedValue(new Error('DB connection lost'));

    await expect(
      handler(validRequest, { organizationId: 'org-1' }, validJwt)
    ).rejects.toMatchObject({ statusCode: 500 });
  });
});
