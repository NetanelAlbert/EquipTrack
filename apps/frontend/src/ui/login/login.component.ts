import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { GoogleSignInComponent } from '../auth/google-sign-in.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
    GoogleSignInComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private translateService = inject(TranslateService);

  isLoading = false;

  /**
   * Handle successful Google Sign-In
   */
  onGoogleSignInSuccess(idToken: string): void {
    this.isLoading = true;

    console.log('Received Google ID token, authenticating with backend...');

    this.authService.authenticateWithGoogle(idToken).subscribe({
      next: (response) => {
        console.log('Backend authentication response:', response);

        if (response.status) {
          this.showSuccess('Welcome! Redirecting to your dashboard...');
          // Redirect to the originally intended route or default route
          setTimeout(() => {
            this.router.navigate(['/my-items']);
          }, 1000); // Give user time to see the success message
        } else {
          console.error('Backend authentication failed:', response);
          this.showError('Server authentication failed. Please try again.');
        }
      },
      error: (error) => {
        console.error('Authentication error:', error);

        // Provide more specific error messages
        let errorMessage = 'Authentication failed. Please try again.';
        if (error.status === 0) {
          errorMessage =
            'Network error. Please check your connection and try again.';
        } else if (error.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (error.status === 401 || error.status === 403) {
          errorMessage =
            'Authentication failed. Your Google account may not have access.';
        }

        this.showError(errorMessage);
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  /**
   * Handle Google Sign-In error
   */
  onGoogleSignInError(error: string): void {
    console.error('Google Sign-In error:', error);
    this.showError('Google Sign-In failed. Please try again.');
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

  /**
   * Show error message
   */
  private showError(message: string): void {
    this.snackBar.open(
      this.translateService.instant('auth.error') || message,
      this.translateService.instant('common.close') || 'Close',
      {
        duration: 5000,
        panelClass: ['error-snackbar'],
      }
    );
  }
}
