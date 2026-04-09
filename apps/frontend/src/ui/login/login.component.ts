import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import { GoogleSignInComponent } from '../auth/google-sign-in.component';
import { AuthService } from '../../services/auth.service';
import { AuthStore } from '../../store/auth.store';
import { RuntimeConfigService } from '../../services/runtime-config.service';
import { GoogleAuthResponse } from '@equip-track/shared';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    TranslateModule,
    GoogleSignInComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private authStore = inject(AuthStore);
  private runtimeConfig = inject(RuntimeConfigService);

  // Expose auth state for template
  authState = this.authStore.authenticationState;

  /** Shown only when runtime-config.json enables feature preview login (PR preview deploys). */
  showFeaturePreviewLogin = false;
  previewEmail = '';
  previewPassword = '';

  async ngOnInit() {
    await this.runtimeConfig.load();
    this.showFeaturePreviewLogin = this.runtimeConfig.featurePreviewLoginEnabled;
    await this.authService.initializeAuth();
    if (this.authStore.isAuthenticated()) {
      this.router.navigate(['/']);
    }
  }

  onPreviewPasswordSubmit(): void {
    const email = this.previewEmail.trim();
    if (!email || !this.previewPassword) {
      return;
    }
    this.authService
      .authenticateWithFeaturePreviewPassword(email, this.previewPassword)
      .subscribe({
        next: (response) => {
          if (response.status) {
            this.router.navigate(['/']);
          }
        },
        error: (error: unknown) => {
          console.error('Preview login failed:', error);
        },
      });
  }

  onGoogleSignIn(idToken: string) {
    this.authService.authenticateWithGoogle(idToken).subscribe({
      next: (response: GoogleAuthResponse) => {
        if (response.status) {
          this.router.navigate(['/']);
        }
      },
      error: (error: unknown) => {
        console.error('Login failed:', error);
        // Error is handled by AuthService and displayed via authState
      },
    });
  }
}
