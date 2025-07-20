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

    this.authService.authenticateWithGoogle(idToken).subscribe({
      next: (response) => {
        if (response.success) {
          this.showSuccess('Successfully signed in!');
          // Redirect to the originally intended route or default route
          this.router.navigate(['/my-items']);
        } else {
          this.showError('Authentication failed. Please try again.');
        }
      },
      error: (error) => {
        console.error('Authentication error:', error);
        this.showError('Authentication failed. Please try again.');
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
