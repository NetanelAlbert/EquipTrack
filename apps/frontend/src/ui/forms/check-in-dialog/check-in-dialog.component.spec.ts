import { MatDialogRef } from '@angular/material/dialog';

import { CheckInDialogComponent } from './check-in-dialog.component';
import { NotificationService } from '../../../services/notification.service';
import { FormStatus, FormType, InventoryForm } from '@equip-track/shared';

const approvedForm: InventoryForm = {
  formID: 'form-1',
  userID: 'user-1',
  organizationID: 'org-1',
  items: [{ productId: 'bulk-1', quantity: 5 }],
  type: FormType.CheckOut,
  status: FormStatus.Approved,
  createdAtTimestamp: 1,
  lastUpdated: 1,
};

function makeComponent(form = approvedForm): {
  component: CheckInDialogComponent;
  dialogRefClose: jest.Mock;
  showError: jest.Mock;
} {
  const dialogRefClose = jest.fn();
  const showError = jest.fn();
  const mockDialogRef = { close: dialogRefClose } as unknown as MatDialogRef<CheckInDialogComponent>;
  const mockNotification = { showError } as unknown as NotificationService;

  const component = new CheckInDialogComponent(mockDialogRef, { form }, mockNotification);
  return { component, dialogRefClose, showError };
}

describe('CheckInDialogComponent (unit)', () => {
  it('initializes outstandingItems from the form when no events exist', () => {
    const { component } = makeComponent();
    expect(component.outstandingItems).toEqual([{ productId: 'bulk-1', quantity: 5 }]);
  });

  it('initializes outstandingItems respecting existing check-in events', () => {
    const formWithEvent: InventoryForm = {
      ...approvedForm,
      checkInEvents: [
        {
          checkInEventId: 'cie-1',
          items: [{ productId: 'bulk-1', quantity: 2 }],
          createdAtTimestamp: 1,
          createdByUserId: 'wm-1',
        },
      ],
    };
    const { component } = makeComponent(formWithEvent);
    expect(component.outstandingItems).toEqual([{ productId: 'bulk-1', quantity: 3 }]);
  });

  it('closes with undefined on cancel', () => {
    const { component, dialogRefClose } = makeComponent();
    component.onCancel();
    expect(dialogRefClose).toHaveBeenCalledWith(undefined);
  });

  it('shows error and does not close when items submitted without signature', () => {
    const { component, dialogRefClose, showError } = makeComponent();
    component.onItemsSubmitted([{ productId: 'bulk-1', quantity: 1 }]);
    expect(dialogRefClose).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalled();
  });

  it('closes with items and signature when both are provided', () => {
    const { component, dialogRefClose } = makeComponent();
    component.onSignatureChange('data:image/png;base64,sig');
    component.onItemsSubmitted([{ productId: 'bulk-1', quantity: 1 }]);
    expect(dialogRefClose).toHaveBeenCalledWith({
      items: [{ productId: 'bulk-1', quantity: 1 }],
      signature: 'data:image/png;base64,sig',
    });
  });

  it('updates signature signal on change', () => {
    const { component } = makeComponent();
    component.onSignatureChange('data:image/png;base64,newsig');
    expect(component.signature()).toBe('data:image/png;base64,newsig');
  });

  it('has a submitButton config with check-in text', () => {
    const { component } = makeComponent();
    expect(component.submitButton.text).toBe('forms.check-in-dialog.submit');
  });

  it('produces an empty outstandingItems array when all items returned', () => {
    const fullyReturnedForm: InventoryForm = {
      ...approvedForm,
      checkInEvents: [
        {
          checkInEventId: 'cie-full',
          items: [{ productId: 'bulk-1', quantity: 5 }],
          createdAtTimestamp: 1,
          createdByUserId: 'wm-1',
        },
      ],
    };
    const { component } = makeComponent(fullyReturnedForm);
    expect(component.outstandingItems).toEqual([]);
  });
});
