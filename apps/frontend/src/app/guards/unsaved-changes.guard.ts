import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

// Interface for components that can have unsaved changes
export interface CanComponentDeactivate {
  hasUnsavedChanges(): boolean;
}

export const createUnsavedChangesGuard =
  (): CanDeactivateFn<CanComponentDeactivate> => {
    return async (component) => {
      const dialog = inject(MatDialog);

      if (!component.hasUnsavedChanges()) {
        return true;
      }

      // Import the confirmation dialog dynamically
      const { ConfirmationDialogComponent } = await import(
        '../dialogs/confirmation-dialog.component'
      );

      const dialogRef = dialog.open(ConfirmationDialogComponent, {
        data: {
          titleKey: 'common.confirm',
          messageKey: 'common.unsaved-changes-warning',
          confirmKey: 'common.leave',
          cancelKey: 'common.stay',
        },
        disableClose: true,
      });

      return firstValueFrom(dialogRef.afterClosed());
    };
  };
