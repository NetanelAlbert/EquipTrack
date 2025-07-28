import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { GoogleSignInComponent } from '../auth/google-sign-in.component';
import { AuthService } from '../../services/auth.service';
import { AuthStore } from '../../store/auth.store';
import { GoogleAuthResponse } from '@equip-track/shared';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    MatCardModule,
    MatIconModule,
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

  // Expose auth state for template
  authState = this.authStore.authenticationState;

  ngOnInit() {
    this.authService.initializeAuth();
    if (this.authStore.isAuthenticated()) {
      this.router.navigate(['/']);
    }
  }

  onGoogleSignIn(idToken: string) {
    this.authService.authenticateWithGoogle(idToken).subscribe({
      next: (response: GoogleAuthResponse) => {
        if (response.status) {
          this.router.navigate(['/']);
        }
      },
      error: (error: any) => {
        console.error('Login failed:', error);
        // Error is handled by AuthService and displayed via authState
      },
    });
  }
}
