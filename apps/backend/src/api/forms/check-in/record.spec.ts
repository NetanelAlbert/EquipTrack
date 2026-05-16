import { FormStatus, FormType, UserRole } from '@equip-track/shared';

const mockGetForm = jest.fn();
const mockGetUserFromDB = jest.fn();
const mockTransferCheckInEvent = jest.fn();
const mockUploadCheckInEventPDF = jest.fn();
const mockAppendCheckInEvent = jest.fn();

jest.mock('../../../db/tables/forms.adapter', () => ({
  FormsAdapter: jest.fn().mockImplementation(() => ({
    getForm: mockGetForm,
    appendCheckInEvent: mockAppendCheckInEvent,
  })),
}));

jest.mock('../../../db/tables/users-and-organizations.adapter', () => ({
  UsersAndOrganizationsAdapter: jest.fn().mockImplementation(() => ({
    getUserFromDB: mockGetUserFromDB,
  })),
}));

jest.mock('../../../services/inventory-transfer.service', () => ({
  InventoryTransferService: jest.fn().mockImplementation(() => ({
    transferCheckInEvent: mockTransferCheckInEvent,
  })),
}));

jest.mock('../../../services/pdf.service', () => ({
  PdfService: { generateCheckInEventPdf: jest.fn().mockReturnValue(Buffer.from('pdf')) },
}));

jest.mock('../../../services/s3.service', () => ({
  S3Service: jest.fn().mockImplementation(() => ({
    uploadCheckInEventPDF: mockUploadCheckInEventPDF,
  })),
}));

// Import after mocks are set up
import { handler } from './record';
import { PdfService } from '../../../services/pdf.service';

const validJwt = {
  sub: 'wm-user-1',
  orgIdToRole: { 'org-1': UserRole.WarehouseManager },
  iat: 1,
  exp: 9_999_999_999,
};

const approvedForm = {
  formID: 'form-1',
  userID: 'user-1',
  organizationID: 'org-1',
  items: [{ productId: 'bulk-1', quantity: 5 }],
  type: FormType.CheckOut,
  status: FormStatus.Approved,
  createdAtTimestamp: 1,
  lastUpdated: 1,
};

const validPathParams = {
  organizationId: 'org-1',
  formId: 'form-1',
  userId: 'user-1',
};

const validReq = {
  items: [{ productId: 'bulk-1', quantity: 2 }],
  signature: 'data:image/png;base64,abc123',
};

describe('check-in record handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (PdfService.generateCheckInEventPdf as jest.Mock).mockReturnValue(Buffer.from('pdf'));
    mockGetForm.mockResolvedValue(approvedForm);
    mockGetUserFromDB.mockResolvedValue({ id: 'user-1', name: 'Test User', email: 'test@test.com', phone: '' });
    mockTransferCheckInEvent.mockResolvedValue(undefined);
    mockUploadCheckInEventPDF.mockResolvedValue('https://s3.amazonaws.com/key.pdf');
    mockAppendCheckInEvent.mockImplementation((_fId, _uId, _oId, event) => ({
      ...approvedForm,
      checkInEvents: [event],
    }));
  });

  it('throws 400 when organizationId is missing', async () => {
    await expect(
      handler(validReq, { formId: 'form-1', userId: 'user-1' }, validJwt)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when formId is missing', async () => {
    await expect(
      handler(validReq, { organizationId: 'org-1', userId: 'user-1' }, validJwt)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when userId is missing', async () => {
    await expect(
      handler(validReq, { organizationId: 'org-1', formId: 'form-1' }, validJwt)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when jwtPayload is missing', async () => {
    await expect(
      handler(validReq, validPathParams, undefined)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when items array is empty', async () => {
    await expect(
      handler({ ...validReq, items: [] }, validPathParams, validJwt)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when signature is missing', async () => {
    await expect(
      handler({ ...validReq, signature: '' }, validPathParams, validJwt)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when form is not found', async () => {
    mockGetForm.mockResolvedValue(null);
    await expect(handler(validReq, validPathParams, validJwt)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('throws 400 when form is not approved', async () => {
    mockGetForm.mockResolvedValue({ ...approvedForm, status: FormStatus.Pending });
    await expect(handler(validReq, validPathParams, validJwt)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('throws 400 when requested product is not outstanding', async () => {
    await expect(
      handler(
        { ...validReq, items: [{ productId: 'unknown-product', quantity: 1 }] },
        validPathParams,
        validJwt
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when requested quantity exceeds outstanding', async () => {
    await expect(
      handler(
        { ...validReq, items: [{ productId: 'bulk-1', quantity: 10 }] },
        validPathParams,
        validJwt
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns success and calls transfer + adapter on valid request', async () => {
    const result = await handler(validReq, validPathParams, validJwt);

    expect(result.status).toBe(true);
    expect(result.updatedForm).toBeDefined();
    expect(result.event.checkInEventId).toBeDefined();
    expect(result.event.items).toEqual(validReq.items);
    expect(result.event.createdByUserId).toBe('wm-user-1');
    expect(result.event.pdfUri).toBeDefined();

    expect(mockTransferCheckInEvent).toHaveBeenCalledTimes(1);
    expect(mockAppendCheckInEvent).toHaveBeenCalledTimes(1);
    expect(PdfService.generateCheckInEventPdf).toHaveBeenCalledTimes(1);
    expect(mockUploadCheckInEventPDF).toHaveBeenCalledTimes(1);
  });

  it('marks form as fully returned when all items are returned', async () => {
    await handler(
      { ...validReq, items: [{ productId: 'bulk-1', quantity: 5 }] },
      validPathParams,
      validJwt
    );

    expect(mockAppendCheckInEvent).toHaveBeenCalledWith(
      'form-1',
      'user-1',
      'org-1',
      expect.any(Object),
      true
    );
  });

  it('does not mark fully returned when items partially returned', async () => {
    await handler(validReq, validPathParams, validJwt);

    expect(mockAppendCheckInEvent).toHaveBeenCalledWith(
      'form-1',
      'user-1',
      'org-1',
      expect.any(Object),
      false
    );
  });
});
