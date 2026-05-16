import { UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { FormsAdapter } from './forms.adapter';
import { FormStatus, FormType } from '@equip-track/shared';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
  },
  QueryCommand: jest.fn().mockImplementation((params) => params),
  PutCommand: jest.fn().mockImplementation((params) => params),
  UpdateCommand: jest.fn().mockImplementation((params) => params),
  GetCommand: jest.fn().mockImplementation((params) => params),
}));

jest.mock('../../services/aws-client-config.service', () => ({
  getDynamoDbClientConfig: jest.fn().mockReturnValue({}),
}));

const baseForm = {
  PK: 'ORG#org-1#USER#user-1',
  SK: 'FORM#form-1',
  dbItemType: 'FORM',
  userID: 'user-1',
  formID: 'form-1',
  organizationID: 'org-1',
  items: [{ productId: 'bulk-1', quantity: 5 }],
  type: FormType.CheckOut,
  status: FormStatus.Approved,
  createdAtTimestamp: 1,
  lastUpdated: 1,
};

describe('FormsAdapter', () => {
  let adapter: FormsAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new FormsAdapter();
  });

  describe('appendCheckInEvent', () => {
    const event = {
      checkInEventId: 'cie-1',
      items: [{ productId: 'bulk-1', quantity: 2 }],
      createdAtTimestamp: Date.now(),
      createdByUserId: 'wm-1',
      pdfUri: 'https://s3.example.com/cie-1.pdf',
    };

    it('uses list_append to add the event to checkInEvents', async () => {
      mockSend.mockResolvedValue({ Attributes: { ...baseForm, checkInEvents: [event] } });

      await adapter.appendCheckInEvent('form-1', 'user-1', 'org-1', event, false);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const updateArg = (UpdateCommand as unknown as jest.Mock).mock.calls[0][0];
      expect(updateArg.UpdateExpression).toContain('list_append');
      expect(updateArg.UpdateExpression).toContain('if_not_exists(checkInEvents');
      expect(updateArg.ExpressionAttributeValues[':newEvent']).toEqual([event]);
      expect(updateArg.ExpressionAttributeValues[':emptyList']).toEqual([]);
    });

    it('sets fullyReturnedAtTimestamp when fullyReturned is true', async () => {
      mockSend.mockResolvedValue({ Attributes: { ...baseForm, checkInEvents: [event], fullyReturnedAtTimestamp: Date.now() } });

      await adapter.appendCheckInEvent('form-1', 'user-1', 'org-1', event, true);

      const updateArg = (UpdateCommand as unknown as jest.Mock).mock.calls[0][0];
      expect(updateArg.UpdateExpression).toContain('fullyReturnedAtTimestamp');
    });

    it('does not set fullyReturnedAtTimestamp when fullyReturned is false', async () => {
      mockSend.mockResolvedValue({ Attributes: { ...baseForm, checkInEvents: [event] } });

      await adapter.appendCheckInEvent('form-1', 'user-1', 'org-1', event, false);

      const updateArg = (UpdateCommand as unknown as jest.Mock).mock.calls[0][0];
      expect(updateArg.UpdateExpression).not.toContain('fullyReturnedAtTimestamp');
    });

    it('uses ConditionExpression to guard on approved status', async () => {
      mockSend.mockResolvedValue({ Attributes: { ...baseForm, checkInEvents: [event] } });

      await adapter.appendCheckInEvent('form-1', 'user-1', 'org-1', event, false);

      const updateArg = (UpdateCommand as unknown as jest.Mock).mock.calls[0][0];
      expect(updateArg.ConditionExpression).toContain('attribute_exists(PK)');
      expect(updateArg.ConditionExpression).toContain('#status');
    });

    it('throws when ConditionalCheckFailedException is raised', async () => {
      const err = new Error('condition failed');
      (err as unknown as { name: string }).name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValue(err);

      await expect(
        adapter.appendCheckInEvent('form-1', 'user-1', 'org-1', event, false)
      ).rejects.toThrow('not found or is not in approved status');
    });
  });

  describe('createForm', () => {
    it('calls PutCommand with the form data', async () => {
      mockSend.mockResolvedValue({});

      const form = {
        userID: 'user-1',
        formID: 'form-1',
        organizationID: 'org-1',
        items: [],
        type: FormType.CheckOut,
        status: FormStatus.Pending,
        createdAtTimestamp: 1,
        lastUpdated: 1,
      };

      await adapter.createForm(form);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const putArg = (PutCommand as unknown as jest.Mock).mock.calls[0][0];
      expect(putArg.Item.formID).toBe('form-1');
    });
  });
});
