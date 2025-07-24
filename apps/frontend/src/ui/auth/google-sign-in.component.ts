import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  inject,
  output,
  input,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { environment } from '../../environments/environment';

/**
 * Google Identity Services credential response interface
 */
interface GoogleCredentialResponse {
  credential: string; // JWT ID token
  select_by: string; // How the user signed in
}

/**
 * Google Identity Services configuration
 */
interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  context?: 'signin' | 'signup' | 'use';
  use_fedcm_for_prompt?: boolean;
  itp_support?: boolean;
}

/**
 * Google Sign-In button configuration
 */
interface GoogleButtonConfiguration {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: string;
  locale?: string;
}

/**
 * Global Google API declaration
 */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfiguration) => void;
          renderButton: (
            parent: HTMLElement,
            config: GoogleButtonConfiguration
          ) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
    onGoogleLibraryLoad?: () => void;
  }
}

@Component({
  selector: 'app-google-sign-in',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './google-sign-in.component.html',
  styleUrl: './google-sign-in.component.scss',
})
export class GoogleSignInComponent implements AfterViewInit {
  @ViewChild('googleButtonContainer', { static: true })
  googleButtonContainer!: ElementRef<HTMLElement>;

  private snackBar = inject(MatSnackBar);
  private translateService = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);

  // Component inputs
  buttonType = input<'standard' | 'icon'>('standard');
  buttonTheme = input<'outline' | 'filled_blue' | 'filled_black'>(
    'filled_blue'
  );
  buttonSize = input<'large' | 'medium' | 'small'>('large');
  buttonText = input<
    'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  >('signin_with');
  disabled = input<boolean>(false);
  showFallbackButton = input<boolean>(true);

  // Component outputs
  signInSuccess = output<string>(); // Emits the ID token
  signInError = output<string>(); // Emits error message

  // Component state
  isLoading = false;
  isGoogleLoaded = false;
  fallbackClicked = false;

  ngAfterViewInit(): void {
    this.initializeGoogleSignIn();
  }

  /**
   * Initialize Google Sign-In after the view is ready
   */
  protected initializeGoogleSignIn(): void {
    if (window.google?.accounts?.id) {
      this.setupGoogleSignIn();
    } else {
      // Wait for Google library to load
      window.onGoogleLibraryLoad = () => {
        this.setupGoogleSignIn();
      };
    }
  }

  /**
   * Set up Google Sign-In configuration and render the button
   */
  private setupGoogleSignIn(): void {
    try {
      if (!environment.googleClientId) {
        throw new Error('Google Client ID not configured');
      }

      if (!window.google) {
        throw new Error('Google library not loaded');
      }

      // Initialize Google Identity Services with COOP-compatible settings
      window.google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (response: GoogleCredentialResponse) => {
          this.handleCredentialResponse(response);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        context: 'signin',
        // Add COOP-compatible settings
        use_fedcm_for_prompt: false,
        itp_support: false,
      });

      // Render the Google Sign-In button
      window.google.accounts.id.renderButton(
        this.googleButtonContainer.nativeElement,
        {
          type: this.buttonType(),
          theme: this.buttonTheme(),
          size: this.buttonSize(),
          text: this.buttonText(),
          shape: 'rectangular',
          logo_alignment: 'left',
          width: '280',
          locale: this.translateService.currentLang || 'en',
        }
      );

      // Defer property change to avoid ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(() => {
        this.isGoogleLoaded = true;
        this.cdr.detectChanges();
      });
    } catch (error) {
      console.error('Failed to initialize Google Sign-In:', error);
      this.handleError('Failed to load Google Sign-In');
    }
  }

  /**
   * Handle successful credential response from Google
   */
  private handleCredentialResponse(response: GoogleCredentialResponse): void {
    try {
      this.isLoading = true;

      if (!response.credential) {
        throw new Error('No credential received from Google');
      }

      console.log('Google Sign-In credential received successfully');

      // Use setTimeout to ensure the postMessage issues don't interfere
      setTimeout(() => {
        try {
          // Emit the ID token to parent component
          this.signInSuccess.emit(response.credential);

          // Don't show success message here - let the parent component handle it
          // after the full authentication flow completes
          // this.showSuccess('Google authentication successful');
        } catch (error) {
          console.error('Error emitting sign-in success:', error);
          this.handleError('Failed to process Google sign-in response');
        }
      }, 100); // Small delay to let Google's postMessage attempts complete
    } catch (error) {
      console.error('Google sign-in error:', error);
      this.handleError('Failed to process Google sign-in');
    } finally {
      // Reset loading state after a short delay
      setTimeout(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }, 150);
    }
  }

  /**
   * Handle fallback button click (when Google Sign-In is not available)
   */
  onFallbackButtonClick(): void {
    this.fallbackClicked = true;
    this.handleError('Google Sign-In is currently unavailable');
  }

  /**
   * Handle errors and show user-friendly messages
   */
  private handleError(message: string): void {
    this.signInError.emit(message);
    this.snackBar.open(
      this.translateService.instant('auth.error') || message,
      this.translateService.instant('common.close') || 'Close',
      {
        duration: 5000,
        panelClass: ['error-snackbar'],
      }
    );
  }

  /**
   * Show success message
   */
  private showSuccess(message: string): void {
    this.snackBar.open(
      this.translateService.instant('auth.success') || message,
      this.translateService.instant('common.close') || 'Close',
      {
        duration: 3000,
        panelClass: ['success-snackbar'],
      }
    );
  }
}
