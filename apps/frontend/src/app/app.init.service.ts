import { Injectable, inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AppInitService {
  private authService = inject(AuthService);

  async initialize(): Promise<void> {
    try {
      await this.authService.initializeAuth();
    } catch (error) {
      console.error('Failed to initialize application:', error);
    }
  }
}
