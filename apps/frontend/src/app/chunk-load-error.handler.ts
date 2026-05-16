import { ErrorHandler, Injectable, inject } from '@angular/core';
import { NotificationService } from '../services/notification.service';
import {
  isChunkLoadError,
  recoverFromChunkLoadError,
} from './chunk-load-recovery';

@Injectable()
export class ChunkLoadErrorHandler extends ErrorHandler {
  private readonly notificationService = inject(NotificationService);

  override handleError(error: unknown): void {
    if (isChunkLoadError(error)) {
      void recoverFromChunkLoadError().then((outcome) => {
        if (outcome === 'recovering') {
          this.notificationService.showInfo('common.app-reloading');
        } else {
          this.notificationService.showError(
            'common.app-reload-failed',
            undefined,
            undefined,
            { duration: 7000 }
          );
        }
      });
      return;
    }
    super.handleError(error);
  }
}
