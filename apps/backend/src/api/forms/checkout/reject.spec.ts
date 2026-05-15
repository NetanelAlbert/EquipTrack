import { FormStatus, FormType, JwtPayload, InventoryForm } from '@equip-track/shared';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';
import {
  badRequest,
  internalServerError,
  jwtPayloadRequired,
  organizationIdRequired,
  userIdRequired,
} from '../../responses';

const mockGetForm = jest.fn();
const mockUpdateForm = jest.fn();

jest.mock('../../../db/tables/forms.adapter', () => ({
  FormsAdapter: jest.fn().mockImplementation(() => ({
    getForm: mockGetForm,
    updateForm: mockUpdateForm,
  })),
}));

import { handler } from './reject';

describe('reject form handler', () => {
  const validJwt: JwtPayload = {
    sub: 'approver-user',
    orgIdToRole: { 'org-1': 'admin' },
    iat: 0,
    exp: 0,
  } as unknown as JwtPayload;

  const pathParams: APIGatewayProxyEventPathParameters = {
    organizationId: 'org-1',
  };

  const pendingForm: InventoryForm = {
    userID: 'user-1',
    formID: 'form-1',
    organizationID: 'org-1',
    items: [],
    type: FormType.CheckOut,
    status: FormStatus.Pending,
    createdAtTimestamp: Date.now(),
    lastUpdated: Date.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject a pending form successfully', async () => {
    mockGetForm.mockResolvedValue({ ...pendingForm });
    const updatedForm = { ...pendingForm, status: FormStatus.Rejected };
    mockUpdateForm.mockResolvedValue(updatedForm);

    const result = await handler(
      { userId: 'user-1', formID: 'form-1', reason: 'Not needed' },
      pathParams,
      validJwt
    );

    expect(result.status).toBe(true);
    expect(result.updatedForm).toEqual(updatedForm);
    expect(mockUpdateForm).toHaveBeenCalledWith(
      'form-1',
      'user-1',
      'org-1',
      expect.objectContaining({
        status: FormStatus.Rejected,
        rejectionReason: 'Not needed',
        rejectionByUserId: 'approver-user',
      })
    );
  });

  it('should throw badRequest when form is already approved', async () => {
    mockGetForm.mockResolvedValue({
      ...pendingForm,
      status: FormStatus.Approved,
    });

    await expect(
      handler(
        { userId: 'user-1', formID: 'form-1', reason: 'Too late' },
        pathParams,
        validJwt
      )
    ).rejects.toEqual(
      badRequest('Form form-1 is not in pending status (current: approved)')
    );

    expect(mockUpdateForm).not.toHaveBeenCalled();
  });

  it('should throw badRequest when form is already rejected', async () => {
    mockGetForm.mockResolvedValue({
      ...pendingForm,
      status: FormStatus.Rejected,
    });

    await expect(
      handler(
        { userId: 'user-1', formID: 'form-1', reason: 'Duplicate rejection' },
        pathParams,
        validJwt
      )
    ).rejects.toEqual(
      badRequest('Form form-1 is not in pending status (current: rejected)')
    );

    expect(mockUpdateForm).not.toHaveBeenCalled();
  });

  it('should throw organizationIdRequired when organizationId is missing', async () => {
    await expect(
      handler(
        { userId: 'user-1', formID: 'form-1', reason: 'reason' },
        {},
        validJwt
      )
    ).rejects.toEqual(organizationIdRequired);
  });

  it('should throw badRequest when formID is missing', async () => {
    await expect(
      handler(
        { userId: 'user-1', formID: '', reason: 'reason' },
        pathParams,
        validJwt
      )
    ).rejects.toEqual(
      badRequest('Form ID and rejection reason are required')
    );
  });

  it('should throw badRequest when reason is missing', async () => {
    await expect(
      handler(
        { userId: 'user-1', formID: 'form-1', reason: '' },
        pathParams,
        validJwt
      )
    ).rejects.toEqual(
      badRequest('Form ID and rejection reason are required')
    );
  });

  it('should throw jwtPayloadRequired when jwtPayload is missing', async () => {
    await expect(
      handler(
        { userId: 'user-1', formID: 'form-1', reason: 'reason' },
        pathParams,
        undefined
      )
    ).rejects.toEqual(jwtPayloadRequired);
  });

  it('should throw userIdRequired when userId is missing', async () => {
    await expect(
      handler(
        { userId: '', formID: 'form-1', reason: 'reason' },
        pathParams,
        validJwt
      )
    ).rejects.toEqual(userIdRequired);
  });

  it('should throw badRequest when form is not found', async () => {
    mockGetForm.mockResolvedValue(null);

    await expect(
      handler(
        { userId: 'user-1', formID: 'form-1', reason: 'reason' },
        pathParams,
        validJwt
      )
    ).rejects.toEqual(
      badRequest('Form with ID form-1 not found for user user-1')
    );
  });

  it('should throw internalServerError for unexpected DB errors', async () => {
    mockGetForm.mockRejectedValue(new Error('DynamoDB connection failed'));

    await expect(
      handler(
        { userId: 'user-1', formID: 'form-1', reason: 'reason' },
        pathParams,
        validJwt
      )
    ).rejects.toEqual(internalServerError('Failed to reject form'));
  });
});
