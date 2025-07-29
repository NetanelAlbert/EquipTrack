import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { ErrorKeys } from '@equip-track/shared';

export interface NotificationConfig {
  duration?: number;
  actionKey?: string;
  panelClass?: string[];
}

export interface TranslationParams {
  [key: string]: string | number;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private snackBar = inject(MatSnackBar);
  private translateService = inject(TranslateService);

  private readonly defaultConfig = {
    error: {
      duration: 5000,
      panelClass: ['error-snackbar'],
    },
    success: {
      duration: 3000,
      panelClass: ['success-snackbar'],
    },
    info: {
      duration: 4000,
      panelClass: ['info-snackbar'],
    },
  };

  private translate(
    messageKey?: string,
    translationParams?: TranslationParams
  ): string | null {
    if (!messageKey) {
      return null;
    }

    const translatedMessage = this.translateService.instant(
      messageKey,
      translationParams
    );
    return translatedMessage !== messageKey ? translatedMessage : null;
  }

  private showNotification(
    defaultConfig: NotificationConfig,
    messageKey: string,
    fallbackMessage?: string,
    translationParams?: TranslationParams,
    config?: NotificationConfig
  ): void {
    const message =
      this.translate(messageKey, translationParams) ||
      fallbackMessage ||
      messageKey;
    const action =
      this.translate(config?.actionKey) ||
      this.translate(defaultConfig.actionKey) ||
      this.translate('common.close') ||
      'Close';

    this.snackBar.open(message, action, {
      ...defaultConfig,
      ...config,
    });
  }

  /**
   * Show an error notification
   */
  showError(
    messageKey: string,
    fallbackMessage?: string,
    translationParams?: TranslationParams,
    config?: NotificationConfig
  ): void {
    this.showNotification(
      this.defaultConfig.error,
      messageKey,
      fallbackMessage,
      translationParams,
      config
    );
  }

  /**
   * Show a success notification
   */
  showSuccess(
    messageKey: string,
    fallbackMessage?: string,
    translationParams?: TranslationParams,
    config?: NotificationConfig
  ): void {
    this.showNotification(
      this.defaultConfig.success,
      messageKey,
      fallbackMessage,
      translationParams,
      config
    );
  }

  /**
   * Show an info notification
   */
  showInfo(
    messageKey: string,
    fallbackMessage?: string,
    translationParams?: TranslationParams,
    config?: NotificationConfig
  ): void {
    this.showNotification(
      this.defaultConfig.info,
      messageKey,
      fallbackMessage,
      translationParams,
      config
    );
  }

  /**
   * Handle API errors with automatic fallback messages
   */
  handleApiError(
    error: unknown,
    fallbackMessageKey = 'errors.api.general'
  ): void {
    let messageKey = fallbackMessageKey;
    let fallbackMessage = 'An error occurred. Please try again.';

    if (error && typeof error === 'object') {
      // Handle API response errors with status false
      if ('status' in error && error.status === false) {
        if ('errorMessage' in error && typeof error.errorMessage === 'string') {
          fallbackMessage = error.errorMessage;
        }

        // Check if the backend provided an errorKey (new approach)
        if ('errorKey' in error && typeof error.errorKey === 'string') {
          messageKey = error.errorKey;
        }
        // Fallback to legacy error mapping for older API responses
        else if ('error' in error && typeof error.error === 'string') {
          messageKey =
            this.mapErrorToTranslationKey(error.error as string) ||
            fallbackMessageKey;
        }
      }
      // Handle HTTP errors
      else if ('message' in error && typeof error.message === 'string') {
        fallbackMessage = error.message;
      }
      // Handle Error objects
      else if (error instanceof Error) {
        fallbackMessage = error.message;
      }
    } else if (typeof error === 'string') {
      fallbackMessage = error;
    }

    this.showError(messageKey, fallbackMessage);
  }

  /**
   * Map specific error types to translation keys (legacy fallback)
   */
  private mapErrorToTranslationKey(error: string): string | null {
    const errorMappings: Record<string, ErrorKeys> = {
      Unauthorized: ErrorKeys.UNAUTHORIZED,
      Forbidden: ErrorKeys.FORBIDDEN,
      'Resource not found': ErrorKeys.NOT_FOUND,
      'Bad request': ErrorKeys.BAD_REQUEST,
      'Email verification required': ErrorKeys.EMAIL_VERIFICATION_REQUIRED,
      'Internal server error': ErrorKeys.INTERNAL_SERVER_ERROR,
      'No token found': ErrorKeys.NO_TOKEN,
      'No organization selected': ErrorKeys.NO_ORGANIZATION_SELECTED,
    };

    return errorMappings[error] || null;
  }
}
