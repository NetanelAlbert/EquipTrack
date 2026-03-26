import * as libDynamo from '@aws-sdk/lib-dynamodb';
import { FormsAdapter } from './forms.adapter';
import { DbItemType } from '../models';
import { FormStatus, FormType, InventoryForm } from '@equip-track/shared';

describe('FormsAdapter', () => {
  let sendMock: jest.Mock;

  beforeEach(() => {
    sendMock = jest.fn().mockResolvedValue({});
    jest.spyOn(libDynamo.DynamoDBDocumentClient, 'from').mockReturnValue({
      send: sendMock,
    } as unknown as libDynamo.DynamoDBDocumentClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createForm', () => {
    it('persists organizationId and userFormKey without legacy PK/SK prefixes', async () => {
      const adapter = new FormsAdapter();
      const form: InventoryForm = {
        userID: 'user-1',
        formID: 'form-1',
        organizationId: 'org-1',
        items: [],
        type: FormType.CheckOut,
        status: FormStatus.Pending,
        createdAtTimestamp: 1,
        lastUpdated: 1,
      };

      await adapter.createForm(form);

      expect(sendMock).toHaveBeenCalledTimes(1);
      const command = sendMock.mock.calls[0][0];
      expect(command.constructor.name).toBe('PutCommand');
      expect(command.input.Item).toMatchObject({
        organizationId: 'org-1',
        userFormKey: 'user-1#form-1',
        dbItemType: DbItemType.Form,
        userID: 'user-1',
        formID: 'form-1',
      });
    });
  });
});
