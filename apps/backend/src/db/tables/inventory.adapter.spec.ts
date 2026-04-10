import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { InventoryAdapter } from './inventory.adapter';
import { FormType } from '@equip-track/shared';

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
  PutCommand: jest.fn(),
  UpdateCommand: jest.fn().mockImplementation((params) => params),
  DeleteCommand: jest.fn(),
  GetCommand: jest.fn().mockImplementation((params) => params),
}));

jest.mock('../../services/aws-client-config.service', () => ({
  getDynamoDbClientConfig: jest.fn().mockReturnValue({}),
}));

describe('InventoryAdapter', () => {
  let adapter: InventoryAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new InventoryAdapter();
  });

  describe('updateUniqueInventoryItemHolder', () => {
    it('uses list_append for ownershipHistory when an event is provided', async () => {
      mockSend.mockResolvedValue({});

      const event = {
        previousHolderId: 'WAREHOUSE',
        newHolderId: 'user-1',
        timestamp: 1_700_000_000_000,
        formId: 'form-1',
        formType: FormType.CheckOut as 'check-out',
      };

      await adapter.updateUniqueInventoryItemHolder(
        'prod-1',
        'upi-1',
        'org-1',
        'user-1',
        event
      );

      expect(mockSend).toHaveBeenCalledTimes(1);
      const updateArg = (UpdateCommand as unknown as jest.Mock).mock.calls[0][0];
      expect(updateArg.UpdateExpression).toContain('list_append');
      expect(updateArg.UpdateExpression).toContain(
        'if_not_exists(ownershipHistory, :emptyList)'
      );
      expect(updateArg.ExpressionAttributeValues[':newEvent']).toEqual([event]);
      expect(updateArg.ExpressionAttributeValues[':emptyList']).toEqual([]);
    });

    it('omits list_append when no ownership event is passed', async () => {
      mockSend.mockResolvedValue({});

      await adapter.updateUniqueInventoryItemHolder(
        'prod-1',
        'upi-1',
        'org-1',
        'user-1'
      );

      const updateArg = (UpdateCommand as unknown as jest.Mock).mock.calls[0][0];
      expect(updateArg.UpdateExpression).not.toContain('ownershipHistory');
    });
  });
});
